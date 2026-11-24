import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { domChromeZone, nodeChromeZone, openingTag, slimGraphForGeneration, zoneWalkDepthFor } from '../src/analysis/domZone';
import type { RapidorGraph } from '../src/db/ReactStateStore';

describe('domChromeZone (a single element)', () => {
  it('marks nav/footer tags, nav/contentinfo roles, and nav/footer class tokens', () => {
    assert.equal(domChromeZone({ dom: '<nav class="x"></nav>' }), 'nav');
    assert.equal(domChromeZone({ dom: '<footer></footer>' }), 'footer');
    assert.equal(domChromeZone({ dom: '<div role="navigation"></div>' }), 'role:navigation');
    assert.equal(domChromeZone({ dom: '<div role="contentinfo"></div>' }), 'role:contentinfo');
    assert.equal(domChromeZone({ dom: '<div class="sc-x nav-top__item"></div>' }), 'class:nav');
    assert.equal(domChromeZone({ dom: '<div class="sidebar"></div>' }), 'class:sidebar');
    assert.equal(domChromeZone({ dom: '<ul class="navbar"></ul>' }), 'class:navbar');
  });

  it('does NOT mark header/section/banner — busuu renders objective-id cards inside a <header>', () => {
    assert.equal(domChromeZone({ dom: '<header class="sc-cbTmKc"></header>' }), null);
    assert.equal(domChromeZone({ dom: '<section class="y"></section>' }), null);
    assert.equal(domChromeZone({ dom: '<div role="banner"></div>' }), null);
  });

  it('class match is token-bounded, not a substring (no false hit on "clipboard")', () => {
    assert.equal(domChromeZone({ dom: '<div class="clipboard navigator"></div>' }), null);
    assert.equal(domChromeZone({ dom: '<div class="main-nav"></div>' }), 'class:nav');   // token after `-`
  });

  it("reads only the element's OWN tag: a role/class in its subtree (legacy outerHTML) does not count", () => {
    // babbel: an app wrapper without its own role was marked navigation via a nested role="navigation"
    assert.equal(domChromeZone({ dom: '<div class="sc-a"><div role="navigation" class="x"></div></div>' }), null);
    assert.equal(domChromeZone({ dom: '<a href="/p"><div class="topbar-item">0</div></a>' }), null);
    assert.equal(domChromeZone({ dom: '<nav><div class="y"></div></nav>' }), 'nav');
    assert.equal(domChromeZone({ dom: '<div data-class="navbar" class="main"></div>' }), null);   // whole attribute name
  });

  it('null when there is no DOM (an old capture, or a composite with dom:null)', () => {
    assert.equal(domChromeZone({ dom: undefined }), null);
    assert.equal(domChromeZone({ dom: null }), null);
    assert.equal(domChromeZone({ dom: '' }), null);
  });
});

/** Builds a straight ancestor chain node-0 (root) -> node-1 -> ... with the given doms (root first). */
function chainGraph(doms: (string | null)[]): RapidorGraph {
  const nodes: NonNullable<RapidorGraph['nodes']> = {};
  doms.forEach((dom, i) => {
    nodes[`n${i}`] = { id: `n${i}`, dom, ...(i > 0 ? { parent: `n${i - 1}` } : {}) };
  });
  return { fingerprint: 'fp', nodes };
}

describe('nodeChromeZone (ancestor walk)', () => {
  it('finds a chrome ancestor within the budget and returns its label', () => {
    const g = chainGraph(['<nav></nav>', '<div></div>', '<span></span>']);   // nav is the root, leaf is n2
    assert.equal(nodeChromeZone({ graph: g, nodeId: 'n2', maxDepth: 5 }), 'nav');
  });

  it('respects the depth budget — a chrome ancestor beyond it is not reached', () => {
    const g = chainGraph(['<nav></nav>', '<div></div>', '<div></div>', '<span></span>']);   // nav 3 hops up from n3
    assert.equal(nodeChromeZone({ graph: g, nodeId: 'n3', maxDepth: 2 }), null);
    assert.equal(nodeChromeZone({ graph: g, nodeId: 'n3', maxDepth: 3 }), 'nav');
  });

  it('returns null when nothing on the path carries DOM info (old captures) — skip only on evidence', () => {
    const g = chainGraph([null, null, null]);
    assert.equal(nodeChromeZone({ graph: g, nodeId: 'n2', maxDepth: 10 }), null);
  });

  it('survives a cyclic parent chain', () => {
    const nodes: NonNullable<RapidorGraph['nodes']> = {
      a: { id: 'a', dom: '<div></div>', parent: 'b' },
      b: { id: 'b', dom: '<div></div>', parent: 'a' },
    };
    assert.equal(nodeChromeZone({ graph: { fingerprint: 'fp', nodes }, nodeId: 'a', maxDepth: 50 }), null);
  });
});

describe('zoneWalkDepthFor (scales with graph size)', () => {
  it('grows with node count, floored at 3 and capped at 24', () => {
    const mk = (n: number): RapidorGraph => {
      const nodes: NonNullable<RapidorGraph['nodes']> = {};
      for (let i = 0; i < n; i++) nodes[`n${i}`] = { id: `n${i}` };
      return { fingerprint: 'fp', nodes };
    };
    assert.equal(zoneWalkDepthFor({ graph: mk(4) }), 3);        // small graph -> floor
    assert.equal(zoneWalkDepthFor({ graph: mk(8028) }), 13);    // busuu-sized -> covers the observed depth 9
    assert.ok(zoneWalkDepthFor({ graph: mk(300) }) < 13);       // mid graph -> smaller window
  });
});

describe('slimGraphForGeneration (drops the outerHTML, keeps the verdict)', () => {
  it('gives every node the same chrome zone as its full dom, without keeping the dom', () => {
    const full = (): RapidorGraph => ({
      fingerprint: 'fp',
      nodes: {
        root: { id: 'root', dom: '<div><nav class="navbar"><a href="/x">x</a></nav></div>' },   // legacy outerHTML
        nav: { id: 'nav', parent: 'root', dom: '<nav class="navbar"><a href="/x">x</a></nav>' },
        link: { id: 'link', parent: 'nav', dom: '<a href="/x">x</a>' },
        main: { id: 'main', dom: '<main><p>lesson</p></main>' },
        old: { id: 'old' },                                                                    // old capture: no dom
      },
    });
    const before = full();
    const slim = slimGraphForGeneration(full());
    for (const id of Object.keys(before.nodes!)) {
      assert.equal(nodeChromeZone({ graph: slim, nodeId: id }), nodeChromeZone({ graph: before, nodeId: id }), id);
      assert.equal('dom' in slim.nodes![id]!, false, id);
    }
  });
});

describe('openingTag', () => {
  it('cuts at the first > outside quotes and is idempotent', () => {
    assert.equal(openingTag('<a title="1 > 0" href="/x"><b>x</b></a>'), '<a title="1 > 0" href="/x">');
    assert.equal(openingTag("<div data-x='a>b'>t</div>"), "<div data-x='a>b'>");
    assert.equal(openingTag('<img src="/i.png">'), '<img src="/i.png">');
    assert.equal(openingTag(openingTag('<div class="c">y</div>')), '<div class="c">');
  });
});
