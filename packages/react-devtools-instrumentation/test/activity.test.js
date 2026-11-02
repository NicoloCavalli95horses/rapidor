//===================
// Import
//===================
import { AnalysisActivity } from '../modules/analysis/activity.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
// The activity tracker is what lets a crawler wait until RAPIDOR's analysis pipeline has drained.
// whenIdle() must only resolve true after a quiet window with nothing in flight, and must give up
// (false) if work never stops within the timeout.
describe('AnalysisActivity', function () {
  it('reports idle immediately when nothing was ever tracked', async () => {
    const a = new AnalysisActivity();
    assert.equal(await a.whenIdle({ quietMs: 20, timeoutMs: 500, pollMs: 5 }), true);
  });

  it('waits until a tracked task settles, then until the quiet window passes', async () => {
    const a = new AnalysisActivity();
    let resolveTask;
    a.track(new Promise((r) => { resolveTask = r; }));
    const start = Date.now();
    setTimeout(() => resolveTask(), 60);
    assert.equal(await a.whenIdle({ quietMs: 50, timeoutMs: 1000, pollMs: 5 }), true);
    // ~60ms until the task ends + ~50ms quiet window
    assert.ok(Date.now() - start >= 100, `${Date.now() - start}ms`);
  });

  it('stays busy while chained tasks keep the counter above zero', async () => {
    const a = new AnalysisActivity();
    a.begin(); // first stage in flight
    // a second stage begins before the first ends (as GEN_REQ -> EVALUATE chain does)
    setTimeout(() => { a.begin(); a.end(); }, 30); // overlap, net still 1
    setTimeout(() => a.end(), 80);                 // first stage ends last
    const start = Date.now();
    assert.equal(await a.whenIdle({ quietMs: 40, timeoutMs: 1000, pollMs: 5 }), true);
    assert.ok(Date.now() - start >= 120, `${Date.now() - start}ms`);
  });

  it('times out (false) when work never settles', async () => {
    const a = new AnalysisActivity();
    a.begin(); // never ends
    assert.equal(await a.whenIdle({ quietMs: 30, timeoutMs: 120, pollMs: 5 }), false);
  });

  it('track() counts a promise as in-flight until it settles, even on rejection', async () => {
    const a = new AnalysisActivity();
    a.track(Promise.reject(new Error('boom'))).catch(() => {});
    // after the rejection settles, the tracker must be back to idle
    assert.equal(await a.whenIdle({ quietMs: 20, timeoutMs: 500, pollMs: 5 }), true);
    assert.equal(a.inFlight, 0);
  });
});
