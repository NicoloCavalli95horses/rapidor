//===================
// Import
//===================
import {
  debounceWithMaxTime,
  sleep,
  metrics,
  metricKeys,
  recordMetric,
  printMetrics,
  runWithConcurrency,
  markExecutionStart,
  getStats,
  getLogs,
  getData,
  getAllTabsData,
  exposeGlobalAPI,
  log,
} from '../utils/utils.js';
import {initClientToBridge} from '../utils/clientToBridge.js';
import {createFakeWindow, attachFakeBridge} from './helpers/fakeWindow.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
describe('utils', function () {
  describe('Function debounceWithMaxTime', function () {
    it('should execute after sufficient idle time', async () => {
      const debounceT = 300;
      const maxT = 10000;
      let count = 0;

      const fn = debounceWithMaxTime(
        () => {
          count++;
        },
        {debounceT, maxT}
      );

      const t = setInterval(fn, 100);

      await sleep(300);
      clearInterval(t);

      await sleep(400);
      assert.equal(count, 1);
    });

    it('should execute once after maxT, under continuous load', async () => {
      const debounceT = 300;
      const maxT = 1000;
      let count = 0;

      const fn = debounceWithMaxTime(
        () => {
          count++;
        },
        {debounceT, maxT}
      );

      const t = setInterval(fn, 100);

      await sleep(1200); // t keeps updating for 1200ms, maxT is triggered
      clearInterval(t);

      assert.ok(count == 1);
    }).timeout(10000);

    it('should not execute while already running', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const fn = debounceWithMaxTime(
        async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);

          await sleep(300);
          concurrent--;
        },
        {debounceT: 100, maxT: 200}
      );

      const t = setInterval(fn, 50);

      await sleep(1000);
      clearInterval(t);

      assert.equal(maxConcurrent, 1);
    });

    it('should reset after execution', async () => {
      let count = 0;

      const fn = debounceWithMaxTime(
        () => {
          count++;
        },
        {debounceT: 200, maxT: 1000}
      );

      fn();
      await sleep(300); // trigger debounce

      fn();
      await sleep(300); // should execute again

      assert.equal(count, 2);
    });
  });

  describe('Function recordMetric', function () {
    // metrics is a shared module-level object: reset the keys under test before each case
    beforeEach(() => {
      delete metrics['test_sum'];
      delete metrics['test_max'];
      delete metrics['test_set'];
    });

    it('should default to summing values (sum mode)', () => {
      recordMetric({key: 'test_sum', value: 2});
      recordMetric({key: 'test_sum', value: 3});
      assert.equal(metrics['test_sum'], 5);
    });

    it('should default value to 1 when not provided', () => {
      recordMetric({key: 'test_sum'});
      recordMetric({key: 'test_sum'});
      assert.equal(metrics['test_sum'], 2);
    });

    it('should keep the highest value in max mode', () => {
      recordMetric({key: 'test_max', value: 5, mode: 'max'});
      recordMetric({key: 'test_max', value: 2, mode: 'max'});
      recordMetric({key: 'test_max', value: 9, mode: 'max'});
      assert.equal(metrics['test_max'], 9);
    });

    it('should overwrite with the last value in set mode', () => {
      recordMetric({key: 'test_set', value: 1, mode: 'set'});
      recordMetric({key: 'test_set', value: 7, mode: 'set'});
      assert.equal(metrics['test_set'], 7);
    });

    it('printMetrics should not throw even with no metrics recorded', () => {
      assert.doesNotThrow(() => printMetrics());
    });
  });

  describe('Function runWithConcurrency', function () {
    it('should run every task and return its results, in order', async () => {
      const tasks = [1, 2, 3, 4].map(n => () => Promise.resolve(n * 10));
      const results = await runWithConcurrency({tasks, limit: 2});
      assert.deepEqual(results, [10, 20, 30, 40]);
    });

    it('should never run more than `limit` tasks at once', async () => {
      let running = 0;
      let maxRunning = 0;

      const tasks = Array.from({length: 6}, () => async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(50);
        running--;
      });

      await runWithConcurrency({tasks, limit: 3});
      assert.equal(maxRunning, 3);
    });

    it('should handle an empty task list', async () => {
      const results = await runWithConcurrency({tasks: []});
      assert.deepEqual(results, []);
    });
  });

  // getStats/getData read from module-level state (set by markExecutionStart), so these tests
  // rely on execution order: the "not started yet" case must run before markExecutionStart() below.
  describe('Functions getStats, getLogs, getData, exposeGlobalAPI (crawler-facing API)', function () {
    it('getStats should report an unstarted execution window as null/0', () => {
      const stats = getStats();
      assert.equal(stats.date, null);
      assert.equal(stats.initialURL, null);
      assert.equal(stats.executionTimeMs, 0);
    });

    it('getStats should include every canonical metric, defaulting to 0', () => {
      const stats = getStats();
      for (const key of Object.values(metricKeys)) {
        assert.equal(stats[key], metrics[key] ?? 0);
      }
    });

    it('markExecutionStart should set date/initialURL/executionTimeMs, and be a no-op afterwards', async () => {
      markExecutionStart();
      const first = getStats();
      assert.notEqual(first.date, null);
      assert.equal(first.initialURL, undefined); // no `window` under Node

      await sleep(20);
      markExecutionStart(); // second call must not reset the start time
      const second = getStats();

      assert.equal(first.date, second.date);
      assert.ok(second.executionTimeMs >= first.executionTimeMs);
    });

    it('getLogs should parse stored log entries back into objects', () => {
      log({module: 'test', msg: 'hello getLogs'});
      const parsed = getLogs();
      const last = parsed[parsed.length - 1];

      assert.equal(typeof last, 'object');
      assert.equal(last.module, 'test');
      assert.equal(last.msg, 'hello getLogs');
    });

    it('getData should bundle logs and stats together', () => {
      const data = getData();
      assert.deepEqual(data.logs, getLogs());
      assert.deepEqual(data.stats, getStats());
    });

    it('exposeGlobalAPI should wire the crawler API onto the given target', () => {
      const fakeWindow = {};
      exposeGlobalAPI({target: fakeWindow});

      // Public entry point aggregates across tabs; the local per-tab snapshot is exposed separately.
      assert.equal(fakeWindow.__RAPIDOR__getData, getAllTabsData);
      assert.equal(fakeWindow.__RAPIDOR__getLocalData, getData);
      assert.deepEqual(fakeWindow.__RAPIDOR__getLocalData(), getData());
    });

    it('exposeGlobalAPI should not throw with no target available (eg. under Node)', () => {
      assert.doesNotThrow(() => exposeGlobalAPI());
    });
  });

  // getAllTabsData() is the single call a crawler makes: it round-trips through the bridge to the
  // service worker, which collects every open tab's local getData() and returns the merged result.
  // Here the service worker is faked via attachFakeBridge, standing in for N open tabs.
  describe('Function getAllTabsData (crawler aggregation across tabs)', function () {
    beforeEach(function () {
      global.window = createFakeWindow();
      initClientToBridge(); // resolves the sendToBridge() promise when the fake bridge replies
    });

    afterEach(function () {
      delete global.window;
    });

    it('returns logs and stats aggregated from 3 open tabs, one array entry per tab', async function () {
      // One getData() snapshot per open tab, as the service worker collects them.
      const perTab = [
        {
          tabId: 11,
          logs: [{module: 'a', msg: 'tab1'}],
          stats: {'States saved': 1, initialURL: 'https://app.test/1'},
        },
        {
          tabId: 22,
          logs: [{module: 'b', msg: 'tab2'}],
          stats: {'States saved': 2, initialURL: 'https://app.test/2'},
        },
        {
          tabId: 33,
          logs: [{module: 'c', msg: 'tab3'}],
          stats: {'States saved': 3, initialURL: 'https://app.test/3'},
        },
      ];

      attachFakeBridge({
        win: global.window,
        // Stand in for the service worker: it merges each tab's snapshot into per-tab, tabId-tagged arrays.
        classify: msg => {
          assert.equal(msg.action, 'GET_ALL_TABS_DATA');
          return {
            logs: perTab.map(tab => ({tabId: tab.tabId, logs: tab.logs})),
            stats: perTab.map(tab => ({tabId: tab.tabId, stats: tab.stats})),
          };
        },
      });

      const data = await getAllTabsData();

      assert.equal(data.logs.length, 3);
      assert.equal(data.stats.length, 3);
      assert.deepEqual(
        data.logs,
        perTab.map(tab => ({tabId: tab.tabId, logs: tab.logs}))
      );
      assert.deepEqual(
        data.stats,
        perTab.map(tab => ({tabId: tab.tabId, stats: tab.stats}))
      );
    });
  });
});
