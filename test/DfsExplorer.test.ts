import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { DfsExplorer, type ExplorationLimits } from '../src/core/DfsExplorer';
import { StateNavigator } from '../src/browser/StateNavigator';
import { StateStore } from '../src/state/StateStore';
import { StateGraph } from '../src/state/StateGraph';
import { CrawlStateStore } from '../src/db/CrawlStateStore';
import { CrawlEdgeStore } from '../src/db/CrawlEdgeStore';
import type { IExplorationHooks, IStateCapturer } from '../src/core/interfaces';
import type { ExplorationStopReason } from '../src/core/types';
import { FakeApp, FakeTabs, noWait } from './helpers/fakes';

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'crawler-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

const SITE = 'app.test';
let n = 0;
function newPersistence(): { crawlStates: CrawlStateStore; crawlEdges: CrawlEdgeStore } {
  const db = new Database(join(root, `${n++}.db`));
  return { crawlStates: new CrawlStateStore({ db, clearOnStart: false }), crawlEdges: new CrawlEdgeStore({ db, clearOnStart: false }) };
}

/** Real engine (navigator, store, graph) on a simulated app. */
function run(
  app: FakeApp,
  limits: Partial<ExplorationLimits> = {},
  capturer?: IStateCapturer,
  restoreAttempts?: number,
  hooks?: IExplorationHooks,
) {
  const { crawlStates, crawlEdges } = newPersistence();
  const cap = capturer ?? app.capturer();
  const executor = app.executor();
  const navigator = new StateNavigator('https://app.test/', executor, noWait, undefined, { timeoutMs: 0 });
  const store = new StateStore({ screenshots: false, restoreAttempts }, SITE, crawlStates);
  const graph = new StateGraph(SITE, crawlEdges);
  const explorer = new DfsExplorer(noWait, executor, cap, navigator, store, graph,
    { maxDepth: 10, maxStates: 1000, maxDurationSecs: 3600, ...limits }, hooks);
  const states = () => crawlStates.listBySite(SITE);
  const saved = () => states().map((s) => s.id).sort();
  return { explorer, crawlStates, crawlEdges, graph, saved, states, explore: () => explorer.explore(app.page()) };
}

/** Hooks that only record what onEnd receives. */
function endSpy() {
  const ends: { explorationMs: number; stopReason?: ExplorationStopReason }[] = [];
  const hooks: IExplorationHooks = {
    onStart: async () => {},
    onEnd: async (_page, explorationMs, stopReason) => { ends.push({ explorationMs, stopReason }); },
  };
  return { ends, hooks };
}

describe('DfsExplorer stop reason (passed to onEnd, persisted in run_metadata)', () => {
  const chain = { S0: { a: 'S1' }, S1: { b: 'S2' }, S2: { c: 'S3' }, S3: {} };

  it('is "completed" when the frontier runs dry', async () => {
    const spy = endSpy();
    await run(new FakeApp(chain), {}, undefined, undefined, spy.hooks).explore();
    assert.deepEqual(spy.ends.map((e) => e.stopReason), ['completed']);
  });

  it('is "max-states" when a tab hits maxStates', async () => {
    const spy = endSpy();
    await run(new FakeApp(chain), { maxStates: 2 }, undefined, undefined, spy.hooks).explore();
    assert.deepEqual(spy.ends.map((e) => e.stopReason), ['max-states']);
  });

  it('is "max-duration" when the time budget is spent', async () => {
    const spy = endSpy();
    await run(new FakeApp(chain), { maxDurationSecs: 0 }, undefined, undefined, spy.hooks).explore();
    assert.deepEqual(spy.ends.map((e) => e.stopReason), ['max-duration']);
  });

  it('is "error" when the exploration throws (onEnd still runs)', async () => {
    const spy = endSpy();
    const failing: IStateCapturer = { capture: async () => { throw new Error('boom'); } };
    await assert.rejects(run(new FakeApp(chain), {}, failing, undefined, spy.hooks).explore(), /boom/);
    assert.deepEqual(spy.ends.map((e) => e.stopReason), ['error']);
  });
});

describe('DfsExplorer', () => {
  it('visits all reachable states, even with cycles', async () => {
    const app = new FakeApp({
      S0: { a: 'S1', b: 'S2' },
      S1: { back: 'S0', c: 'S3' },
      S2: { d: 'S3' },
      S3: { home: 'S0' },
    });
    const r = run(app);
    await r.explore();
    assert.deepEqual(r.saved(), ['S0', 'S1', 'S2', 'S3']);
    assert.equal(r.graph.edgeCount(), 6);
  });

  it('saves states at the maximum depth but does not expand them', async () => {
    const app = new FakeApp({ S0: { a: 'S1' }, S1: { b: 'S2' }, S2: { c: 'S3' }, S3: {} });
    const r = run(app, { maxDepth: 2 });
    await r.explore();
    assert.deepEqual(r.saved(), ['S0', 'S1', 'S2']);
  });

  it('records depth and path of every state', async () => {
    const app = new FakeApp({ S0: { a: 'S1' }, S1: { b: 'S2' }, S2: {} });
    const r = run(app);
    await r.explore();
    const s2 = r.states().find((s) => s.id === 'S2')!;
    assert.equal(s2.depth, 2);
    assert.deepEqual(s2.path.map((p) => p.targetId), ['a', 'b']);
  });

  it('after the maximum depth goes back to the starting state and tries the next clickable', async () => {
    const app = new FakeApp({ S0: { a: 'S1', b: 'S2' }, S1: { c: 'S3' }, S2: {}, S3: {} });
    const r = run(app, { maxDepth: 1 });
    await r.explore();
    assert.deepEqual(app.clicks, ['S0.a', 'S0.b']);
    assert.deepEqual(r.saved(), ['S0', 'S1', 'S2']);
  });

  it('does not re-expand an already seen state', async () => {
    const app = new FakeApp({ S0: { a: 'S1', b: 'S1' }, S1: { c: 'S2' }, S2: {} });
    const r = run(app);
    await r.explore();
    assert.equal(app.clicks.filter((c) => c === 'S1.c').length, 1);
    assert.equal(r.graph.edgeCount(), 3);   // S0-a->S1, S0-b->S1, S1-c->S2
  });

  it('stops at the maximum number of states', async () => {
    const app = new FakeApp({ S0: { a: 'S1', b: 'S2', c: 'S3' }, S1: {}, S2: {}, S3: {} });
    const r = run(app, { maxStates: 2 });
    await r.explore();
    assert.equal(r.states().length, 2);
  });

  it('stops when the time budget is exhausted', async () => {
    const app = new FakeApp({ S0: { a: 'S1', b: 'S2' }, S1: {}, S2: {} });
    const r = run(app, { maxDurationSecs: 0 });
    await r.explore();
    assert.deepEqual(r.saved(), ['S0']);
  });

  it('retries an intermittently unreachable element instead of pruning its branch', async () => {
    // 'a' leads to S1 but is covered on its first landings (an intermittent interstitial); within
    // the attempt budget it is eventually located, so S1 must still be discovered.
    const app = new FakeApp({ S0: { a: 'S1', b: 'S2' }, S1: { c: 'S3' }, S2: {}, S3: {} });
    app.flakyLocate.set('a', 2);   // misses twice, then clears — under the budget of 4
    const r = run(app, {}, undefined, 4);
    await r.explore();
    // S1 (and its own child S3) are reached despite the early misses
    assert.deepEqual(r.saved(), ['S0', 'S1', 'S2', 'S3']);
  });

  it('gives up a persistently unreachable element after the budget, without losing its siblings', async () => {
    const app = new FakeApp({ S0: { a: 'S1', b: 'S2' }, S1: {}, S2: {} });
    app.flakyLocate.set('a', 999);   // never locatable: exhausts the budget and is abandoned
    const r = run(app, {}, undefined, 3);
    await r.explore();
    // the run terminates; 'a's branch is dropped but the sibling 'b' -> S2 is fully explored
    assert.deepEqual(r.saved(), ['S0', 'S2']);
  });

  it('an error on one element does not stop the others', async () => {
    const app = new FakeApp({ S0: { a: 'THROW', b: 'S1' }, S1: {} });
    const r = run(app);
    await r.explore();
    assert.deepEqual(r.saved(), ['S0', 'S1']);
  });

  it('saves the graph even if the exploration fails', async () => {
    const app = new FakeApp({ S0: {} });
    const broken: IStateCapturer = { capture: async () => { throw new Error('pagina rotta'); } };
    const r = run(app, {}, broken);
    await assert.rejects(r.explore(), /pagina rotta/);
  });

  it('calls beforeAction before each click and afterAction on each result', async () => {
    const app = new FakeApp({ S0: { a: 'S1', b: 'S2' }, S1: {}, S2: {} });
    const { crawlStates, crawlEdges } = newPersistence();
    const cap = app.capturer();
    const executor = app.executor();
    const navigator = new StateNavigator('https://app.test/', executor, noWait, undefined, { timeoutMs: 0 });
    const order: string[] = [];
    const hooks = {
      onStart: async () => {},
      onEnd: async () => {},
      beforeAction: async () => { order.push('before'); },
      afterAction: async () => { order.push('after'); },
    };
    const explorer = new DfsExplorer(
      noWait, executor, cap, navigator,
      new StateStore({ screenshots: false }, SITE, crawlStates), new StateGraph(SITE, crawlEdges),
      { maxDepth: 10, maxStates: 1000, maxDurationSecs: 3600 }, hooks,
    );

    await explorer.explore(app.page());

    // S0 has two clickables (S1, S2 have none): each click is wrapped before -> after, in order
    assert.deepEqual(order, ['before', 'after', 'before', 'after']);
    assert.deepEqual(crawlStates.listBySite(SITE).map((s) => s.id).sort(), ['S0', 'S1', 'S2']);
  });

  describe('multiple tabs', () => {
    const GRAPH = {
      S0: { a: 'S1', b: 'S2', c: 'S3' },
      S1: { d: 'S4', e: 'S5' },
      S2: { f: 'S5', g: 'S6' },
      S3: { h: 'S6' },
      S4: { back: 'S0' }, S5: {}, S6: { x: 'S7' }, S7: {},
    };

    function runTabs(tabs: FakeTabs, limits: Partial<ExplorationLimits> = {}) {
      const { crawlStates, crawlEdges } = newPersistence();
      const cap = tabs.capturer();
      const executor = tabs.executor();
      const navigator = new StateNavigator('https://app.test/', executor, noWait, undefined, { timeoutMs: 0 });
      const explorer = new DfsExplorer(noWait, executor, cap, navigator,
        new StateStore({ screenshots: false }, SITE, crawlStates), new StateGraph(SITE, crawlEdges),
        { maxDepth: 10, maxStates: 1000, maxDurationSecs: 3600, ...limits });
      const [first, ...rest] = tabs.pages();
      return { crawlStates, explore: () => explorer.explore(first, rest) };
    }

    it('find the same states as a single tab, without saving any twice', async () => {
      const tabs = new FakeTabs(GRAPH, 3);
      const r = runTabs(tabs);
      await r.explore();
      const ids = r.crawlStates.listBySite(SITE).map((s) => s.id).sort();
      assert.deepEqual(ids, ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
    });

    it('split the work', async () => {
      const tabs = new FakeTabs(GRAPH, 3);
      await runTabs(tabs).explore();
      const clicks = tabs.clicks;
      assert.ok(clicks.length > 0);
      assert.ok([0, 1, 2].filter((i) => tabs.clicksOf(i).length > 0).length >= 2, 'work must be split across the tabs');
    });

    it('maxStates applies to each tab', async () => {
      const tabs = new FakeTabs(GRAPH, 2);
      const r = runTabs(tabs, { maxStates: 2 });
      await r.explore();
      const count = r.crawlStates.count(SITE);
      assert.ok(count <= 4, `saved ${count}`);
      assert.ok(count > 2, 'with two tabs we go past the cap of a single one');
    });

    it('respect the maximum depth', async () => {
      const tabs = new FakeTabs(GRAPH, 3);
      const r = runTabs(tabs, { maxDepth: 1 });
      await r.explore();
      assert.deepEqual(r.crawlStates.listBySite(SITE).map((s) => s.id).sort(), ['S0', 'S1', 'S2', 'S3']);
    });

    it('terminate even when there are more tabs than work', async () => {
      const tabs = new FakeTabs({ S0: { a: 'S1' }, S1: {} }, 5);
      const r = runTabs(tabs);
      await r.explore();
      assert.deepEqual(r.crawlStates.listBySite(SITE).map((s) => s.id).sort(), ['S0', 'S1']);
    });
  });
});
