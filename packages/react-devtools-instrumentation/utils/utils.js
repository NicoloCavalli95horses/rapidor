//===================
// Import
//===================
import {config} from '../config.js';
import {sendToBridge} from './clientToBridge.js';

//===================
// Const
//===================
export const logs = [];

// Session metadata: captured once, the first time markExecutionStart() runs (ie. when the first
// HTTP event is tracked), so that printMetrics() can report how long RAPIDOR has been running.
let executionStartedAt = null;
let executionStartDate = null;
let initialURL = null;

// Centralized, flat store of every RAPIDOR self-metric (see metricKeys below).
// Values are plain numbers so the whole object can be dumped as-is into console.table.
export const metrics = {};

// Canonical metric names: every module that calls recordMetric() should use one of these,
// so metric names stay consistent and discoverable in one place instead of being sparse literals.
export const metricKeys = Object.freeze({
  STATES_SAVED: 'States saved',
  STATES_SKIPPED_DUPLICATE: 'States skipped (duplicate)',
  COMPONENTS_IN_LAST_SNAPSHOT: 'Components in last snapshot',
  MAX_COMPONENTS_SEEN: 'Max components seen in a snapshot',
  NODES_IN_LAST_SNAPSHOT: 'Nodes in last snapshot',

  HTTP_EVENTS_TRACKED: 'HTTP events tracked (in scope)',
  HTTP_EVENTS_SAVED: 'HTTP events saved',
  HTTP_EVENTS_SKIPPED_DUPLICATE: 'HTTP events skipped (duplicate)',
  HTTP_EVENTS_ANALYZED: 'HTTP events analyzed',

  NAV_EVENTS: 'Navigation events',

  PREINDEXED_VALUES: 'Preindexed values extracted',
  MATCHES_FOUND: 'Preindexed matches found',
  CANDIDATES_FOUND: 'Candidate instances found',

  REQUESTS_GENERATED: 'HTTP requests generated',
  REQUESTS_SKIPPED_DUPLICATE: 'Requests skipped (duplicate)',

  EVALUATIONS_PERFORMED: 'Response evaluations performed',
  PROP_DIFFERENCES_FOUND: 'Prop differences found',
  SENSITIVE_KEYS_DETECTED: 'Sensitive (authZ-relevant) keys detected',
  VULNERABILITIES_REPORTED: 'Potential IDOR reported',
});

//===================
// Functions
//===================
export function deepObjCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function copyObjKeys(obj = {}, keys = []) {
  return keys.reduce((acc, key) => {
    if (Object.hasOwn(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

// type: info | error | warning
export function log({module, type = 'info', msg, verboseOnly = false}) {
  const color = {
    error: 'color: red',
    info: 'color: white',
    warning: 'color: orange',
  };

  const canLog = config.verbose || !verboseOnly;
  if (!canLog) {
    return;
  }

  const descr = `%c[${config.toolName}] [${module.toUpperCase()}]`;

  console.log(descr, color[type], msg);
  logs.push(
    JSON.stringify({type, module, msg, timestamp: new Date().toISOString()})
  );
}

export function isCloneable(obj) {
  try {
    structuredClone(obj);
    return true;
  } catch {
    return false;
  }
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function payloadSize(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json).length;

  return {
    bytes,
    kb: (bytes / 1024).toFixed(2),
    mb: (bytes / (1024 * 1024)).toFixed(2),
  };
}

export async function getEstimatedIndexedDBstorage() {
  await navigator.storage.estimate();
}

export function hasOwnKeys(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

// Returns a wrapper function that check when fn is executed
// > Debounce (idle execution): executed after the idle debounceT
// > Throttling: force execution after throttleT under if under continuous load
export function debounceWithMaxTime(fn, {debounceT = 1000, maxT = 10000} = {}) {
  let debounceTimer = null;
  let maxTimer = null;
  let lastArgs = null;
  let lastThis = null;
  let startedAt = null;
  let running = false;

  function clear() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = null;
  }

  function clearMax() {
    if (maxTimer) {
      clearTimeout(maxTimer);
    }
    maxTimer = null;
    startedAt = null;
  }

  async function run() {
    if (running) return;
    running = true;

    clear();
    clearMax();

    try {
      await fn.apply(lastThis, lastArgs);
    } finally {
      running = false;
    }
  }

  return function (...args) {
    lastArgs = args;
    lastThis = this;

    const now = Date.now();

    if (!startedAt) {
      startedAt = now;

      maxTimer = setTimeout(run, maxT);
    }

    clear();

    debounceTimer = setTimeout(run, debounceT);
  };
}

// Runs async tasks (zero-arg functions returning a Promise) with at most `limit` running concurrently.
// Unlike a fixed Promise.all, this caps how many requests/operations are in flight at once.
export async function runWithConcurrency({tasks, limit = 1} = {}) {
  const results = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({length: Math.min(limit, tasks.length)}, worker);
  await Promise.all(workers);

  return results;
}

export function isSerializableValue(value) {
  if (value === null) {
    return true;
  }

  const t = typeof value;

  if (t === 'string' || t === 'boolean') {
    return true;
  }

  if (t === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return true;
  }

  if (t === 'object') {
    if (isPlainObject(value)) {
      return true;
    }

    return false;
  }
  return false;
}

export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function getCurrentDOM() {
  return new XMLSerializer().serializeToString(document);
}

export function printConfig() {
  const table = Object.entries(config).map(([key, value]) => ({
    key,
    value: Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'object'
        ? JSON.stringify(value)
        : value,
  }));

  console.table(table);
}

// Centralizes every RAPIDOR self-metric (how many states/components/HTTP events/etc. were found),
// which was previously scattered across modules as local counters (eg. responseEvaluator.totIdor).
// mode: sum (default, cumulative counter) | max (keeps the highest value seen) | set (last value wins, for point-in-time gauges)
export function recordMetric({key, value = 1, mode = 'sum'}) {
  const current = metrics[key] ?? 0;

  switch (mode) {
    case 'max':
      metrics[key] = Math.max(current, value);
      break;
    case 'set':
      metrics[key] = value;
      break;
    default:
      metrics[key] = current + value;
  }
}

// Marks the start of the execution window used by printMetrics() for the "Total execution time" stat.
// Called on every tracked HTTP event, but only the first call has an effect: later calls are no-ops.
export function markExecutionStart() {
  if (executionStartedAt !== null) {
    return;
  }

  executionStartedAt = Date.now();
  executionStartDate = new Date();
  // window is not available outside a browser context (eg. during unit tests)
  initialURL =
    typeof window !== 'undefined' && window.location
      ? window.location.href
      : undefined;
}

// Builds a plain-data snapshot of every RAPIDOR self-metric plus the session metadata
// (date, initial URL, total execution time). Shared by printMetrics() and getData(), so the
// console table and the programmatic API (window.__RAPIDOR__getData) never drift apart.
export function getStats() {
  const counters = Object.values(metricKeys).reduce((acc, key) => {
    acc[key] = metrics[key] ?? 0;
    return acc;
  }, {});

  return {
    ...counters,
    date: executionStartDate ? executionStartDate.toISOString() : null,
    initialURL: initialURL ?? null,
    executionTimeMs:
      executionStartedAt !== null ? Date.now() - executionStartedAt : 0,
  };
}

export function printMetrics() {
  const stats = getStats();

  const table = Object.values(metricKeys).map(key => ({
    metric: key,
    value: stats[key],
  }));

  // Session metadata, appended after the canonical self-metrics
  table.push(
    {
      metric: 'Date',
      value: stats.date ? new Date(stats.date).toLocaleDateString() : 'n/a',
    },
    {metric: 'Initial URL', value: stats.initialURL ?? 'n/a'},
    {metric: 'Total execution time (ms)', value: stats.executionTimeMs}
  );

  console.table(table);
}

// Returns every stored log entry, parsed back into an object (log() stores them as JSON strings).
// Falls back to the raw string for any entry that, for whatever reason, isn't valid JSON.
export function getLogs() {
  return logs.map(entry => {
    try {
      return JSON.parse(entry);
    } catch {
      return entry;
    }
  });
}

// Full data export for an external driver (eg. a crawler controlling the browser via
// Puppeteer/Playwright/CDP) to pull "from below" instead of going through the DOM overlay.
export function getData() {
  return {
    logs: getLogs(),
    stats: getStats(),
  };
}

// Crawler-facing entry point (exposed as window.__RAPIDOR__getData). A crawler drives several tabs
// in parallel but should pull RAPIDOR's results just once: this asks the service worker — which
// already tracks every registered tab — to collect each tab's local getData() and merge them.
// Logs and stats come back as arrays with one entry per tab, eg.
//   { logs: [{tab1}, {tab2}, ...], stats: [{tab1}, {tab2}, ...] }
export async function getAllTabsData({timeoutMs = 15000} = {}) {
  return sendToBridge({action: 'GET_ALL_TABS_DATA', timeoutMs});
}

// Exposes the crawler API on the page's global scope, so a crawler can call it via page.evaluate(),
// eg. `page.evaluate(() => window.__RAPIDOR__getData())`. Call once, from the extension's entry
// point: this is not a module-load side effect, so it stays easy to unit test with a fake target.
export function exposeGlobalAPI({
  target = typeof window !== 'undefined' ? window : undefined,
} = {}) {
  if (!target) {
    return;
  } // no global scope available (eg. running under Node in tests)
  // One call aggregates data from every open tab (round-trip through the service worker).
  target.__RAPIDOR__getData = getAllTabsData;
  // This tab's local snapshot only. The service worker invokes it (via the bridge) in each tab to
  // build the aggregate above; exposed separately so collecting one tab never re-enters aggregation.
  target.__RAPIDOR__getLocalData = getData;
}
