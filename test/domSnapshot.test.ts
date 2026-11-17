import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffDomSnapshots, domNoise, maskValue, makeGarbageValue, readDomSnapshot, type DomSnapshot } from '../src/analysis/domSnapshot';
import { useBrowser, APP_ORIGIN } from './helpers/browser';

const snap = (texts: Record<string, string>, nodeCount = Object.keys(texts).length): DomSnapshot => ({ nodeCount, texts });

describe('diffDomSnapshots', () => {
  it('reports no change for identical snapshots', () => {
    const d = diffDomSnapshots({ a: snap({ 'body/p[0]/#0': 'hi' }), b: snap({ 'body/p[0]/#0': 'hi' }) });
    assert.equal(d.changed.length, 0);
    assert.equal(d.nodeDelta, 0);
  });

  it('catches a single short string changing (the case a pixel threshold misses)', () => {
    const d = diffDomSnapshots({
      a: snap({ 'body/h1[0]/#0': 'Order history', 'body/p[0]/#0': 'Alice' }),
      b: snap({ 'body/h1[0]/#0': 'Order history', 'body/p[0]/#0': 'Bob' }),
    });
    assert.deepEqual(d.changed, [{ key: 'body/p[0]/#0', a: 'Alice', b: 'Bob' }]);
    assert.equal(d.textFraction, 0.5);
  });

  it('counts a path present on one side only, and element-count drift', () => {
    const d = diffDomSnapshots({ a: snap({ x: '1' }, 10), b: snap({ x: '1', y: '2' }, 14) });
    assert.equal(d.changed.length, 1);
    assert.equal(d.nodeDelta, 4);
  });

  it('ignores the self-noise of the route (a ticking clock), at whatever value it shows next', () => {
    const ref1 = snap({ clock: '10:00:01', name: 'Alice' }, 5);
    const ref2 = snap({ clock: '10:00:04', name: 'Alice' }, 6);
    const noise = domNoise({ a: ref1, b: ref2 });
    const same = diffDomSnapshots({ a: ref1, b: snap({ clock: '10:00:09', name: 'Alice' }, 6), noise });
    assert.equal(same.changed.length, 0);
    assert.equal(same.nodeDelta, 0, 'a 1-element drift is within the calibrated noise');
    const leak = diffDomSnapshots({ a: ref1, b: snap({ clock: '10:00:09', name: 'Bob' }, 5), noise });
    assert.equal(leak.changed.length, 1);
  });
});

describe('domNoise (remount noise)', () => {
  it('treats per-mount random content as noise (lingualeo: random quiz words on every mount)', () => {
    const before = snap({ word: 'béret', title: 'Savannah' });
    const after = snap({ word: 'beryl', title: 'Savannah' });
    const cand = snap({ word: 'mini-jupe', title: 'Savannah' });
    const d = diffDomSnapshots({ a: before, b: cand, noise: domNoise({ a: before, b: after, candidate: cand }) });
    assert.equal(d.changed.length, 0);
  });

  it('does NOT treat a stale render of the candidate as noise (the leak must not be absorbed)', () => {
    const before = snap({ owner: 'Alice' });
    const after = snap({ owner: 'Bob' });   // the app never re-rendered back: still shows the candidate
    const cand = snap({ owner: 'Bob' });
    const d = diffDomSnapshots({ a: before, b: cand, noise: domNoise({ a: before, b: after, candidate: cand }) });
    assert.equal(d.changed.length, 1);
  });
});

describe('maskValue', () => {
  it('masks a whole-token echo of the value, so two echoes of different ids compare equal', () => {
    const a = maskValue({ snapshot: snap({ t: 'Order 1042 not found' }), value: '1042' });
    const b = maskValue({ snapshot: snap({ t: 'Order 7781 not found' }), value: '7781' });
    assert.equal(diffDomSnapshots({ a, b }).changed.length, 0);
  });

  it('does not mask the value inside a longer token', () => {
    const m = maskValue({ snapshot: snap({ t: 'customer 61402981 / 298' }), value: '298' });
    assert.equal(m.texts.t, 'customer 61402981 / ⟨value⟩');
  });

  it('leaves values too short to mask safely untouched', () => {
    const m = maskValue({ snapshot: snap({ t: '1 item, 2 items' }), value: '1' });
    assert.equal(m.texts.t, '1 item, 2 items');
  });

  it('escapes regex metacharacters in the value', () => {
    const m = maskValue({ snapshot: snap({ t: 'id a.b+c here' }), value: 'a.b+c' });
    assert.equal(m.texts.t, 'id ⟨value⟩ here');
  });
});

describe('makeGarbageValue', () => {
  it('keeps length and separators', () => {
    const g = makeGarbageValue('objective_c1ec567c-f027');
    assert.equal(g.length, 'objective_c1ec567c-f027'.length);
    assert.equal(g[9], '_');
    assert.equal(g[18], '-');
  });
});

describe('readDomSnapshot (in a real page)', () => {
  const { newPage } = useBrowser();

  it('keeps text (hidden included) and <img> src, drops scripts/styles/attributes', async () => {
    const page = await newPage();
    const html = `<div class="a1"><h1>Title</h1><p style="display:none">hidden text</p>
      <img src="/avatars/alice.png" class="x"><script>window.__NEXT_DATA__ = {"q":"secret"}</script>
      <style>.a1{color:red}</style><span>  spaced
      out  </span></div>`;
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await page.goto(`${APP_ORIGIN}/`);
    const s = await readDomSnapshot({ page });
    const values = Object.values(s.texts);
    assert.ok(values.includes('Title'));
    assert.ok(values.includes('hidden text'), 'hidden content is part of the DOM signal');
    assert.ok(values.includes('/avatars/alice.png'));
    assert.ok(values.includes('spaced out'), 'whitespace collapsed');
    assert.ok(!values.some((v) => v.includes('secret') || v.includes('color:red')), 'scripts/styles skipped');
    assert.equal(s.nodeCount, 5); // div, h1, p, img, span (script/style not counted)
  });
});
