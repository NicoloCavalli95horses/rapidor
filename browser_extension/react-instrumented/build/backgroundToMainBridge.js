/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "../react-devtools-instrumentation/config.js":
/*!***************************************************!*\
  !*** ../react-devtools-instrumentation/config.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "config": () => (/* binding */ config)
/* harmony export */ });
const config = Object.freeze({
  toolName: 'RAPIDOR',
  mode: 'minimal',
  sessionID: crypto.randomUUID(),
  verbose: false,
  debounceTimeMs: 500,
  throttleTimeMs: 7000,
  timeBetweenRequests: 800,
  maxConcurrentRequests: 3,
  domainRequestOnly: true,
  domHandlerEnabled: false,
  maxStateSnapshots: 25,
  tagsWhitelist: [0, 7, 11, 15],
  maxExplorationDepth: 5,
  maxExplorationKeys: 100,
  maxSegmentsHistoryLength: 250,
  testClientSideQueryParamsUsage: true,
  sensitiveKeyThr: 0.6,
  huggingfaceModel: "Xenova/all-MiniLM-L6-v2",
  preindexedKeys: ['id', 'user', 'account', 'profile', 'order', 'resource', 'item', 'object', 'doc', 'name', 'key', 'title', 'type', 'url', 'link', 'owner', 'author', 'creator', 'role', 'permission', 'scope', 'content', 'node', 'slug']
});

/***/ }),

/***/ "../react-devtools-instrumentation/utils/clientToBridge.js":
/*!*****************************************************************!*\
  !*** ../react-devtools-instrumentation/utils/clientToBridge.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "initClientToBridge": () => (/* binding */ initClientToBridge),
/* harmony export */   "sendToBridge": () => (/* binding */ sendToBridge)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "../react-devtools-instrumentation/utils/utils.js");

const pendingRequests = new Map();
function sendToBridge({
  action,
  payload = {},
  timeoutMs = 10000
}) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Bridge timeout: ${action}`));
    }, timeoutMs);
    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout
    });
    window.postMessage({
      source: 'rapidor-main',
      type: 'REQUEST',
      requestId,
      action,
      payload
    }, window.location.origin);
  });
}
function initClientToBridge() {
  window.addEventListener('message', event => {
    if (event.source !== window) {
      return;
    }
    if (event.origin !== window.location.origin) {
      return;
    }
    const message = event.data;
    if (message?.source !== 'rapidor-bridge') {
      return;
    }
    if (message.type === 'COLLECT') {
      window.postMessage({
        source: 'rapidor-main',
        type: 'COLLECT_RESULT',
        requestId: message.requestId,
        result: (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.getData)()
      }, window.location.origin);
      return;
    }
    if (message.type !== 'RESPONSE') {
      return;
    }
    const pending = pendingRequests.get(message.requestId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    pendingRequests.delete(message.requestId);
    if (message.error) {
      pending.reject(new Error(message.error));
    } else {
      pending.resolve(message.result);
    }
  });
}

/***/ }),

/***/ "../react-devtools-instrumentation/utils/utils.js":
/*!********************************************************!*\
  !*** ../react-devtools-instrumentation/utils/utils.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "captureRuntimeErrors": () => (/* binding */ captureRuntimeErrors),
/* harmony export */   "copyObjKeys": () => (/* binding */ copyObjKeys),
/* harmony export */   "debounceWithMaxTime": () => (/* binding */ debounceWithMaxTime),
/* harmony export */   "deepObjCopy": () => (/* binding */ deepObjCopy),
/* harmony export */   "exposeGlobalAPI": () => (/* binding */ exposeGlobalAPI),
/* harmony export */   "getAllTabsData": () => (/* binding */ getAllTabsData),
/* harmony export */   "getCurrentDOM": () => (/* binding */ getCurrentDOM),
/* harmony export */   "getData": () => (/* binding */ getData),
/* harmony export */   "getEstimatedIndexedDBstorage": () => (/* binding */ getEstimatedIndexedDBstorage),
/* harmony export */   "getLogs": () => (/* binding */ getLogs),
/* harmony export */   "getStats": () => (/* binding */ getStats),
/* harmony export */   "hasOwnKeys": () => (/* binding */ hasOwnKeys),
/* harmony export */   "isCloneable": () => (/* binding */ isCloneable),
/* harmony export */   "isPlainObject": () => (/* binding */ isPlainObject),
/* harmony export */   "isSerializableValue": () => (/* binding */ isSerializableValue),
/* harmony export */   "log": () => (/* binding */ log),
/* harmony export */   "logs": () => (/* binding */ logs),
/* harmony export */   "markExecutionStart": () => (/* binding */ markExecutionStart),
/* harmony export */   "metricKeys": () => (/* binding */ metricKeys),
/* harmony export */   "metrics": () => (/* binding */ metrics),
/* harmony export */   "payloadSize": () => (/* binding */ payloadSize),
/* harmony export */   "printConfig": () => (/* binding */ printConfig),
/* harmony export */   "printMetrics": () => (/* binding */ printMetrics),
/* harmony export */   "recordMetric": () => (/* binding */ recordMetric),
/* harmony export */   "runWithConcurrency": () => (/* binding */ runWithConcurrency),
/* harmony export */   "sleep": () => (/* binding */ sleep)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config.js */ "../react-devtools-instrumentation/config.js");
/* harmony import */ var _clientToBridge_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./clientToBridge.js */ "../react-devtools-instrumentation/utils/clientToBridge.js");


const logs = [];
let executionStartedAt = null;
let executionStartDate = null;
let initialURL = null;
const metrics = {};
const metricKeys = Object.freeze({
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
  VULNERABILITIES_REPORTED: 'Vulnerability report'
});
function deepObjCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function copyObjKeys(obj = {}, keys = []) {
  return keys.reduce((acc, key) => {
    if (Object.hasOwn(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}
function log({
  module,
  type = 'info',
  msg,
  verboseOnly = false
}) {
  const color = {
    error: 'color: red',
    info: 'color: white',
    warning: 'color: orange'
  };
  const canLog = _config_js__WEBPACK_IMPORTED_MODULE_0__.config.verbose || !verboseOnly;
  if (!canLog) {
    return;
  }
  const descr = `%c[${_config_js__WEBPACK_IMPORTED_MODULE_0__.config.toolName}] [${module.toUpperCase()}]`;
  console.log(descr, color[type], msg);
  logs.push(JSON.stringify({
    type,
    module,
    msg,
    timestamp: new Date().toISOString()
  }));
}
let runtimeErrorsCaptured = false;
function captureRuntimeErrors() {
  if (runtimeErrorsCaptured || typeof window === 'undefined') {
    return;
  }
  runtimeErrorsCaptured = true;
  const seen = new Set();
  const report = msg => {
    const text = String(msg ?? 'unknown error');
    if (seen.has(text)) {
      return;
    }
    seen.add(text);
    log({
      module: 'runtime',
      type: 'error',
      msg: text
    });
  };
  window.addEventListener('error', e => report(e?.error?.stack ?? e?.message ?? e?.error));
  window.addEventListener('unhandledrejection', e => report(e?.reason?.stack ?? e?.reason?.message ?? e?.reason));
}
function isCloneable(obj) {
  try {
    structuredClone(obj);
    return true;
  } catch {
    return false;
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function payloadSize(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json).length;
  return {
    bytes,
    kb: (bytes / 1024).toFixed(2),
    mb: (bytes / (1024 * 1024)).toFixed(2)
  };
}
async function getEstimatedIndexedDBstorage() {
  await navigator.storage.estimate();
}
function hasOwnKeys(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}
function debounceWithMaxTime(fn, {
  debounceT = 1000,
  maxT = 10000
} = {}) {
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
async function runWithConcurrency({
  tasks,
  limit = 1
} = {}) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  const workers = Array.from({
    length: Math.min(limit, tasks.length)
  }, worker);
  await Promise.all(workers);
  return results;
}
function isSerializableValue(value) {
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
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function getCurrentDOM() {
  return new XMLSerializer().serializeToString(document);
}
function printConfig() {
  const table = Object.entries(_config_js__WEBPACK_IMPORTED_MODULE_0__.config).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : value
  }));
  console.table(table);
}
function recordMetric({
  key,
  value = 1,
  mode = 'sum'
}) {
  if (mode === 'unique') {
    if (!(metrics[key] instanceof Set)) {
      metrics[key] = new Set();
    }
    metrics[key].add(value);
    return;
  }
  if (value !== null && typeof value === 'object') {
    if (!Array.isArray(metrics[key])) {
      metrics[key] = [];
    }
    metrics[key].push(value);
    return;
  }
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
function markExecutionStart() {
  if (executionStartedAt !== null) {
    return;
  }
  executionStartedAt = Date.now();
  executionStartDate = new Date();
  initialURL = typeof window !== 'undefined' && window.location ? window.location.href : undefined;
}
function getStats() {
  const counters = Object.values(metricKeys).reduce((acc, key) => {
    const value = metrics[key];
    acc[key] = Array.isArray(value) || value instanceof Set ? [...value] : value ?? 0;
    return acc;
  }, {});
  return {
    ...counters,
    date: executionStartDate ? executionStartDate.toISOString() : null,
    initialURL: initialURL ?? null,
    executionTimeMs: executionStartedAt !== null ? Date.now() - executionStartedAt : 0
  };
}
function printMetrics() {
  const stats = getStats();
  const table = Object.values(metricKeys).map(key => ({
    metric: key,
    value: Array.isArray(stats[key]) ? stats[key].length : stats[key]
  }));
  table.push({
    metric: 'Date',
    value: stats.date ? new Date(stats.date).toLocaleDateString() : 'n/a'
  }, {
    metric: 'Initial URL',
    value: stats.initialURL ?? 'n/a'
  }, {
    metric: 'Total execution time (ms)',
    value: stats.executionTimeMs
  });
  console.table(table);
}
function getLogs() {
  return logs.map(entry => {
    try {
      return JSON.parse(entry);
    } catch {
      return entry;
    }
  });
}
function getData() {
  return {
    logs: getLogs(),
    stats: getStats()
  };
}
async function getAllTabsData({
  timeoutMs = 15000
} = {}) {
  return (0,_clientToBridge_js__WEBPACK_IMPORTED_MODULE_1__.sendToBridge)({
    action: 'GET_ALL_TABS_DATA',
    timeoutMs
  });
}
function exposeGlobalAPI({
  target = typeof window !== 'undefined' ? window : undefined
} = {}) {
  if (!target) {
    return;
  }
  target.__RAPIDOR__getData = getAllTabsData;
  target.__RAPIDOR__getLocalData = getData;
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!***********************************************************************************!*\
  !*** ../react-devtools-instrumentation/content_scripts/backgroundToMainBridge.js ***!
  \***********************************************************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _utils_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/utils.js */ "../react-devtools-instrumentation/utils/utils.js");

class backgroundToMainBridge {
  constructor() {}
  init() {
    chrome.runtime.sendMessage({
      action: 'REGISTER_TAB'
    });
    (0,_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)({
      module: 'content script',
      msg: 'Registered tab'
    });
    this.listenToClient();
    this.listenToServiceWorker();
  }
  listenToServiceWorker() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.action === 'GET_LOCAL_DATA') {
        this.collectLocalData().then(result => sendResponse({
          result
        })).catch(error => sendResponse({
          error: error.message
        }));
        return true;
      }
      (0,_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)({
        module: 'content script',
        msg: `Received from SW: ${message}`
      });
      sendResponse({
        success: true
      });
      return false;
    });
  }
  collectLocalData({
    timeoutMs = 10000
  } = {}) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error('Local data collection timeout'));
      }, timeoutMs);
      function onMessage(event) {
        if (event.source !== window) {
          return;
        }
        if (event.origin !== window.location.origin) {
          return;
        }
        const msg = event.data;
        if (msg?.source !== 'rapidor-main') {
          return;
        }
        if (msg.type !== 'COLLECT_RESULT') {
          return;
        }
        if (msg.requestId !== requestId) {
          return;
        }
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        resolve(msg.result);
      }
      window.addEventListener('message', onMessage);
      window.postMessage({
        source: 'rapidor-bridge',
        type: 'COLLECT',
        requestId
      }, window.location.origin);
    });
  }
  listenToClient() {
    window.addEventListener('message', async event => {
      if (event.source !== window) {
        return;
      }
      if (event.origin !== window.location.origin) {
        return;
      }
      const message = event.data;
      if (message?.source !== 'rapidor-main') {
        return;
      }
      if (message.type !== 'REQUEST') {
        return;
      }
      try {
        const result = await chrome.runtime.sendMessage({
          target: 'service-worker',
          action: message.action,
          payload: message.payload,
          requestId: message.requestId
        });
        window.postMessage({
          source: 'rapidor-bridge',
          type: 'RESPONSE',
          requestId: message.requestId,
          result
        }, window.location.origin);
      } catch (error) {
        window.postMessage({
          source: 'rapidor-bridge',
          type: 'RESPONSE',
          requestId: message.requestId,
          error: error.message
        }, window.location.origin);
      }
    });
  }
}
const bgToBridge = new backgroundToMainBridge();
bgToBridge.init();
})();

/******/ })()
;