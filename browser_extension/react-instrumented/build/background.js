/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/background/dynamicallyInjectContentScripts.js":
/*!***********************************************************!*\
  !*** ./src/background/dynamicallyInjectContentScripts.js ***!
  \***********************************************************/
/***/ (() => {

const contentScriptsToInject = [{
  id: '@react-devtools/proxy',
  js: ['build/proxy.js'],
  matches: ['<all_urls>'],
  persistAcrossSessions: true,
  runAt: 'document_start',
  world: chrome.scripting.ExecutionWorld.ISOLATED
}, {
  id: '@react-devtools/file-fetcher',
  js: ['build/fileFetcher.js'],
  matches: ['<all_urls>'],
  persistAcrossSessions: true,
  runAt: 'document_end',
  world: chrome.scripting.ExecutionWorld.ISOLATED
}, {
  id: '@react-devtools/fallback-eval-context',
  js: ['build/fallbackEvalContext.js'],
  matches: ['<all_urls>'],
  persistAcrossSessions: true,
  runAt: 'document_start',
  world: chrome.scripting.ExecutionWorld.MAIN
}, {
  id: '@react-devtools/hook',
  js: ['build/installHook.js'],
  matches: ['<all_urls>'],
  persistAcrossSessions: true,
  runAt: 'document_start',
  world: chrome.scripting.ExecutionWorld.MAIN
}, {
  id: '@react-devtools/hook-settings-injector',
  js: ['build/hookSettingsInjector.js'],
  matches: ['<all_urls>'],
  persistAcrossSessions: true,
  runAt: 'document_start'
}, {
  id: '@react-devtools/instrumentation',
  js: ['build/instrumentation.js'],
  matches: ['<all_urls>'],
  persistAcrossSessions: true,
  runAt: 'document_start',
  world: chrome.scripting.ExecutionWorld.MAIN
}, {
  id: '@react-devtools/backgroundToMainBridge',
  js: ['build/backgroundToMainBridge.js'],
  matches: ['<all_urls>'],
  persistAcrossSessions: true,
  runAt: 'document_start',
  world: chrome.scripting.ExecutionWorld.ISOLATED
}];
async function dynamicallyInjectContentScripts() {
  try {
    await chrome.scripting.unregisterContentScripts();
    await chrome.scripting.registerContentScripts(contentScriptsToInject);
  } catch (error) {
    console.error(error);
  }
}
dynamicallyInjectContentScripts();

/***/ }),

/***/ "./src/background/executeScript.js":
/*!*****************************************!*\
  !*** ./src/background/executeScript.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "executeScriptInIsolatedWorld": () => (/* binding */ executeScriptInIsolatedWorld),
/* harmony export */   "executeScriptInMainWorld": () => (/* binding */ executeScriptInMainWorld)
/* harmony export */ });
function executeScriptInIsolatedWorld({
  target,
  files
}) {
  return chrome.scripting.executeScript({
    target,
    files,
    world: chrome.scripting.ExecutionWorld.ISOLATED
  });
}
function executeScriptInMainWorld({
  target,
  files,
  injectImmediately
}) {
  return chrome.scripting.executeScript({
    target,
    files,
    injectImmediately,
    world: chrome.scripting.ExecutionWorld.MAIN
  });
}

/***/ }),

/***/ "./src/background/messageHandlers.js":
/*!*******************************************!*\
  !*** ./src/background/messageHandlers.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "handleBackendManagerMessage": () => (/* binding */ handleBackendManagerMessage),
/* harmony export */   "handleDevToolsPageMessage": () => (/* binding */ handleDevToolsPageMessage),
/* harmony export */   "handleFetchResourceContentScriptMessage": () => (/* binding */ handleFetchResourceContentScriptMessage),
/* harmony export */   "handleReactDevToolsHookMessage": () => (/* binding */ handleReactDevToolsHookMessage)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/constants */ "../react-devtools-shared/src/constants.js");
/* harmony import */ var _setExtensionIconAndPopup__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./setExtensionIconAndPopup */ "./src/background/setExtensionIconAndPopup.js");
/* harmony import */ var _executeScript__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./executeScript */ "./src/background/executeScript.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./src/utils.js");




function handleReactDevToolsHookMessage(message, sender) {
  const {
    payload
  } = message;
  switch (payload?.type) {
    case 'react-renderer-attached':
      {
        (0,_setExtensionIconAndPopup__WEBPACK_IMPORTED_MODULE_1__["default"])(payload.reactBuildType, sender.tab.id);
        break;
      }
  }
}
function handleBackendManagerMessage(message, sender) {
  const {
    payload
  } = message;
  switch (payload?.type) {
    case 'require-backends':
      {
        payload.versions.forEach(version => {
          if (_utils__WEBPACK_IMPORTED_MODULE_3__.EXTENSION_CONTAINED_VERSIONS.includes(version)) {
            (0,_executeScript__WEBPACK_IMPORTED_MODULE_2__.executeScriptInMainWorld)({
              injectImmediately: true,
              target: {
                tabId: sender.tab.id
              },
              files: [`/build/react_devtools_backend_${version}.js`]
            });
          }
        });
        break;
      }
  }
}
function handleDevToolsPageMessage(message) {
  const {
    payload
  } = message;
  switch (payload?.type) {
    case 'fetch-file-with-cache':
      {
        const {
          payload: {
            tabId,
            url
          }
        } = message;
        if (!tabId || !url) {
          chrome.runtime.sendMessage({
            source: 'react-devtools-background',
            payload: {
              type: 'fetch-file-with-cache-error',
              url,
              value: null
            }
          });
        } else {
          chrome.tabs.sendMessage(tabId, {
            source: 'devtools-page',
            payload: {
              type: 'fetch-file-with-cache',
              url
            }
          });
        }
        break;
      }
    case 'inject-backend-manager':
      {
        const {
          payload: {
            tabId
          }
        } = message;
        if (!tabId) {
          throw new Error("Couldn't inject backend manager: tabId not specified");
        }
        (0,_executeScript__WEBPACK_IMPORTED_MODULE_2__.executeScriptInMainWorld)({
          injectImmediately: true,
          target: {
            tabId
          },
          files: ['/build/backendManager.js']
        }).then(() => {
          if (react_devtools_shared_src_constants__WEBPACK_IMPORTED_MODULE_0__.__DEBUG__) {
            console.log('Successfully injected backend manager');
          }
        }, reason => {
          console.error('Failed to inject backend manager:', reason);
        });
        break;
      }
    case 'eval-in-inspected-window':
      {
        const {
          payload: {
            tabId,
            requestId,
            scriptId,
            args
          }
        } = message;
        chrome.tabs.sendMessage(tabId, {
          source: 'devtools-page-eval',
          payload: {
            scriptId,
            args
          }
        }).then(response => {
          if (!response) {
            chrome.runtime.sendMessage({
              source: 'react-devtools-background',
              payload: {
                type: 'eval-in-inspected-window-response',
                requestId,
                result: null,
                error: 'No response from content script'
              }
            });
            return;
          }
          const {
            result,
            error
          } = response;
          chrome.runtime.sendMessage({
            source: 'react-devtools-background',
            payload: {
              type: 'eval-in-inspected-window-response',
              requestId,
              result,
              error
            }
          });
        }).catch(error => {
          chrome.runtime.sendMessage({
            source: 'react-devtools-background',
            payload: {
              type: 'eval-in-inspected-window-response',
              requestId,
              result: null,
              error: error?.message || String(error)
            }
          });
        });
        break;
      }
  }
}
function handleFetchResourceContentScriptMessage(message) {
  const {
    payload
  } = message;
  switch (payload?.type) {
    case 'fetch-file-with-cache-complete':
    case 'fetch-file-with-cache-error':
      chrome.runtime.sendMessage({
        source: 'react-devtools-background',
        payload
      });
      break;
  }
}

/***/ }),

/***/ "./src/background/serviceWorker.js":
/*!*****************************************!*\
  !*** ./src/background/serviceWorker.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ServiceWorker": () => (/* binding */ ServiceWorker)
/* harmony export */ });
/* harmony import */ var _react_devtools_instrumentation_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../react-devtools-instrumentation/utils/utils.js */ "../react-devtools-instrumentation/utils/utils.js");
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils.js */ "./src/background/utils.js");


class ServiceWorker {
  constructor() {
    this.initialized = false;
    this.tabs = new Set();
    this.collecting = null;
    this.onMessage = this.onMessage.bind(this);
    this.onTabRemoved = this.onTabRemoved.bind(this);
  }
  async init() {
    if (this.initialized) {
      return;
    }
    chrome.runtime.onMessage.addListener(this.onMessage);
    chrome.tabs.onRemoved.addListener(this.onTabRemoved);
    await (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.createOffscreenDocument)();
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'INITIALIZE_MODEL'
    });
    if (response.success) {
      this.initialized = true;
      (0,_react_devtools_instrumentation_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)({
        module: 'service worker',
        msg: 'Initialized'
      });
    }
  }
  onMessage(message, sender, sendResponse) {
    if (message.action === 'REGISTER_TAB' && sender.tab?.id != undefined) {
      const tabId = sender.tab.id;
      this.tabs.add(tabId);
      (0,_react_devtools_instrumentation_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)({
        module: 'service worker',
        msg: `Registered new tab: ${[...this.tabs]}`
      });
      sendResponse({
        success: true,
        tabId
      });
      return false;
    }
    if (message.action === 'GET_ALL_TABS_DATA') {
      this.collectAllTabsData().then(data => sendResponse(data)).catch(error => sendResponse({
        error: error.message
      }));
      return true;
    }
    if (message.action === 'CLASSIFY_KEYS') {
      if (!Array.isArray(message.payload)) {
        sendResponse({
          error: 'payload must be an array'
        });
        return false;
      }
      this.classifyKeys({
        keys: message.payload
      }).then(results => sendResponse({
        results
      })).catch(error => {
        console.error('[background] Classification error:', error);
        sendResponse({
          error: error.message
        });
      });
      return true;
    }
    return false;
  }
  async classifyKeys({
    keys
  }) {
    const results = [];
    const cacheKeys = keys.map(key => `classification:${key}`);
    const cached = await chrome.storage.local.get(cacheKeys);
    const keysToClassify = [];
    for (const key of keys) {
      const cacheKey = `classification:${key}`;
      if (cached[cacheKey] !== undefined) {
        results.push(cached[cacheKey]);
      } else {
        keysToClassify.push(key);
      }
    }
    if (keysToClassify.length > 0) {
      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'CLASSIFY_KEYS',
        payload: keysToClassify
      });
      if (response?.error) {
        throw new Error(response.error);
      }
      if (!Array.isArray(response?.results) || response.results.length !== keysToClassify.length) {
        throw new Error('Invalid classification response');
      }
      const cacheEntries = {};
      for (let i = 0; i < keysToClassify.length; i++) {
        const key = keysToClassify[i];
        const result = response.results[i];
        results.push(result);
        cacheEntries[`classification:${key}`] = result;
      }
      await chrome.storage.local.set(cacheEntries);
    }
    return results;
  }
  onTabRemoved(tabId) {
    this.tabs.delete(tabId);
    (0,_react_devtools_instrumentation_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)({
      module: 'service worker',
      msg: `Removed tab: ${tabId}`
    });
  }
  async sendMessage(tabId, action, target = 'content-script', payload = {}) {
    return chrome.tabs.sendMessage(tabId, {
      target,
      action,
      payload
    });
  }
  async broadcast(action, payload = {}) {
    const tabIds = [...this.tabs];
    const results = await Promise.allSettled(tabIds.map(tabId => this.sendMessage(tabId, action, payload)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        (0,_react_devtools_instrumentation_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)({
          module: 'service worker',
          msg: `Failed to send to tab ${tabIds[index]}: ${result.reason}`
        });
        this.tabs.delete(tabIds[index]);
      }
    });
    return results.map((result, index) => ({
      tabId: tabIds[index],
      ...result
    }));
  }
  async collectAllTabsData() {
    if (this.collecting) {
      return this.collecting;
    }
    this.collecting = this.doCollectAllTabsData().finally(() => {
      this.collecting = null;
    });
    return this.collecting;
  }
  async doCollectAllTabsData() {
    const tabIds = [...this.tabs];
    const settled = await Promise.allSettled(tabIds.map(tabId => this.sendMessage(tabId, 'GET_LOCAL_DATA', 'content-script')));
    const tabsData = [];
    settled.forEach((outcome, index) => {
      const tabId = tabIds[index];
      const data = outcome.status === 'fulfilled' ? outcome.value?.result : undefined;
      if (!data) {
        (0,_react_devtools_instrumentation_utils_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)({
          module: 'service worker',
          msg: `No data from tab ${tabId}, dropping it`
        });
        this.tabs.delete(tabId);
        return;
      }
      tabsData.push({
        tabId,
        logs: data.logs,
        stats: data.stats
      });
    });
    return tabsData;
  }
  destroy() {
    chrome.runtime.onMessage.removeListener(this.onMessage);
    chrome.tabs.onRemoved.removeListener(this.onTabRemoved);
    this.initialized = false;
  }
}

/***/ }),

/***/ "./src/background/setExtensionIconAndPopup.js":
/*!****************************************************!*\
  !*** ./src/background/setExtensionIconAndPopup.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });


function setExtensionIconAndPopup(reactBuildType, tabId) {
  chrome.action.setIcon({
    tabId,
    path: {
      '16': chrome.runtime.getURL(`icons/16-${reactBuildType}.png`),
      '32': chrome.runtime.getURL(`icons/32-${reactBuildType}.png`),
      '48': chrome.runtime.getURL(`icons/48-${reactBuildType}.png`),
      '128': chrome.runtime.getURL(`icons/128-${reactBuildType}.png`)
    }
  });
  chrome.action.setPopup({
    tabId,
    popup: chrome.runtime.getURL(`popups/${reactBuildType}.html`)
  });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (setExtensionIconAndPopup);

/***/ }),

/***/ "./src/background/tabsManager.js":
/*!***************************************!*\
  !*** ./src/background/tabsManager.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _setExtensionIconAndPopup__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./setExtensionIconAndPopup */ "./src/background/setExtensionIconAndPopup.js");



function isRestrictedBrowserPage(url) {
  if (!url) {
    return true;
  }
  const urlProtocol = new URL(url).protocol;
  return urlProtocol === 'chrome:' || urlProtocol === 'about:';
}
function checkAndHandleRestrictedPageIfSo(tab) {
  if (tab && isRestrictedBrowserPage(tab.url)) {
    (0,_setExtensionIconAndPopup__WEBPACK_IMPORTED_MODULE_0__["default"])('restricted', tab.id);
  }
}
chrome.tabs.query({}, tabs => tabs.forEach(checkAndHandleRestrictedPageIfSo));
chrome.tabs.onCreated.addListener(tab => checkAndHandleRestrictedPageIfSo(tab));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && isRestrictedBrowserPage(changeInfo.url)) {
    (0,_setExtensionIconAndPopup__WEBPACK_IMPORTED_MODULE_0__["default"])('restricted', tabId);
  }
});

/***/ }),

/***/ "./src/background/utils.js":
/*!*********************************!*\
  !*** ./src/background/utils.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createOffscreenDocument": () => (/* binding */ createOffscreenDocument)
/* harmony export */ });
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
let creatingOffscreenDocument = null;
async function createOffscreenDocument() {
  if (creatingOffscreenDocument) {
    return creatingOffscreenDocument;
  }
  creatingOffscreenDocument = (async () => {
    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    if (contexts.length > 0) {
      return;
    }
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["WORKERS"],
      justification: "Execute Hugging Face Transformers"
    });
  })();
  try {
    await creatingOffscreenDocument;
  } finally {
    creatingOffscreenDocument = null;
  }
}

/***/ }),

/***/ "./src/constants.js":
/*!**************************!*\
  !*** ./src/constants.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EXTENSION_BRIDGE_CONNECTION_DISCONNECTED": () => (/* binding */ EXTENSION_BRIDGE_CONNECTION_DISCONNECTED),
/* harmony export */   "EXTENSION_BRIDGE_CONNECTION_READY": () => (/* binding */ EXTENSION_BRIDGE_CONNECTION_READY),
/* harmony export */   "getExtensionBridgeConnectionType": () => (/* binding */ getExtensionBridgeConnectionType)
/* harmony export */ });
const EXTENSION_BRIDGE_CONNECTION_READY = 'react-devtools-extension-bridge-connection-ready';
const EXTENSION_BRIDGE_CONNECTION_DISCONNECTED = 'react-devtools-extension-bridge-connection-disconnected';
function getExtensionBridgeConnectionType(message) {
  if (message === null || typeof message !== 'object' || !('source' in message) || message.source !== 'react-devtools-background' || !('payload' in message)) {
    return null;
  }
  const payload = message.payload;
  if (payload === null || typeof payload !== 'object' || !('type' in payload)) {
    return null;
  }
  const type = payload.type;
  if (type === EXTENSION_BRIDGE_CONNECTION_READY) {
    return EXTENSION_BRIDGE_CONNECTION_READY;
  }
  if (type === EXTENSION_BRIDGE_CONNECTION_DISCONNECTED) {
    return EXTENSION_BRIDGE_CONNECTION_DISCONNECTED;
  }
  return null;
}

/***/ }),

/***/ "./src/utils.js":
/*!**********************!*\
  !*** ./src/utils.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COMPACT_VERSION_NAME": () => (/* binding */ COMPACT_VERSION_NAME),
/* harmony export */   "EXTENSION_CONTAINED_VERSIONS": () => (/* binding */ EXTENSION_CONTAINED_VERSIONS),
/* harmony export */   "getBrowserTheme": () => (/* binding */ getBrowserTheme)
/* harmony export */ });
function getBrowserTheme() {
  if (true) {
    return chrome.devtools.panels.themeName === 'dark' ? 'dark' : 'light';
  } else {}
}
const COMPACT_VERSION_NAME = 'compact';
const EXTENSION_CONTAINED_VERSIONS = [COMPACT_VERSION_NAME];

/***/ }),

/***/ "../react-devtools-instrumentation/config.js":
/*!***************************************************!*\
  !*** ../react-devtools-instrumentation/config.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

/***/ }),

/***/ "../react-devtools-shared/src/constants.js":
/*!*************************************************!*\
  !*** ../react-devtools-shared/src/constants.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ANSI_STYLE_DIMMING_TEMPLATE": () => (/* binding */ ANSI_STYLE_DIMMING_TEMPLATE),
/* harmony export */   "ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK": () => (/* binding */ ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK),
/* harmony export */   "CHROME_WEBSTORE_EXTENSION_ID": () => (/* binding */ CHROME_WEBSTORE_EXTENSION_ID),
/* harmony export */   "FIREFOX_CONSOLE_DIMMING_COLOR": () => (/* binding */ FIREFOX_CONSOLE_DIMMING_COLOR),
/* harmony export */   "INTERNAL_EXTENSION_ID": () => (/* binding */ INTERNAL_EXTENSION_ID),
/* harmony export */   "LOCAL_EXTENSION_ID": () => (/* binding */ LOCAL_EXTENSION_ID),
/* harmony export */   "LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR": () => (/* binding */ LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR),
/* harmony export */   "LOCAL_STORAGE_BROWSER_THEME": () => (/* binding */ LOCAL_STORAGE_BROWSER_THEME),
/* harmony export */   "LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY": () => (/* binding */ LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY),
/* harmony export */   "LOCAL_STORAGE_DEFAULT_TAB_KEY": () => (/* binding */ LOCAL_STORAGE_DEFAULT_TAB_KEY),
/* harmony export */   "LOCAL_STORAGE_OPEN_IN_EDITOR_URL": () => (/* binding */ LOCAL_STORAGE_OPEN_IN_EDITOR_URL),
/* harmony export */   "LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET": () => (/* binding */ LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET),
/* harmony export */   "LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY": () => (/* binding */ LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY),
/* harmony export */   "LOCAL_STORAGE_SUPPORTS_PROFILING_KEY": () => (/* binding */ LOCAL_STORAGE_SUPPORTS_PROFILING_KEY),
/* harmony export */   "LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY": () => (/* binding */ LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY),
/* harmony export */   "PROFILER_EXPORT_VERSION": () => (/* binding */ PROFILER_EXPORT_VERSION),
/* harmony export */   "PROFILING_FLAG_BASIC_SUPPORT": () => (/* binding */ PROFILING_FLAG_BASIC_SUPPORT),
/* harmony export */   "PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT": () => (/* binding */ PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT),
/* harmony export */   "SESSION_STORAGE_LAST_SELECTION_KEY": () => (/* binding */ SESSION_STORAGE_LAST_SELECTION_KEY),
/* harmony export */   "SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY": () => (/* binding */ SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY),
/* harmony export */   "SESSION_STORAGE_RELOAD_AND_PROFILE_KEY": () => (/* binding */ SESSION_STORAGE_RELOAD_AND_PROFILE_KEY),
/* harmony export */   "SUSPENSE_TREE_OPERATION_ADD": () => (/* binding */ SUSPENSE_TREE_OPERATION_ADD),
/* harmony export */   "SUSPENSE_TREE_OPERATION_REMOVE": () => (/* binding */ SUSPENSE_TREE_OPERATION_REMOVE),
/* harmony export */   "SUSPENSE_TREE_OPERATION_REORDER_CHILDREN": () => (/* binding */ SUSPENSE_TREE_OPERATION_REORDER_CHILDREN),
/* harmony export */   "SUSPENSE_TREE_OPERATION_RESIZE": () => (/* binding */ SUSPENSE_TREE_OPERATION_RESIZE),
/* harmony export */   "SUSPENSE_TREE_OPERATION_SUSPENDERS": () => (/* binding */ SUSPENSE_TREE_OPERATION_SUSPENDERS),
/* harmony export */   "TREE_OPERATION_ADD": () => (/* binding */ TREE_OPERATION_ADD),
/* harmony export */   "TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE": () => (/* binding */ TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE),
/* harmony export */   "TREE_OPERATION_REMOVE": () => (/* binding */ TREE_OPERATION_REMOVE),
/* harmony export */   "TREE_OPERATION_REORDER_CHILDREN": () => (/* binding */ TREE_OPERATION_REORDER_CHILDREN),
/* harmony export */   "TREE_OPERATION_SET_SUBTREE_MODE": () => (/* binding */ TREE_OPERATION_SET_SUBTREE_MODE),
/* harmony export */   "TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS": () => (/* binding */ TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS),
/* harmony export */   "TREE_OPERATION_UPDATE_TREE_BASE_DURATION": () => (/* binding */ TREE_OPERATION_UPDATE_TREE_BASE_DURATION),
/* harmony export */   "UNKNOWN_SUSPENDERS_NONE": () => (/* binding */ UNKNOWN_SUSPENDERS_NONE),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_OLD_VERSION": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_OLD_VERSION),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_PRODUCTION": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_PRODUCTION),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE),
/* harmony export */   "__DEBUG__": () => (/* binding */ __DEBUG__),
/* harmony export */   "__PERFORMANCE_PROFILE__": () => (/* binding */ __PERFORMANCE_PROFILE__)
/* harmony export */ });
const CHROME_WEBSTORE_EXTENSION_ID = 'fmkadmapgofadopljbjfkapdkoienihi';
const INTERNAL_EXTENSION_ID = 'dnjnjgbfilfphmojnmhliehogmojhclc';
const LOCAL_EXTENSION_ID = 'ikiahnapldjmdmpkmfhjdjilojjhgcbf';
const __DEBUG__ = false;
const __PERFORMANCE_PROFILE__ = false;
const TREE_OPERATION_ADD = 1;
const TREE_OPERATION_REMOVE = 2;
const TREE_OPERATION_REORDER_CHILDREN = 3;
const TREE_OPERATION_UPDATE_TREE_BASE_DURATION = 4;
const TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS = 5;
const TREE_OPERATION_SET_SUBTREE_MODE = 7;
const SUSPENSE_TREE_OPERATION_ADD = 8;
const SUSPENSE_TREE_OPERATION_REMOVE = 9;
const SUSPENSE_TREE_OPERATION_REORDER_CHILDREN = 10;
const SUSPENSE_TREE_OPERATION_RESIZE = 11;
const SUSPENSE_TREE_OPERATION_SUSPENDERS = 12;
const TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE = 13;
const PROFILING_FLAG_BASIC_SUPPORT = 0b001;
const PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT = 0b100;
const UNKNOWN_SUSPENDERS_NONE = 0;
const UNKNOWN_SUSPENDERS_REASON_PRODUCTION = 1;
const UNKNOWN_SUSPENDERS_REASON_OLD_VERSION = 2;
const UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE = 3;
const LOCAL_STORAGE_DEFAULT_TAB_KEY = 'React::DevTools::defaultTab';
const LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY = 'React::DevTools::componentFilters';
const SESSION_STORAGE_LAST_SELECTION_KEY = 'React::DevTools::lastSelection';
const LOCAL_STORAGE_OPEN_IN_EDITOR_URL = 'React::DevTools::openInEditorUrl';
const LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET = 'React::DevTools::openInEditorUrlPreset';
const LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR = 'React::DevTools::alwaysOpenInEditor';
const LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY = 'React::DevTools::parseHookNames';
const SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY = 'React::DevTools::recordChangeDescriptions';
const SESSION_STORAGE_RELOAD_AND_PROFILE_KEY = 'React::DevTools::reloadAndProfile';
const LOCAL_STORAGE_BROWSER_THEME = 'React::DevTools::theme';
const LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY = 'React::DevTools::traceUpdatesEnabled';
const LOCAL_STORAGE_SUPPORTS_PROFILING_KEY = 'React::DevTools::supportsProfiling';
const PROFILER_EXPORT_VERSION = 5;
const FIREFOX_CONSOLE_DIMMING_COLOR = 'color: rgba(124, 124, 124, 0.75)';
const ANSI_STYLE_DIMMING_TEMPLATE = '\x1b[2;38;2;124;124;124m%s\x1b[0m';
const ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK = '\x1b[2;38;2;124;124;124m%s %o\x1b[0m';

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
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
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
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!*********************************!*\
  !*** ./src/background/index.js ***!
  \*********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _dynamicallyInjectContentScripts__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dynamicallyInjectContentScripts */ "./src/background/dynamicallyInjectContentScripts.js");
/* harmony import */ var _dynamicallyInjectContentScripts__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_dynamicallyInjectContentScripts__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _tabsManager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tabsManager */ "./src/background/tabsManager.js");
/* harmony import */ var _serviceWorker_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./serviceWorker.js */ "./src/background/serviceWorker.js");
/* harmony import */ var _messageHandlers__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./messageHandlers */ "./src/background/messageHandlers.js");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../constants */ "./src/constants.js");







(async () => {
  const s = new _serviceWorker_js__WEBPACK_IMPORTED_MODULE_2__.ServiceWorker();
  await s.init();
})();
const ports = {};
function registerTab(tabId) {
  if (!ports[tabId]) {
    ports[tabId] = {
      extension: null,
      proxy: null,
      disconnectPipe: null
    };
  }
}
function registerExtensionPort(port, tabId) {
  ports[tabId].extension = port;
  port.onDisconnect.addListener(() => {
    ports[tabId].disconnectPipe?.();
    ports[tabId].extension = null;
  });
}
function registerProxyPort(port, tabId) {
  ports[tabId].proxy = port;
  port.onDisconnect.addListener(() => {
    ports[tabId].disconnectPipe?.();
    ports[tabId].proxy = null;
  });
}
function isNumeric(str) {
  return +str + '' === str;
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'proxy') {
    if (port.sender?.tab?.id == null) {
      return;
    }
    const tabId = port.sender.tab.id;
    const registeredPort = ports[tabId];
    const proxy = registeredPort?.proxy;
    if (proxy) {
      registeredPort.disconnectPipe?.();
      proxy.disconnect();
    }
    registerTab(tabId);
    registerProxyPort(port, tabId);
    if (ports[tabId].extension) {
      connectExtensionAndProxyPorts(ports[tabId].extension, ports[tabId].proxy, tabId);
    }
    return;
  }
  if (isNumeric(port.name)) {
    const tabId = +port.name;
    registerTab(tabId);
    registerExtensionPort(port, tabId);
    if (ports[tabId].proxy) {
      connectExtensionAndProxyPorts(ports[tabId].extension, ports[tabId].proxy, tabId);
    }
    return;
  }
  console.warn(`Unknown port ${port.name} connected`);
});
function connectExtensionAndProxyPorts(maybeExtensionPort, maybeProxyPort, tabId) {
  if (!maybeExtensionPort) {
    throw new Error(`Attempted to connect ports, when extension port is not present`);
  }
  const extensionPort = maybeExtensionPort;
  if (!maybeProxyPort) {
    throw new Error(`Attempted to connect ports, when proxy port is not present`);
  }
  const proxyPort = maybeProxyPort;
  function sendBridgeConnectionMessage(port, type) {
    try {
      port.postMessage({
        source: 'react-devtools-background',
        payload: {
          type
        }
      });
    } catch (error) {}
  }
  if (ports[tabId].disconnectPipe) {
    throw new Error(`Attempted to connect already connected ports for tab with id ${tabId}`);
  }
  let didDisconnect = false;
  function extensionPortMessageListener(message) {
    try {
      proxyPort.postMessage(message);
    } catch (e) {
      if (true) {
        console.log(`Broken pipe ${tabId}: `, e);
      }
      disconnectListener();
    }
  }
  function proxyPortMessageListener(message) {
    try {
      extensionPort.postMessage(message);
    } catch (e) {
      if (true) {
        console.log(`Broken pipe ${tabId}: `, e);
      }
      disconnectListener();
    }
  }
  function disconnectListener() {
    if (didDisconnect) {
      return;
    }
    didDisconnect = true;
    extensionPort.onMessage.removeListener(extensionPortMessageListener);
    proxyPort.onMessage.removeListener(proxyPortMessageListener);
    sendBridgeConnectionMessage(extensionPort, _constants__WEBPACK_IMPORTED_MODULE_4__.EXTENSION_BRIDGE_CONNECTION_DISCONNECTED);
    sendBridgeConnectionMessage(proxyPort, _constants__WEBPACK_IMPORTED_MODULE_4__.EXTENSION_BRIDGE_CONNECTION_DISCONNECTED);
    delete ports[tabId].disconnectPipe;
  }
  ports[tabId].disconnectPipe = disconnectListener;
  extensionPort.onMessage.addListener(extensionPortMessageListener);
  proxyPort.onMessage.addListener(proxyPortMessageListener);
  extensionPort.onDisconnect.addListener(disconnectListener);
  proxyPort.onDisconnect.addListener(disconnectListener);
  sendBridgeConnectionMessage(proxyPort, _constants__WEBPACK_IMPORTED_MODULE_4__.EXTENSION_BRIDGE_CONNECTION_READY);
}
chrome.runtime.onMessage.addListener((message, sender) => {
  switch (message?.source) {
    case 'devtools-page':
      {
        (0,_messageHandlers__WEBPACK_IMPORTED_MODULE_3__.handleDevToolsPageMessage)(message);
        break;
      }
    case 'react-devtools-fetch-resource-content-script':
      {
        (0,_messageHandlers__WEBPACK_IMPORTED_MODULE_3__.handleFetchResourceContentScriptMessage)(message);
        break;
      }
    case 'react-devtools-backend-manager':
      {
        (0,_messageHandlers__WEBPACK_IMPORTED_MODULE_3__.handleBackendManagerMessage)(message, sender);
        break;
      }
    case 'react-devtools-hook':
      {
        (0,_messageHandlers__WEBPACK_IMPORTED_MODULE_3__.handleReactDevToolsHookMessage)(message, sender);
      }
  }
});
chrome.tabs.onActivated.addListener(({
  tabId: activeTabId
}) => {
  for (const registeredTabId in ports) {
    if (ports[registeredTabId].proxy != null && ports[registeredTabId].extension != null) {
      const numericRegisteredTabId = +registeredTabId;
      const event = activeTabId === numericRegisteredTabId ? 'resumeElementPolling' : 'pauseElementPolling';
      ports[registeredTabId].extension.postMessage({
        event
      });
    }
  }
});
})();

/******/ })()
;