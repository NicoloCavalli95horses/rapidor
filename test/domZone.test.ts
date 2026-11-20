import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { domChromeZone, nodeChromeZone, zoneWalkDepthFor } from '../src/analysis/domZone';
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
