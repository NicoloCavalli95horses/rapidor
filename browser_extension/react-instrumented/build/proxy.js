/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/constants.js":
/*!**************************!*\
  !*** ./src/constants.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/*!*************************************!*\
  !*** ./src/contentScripts/proxy.js ***!
  \*************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../constants */ "./src/constants.js");



function injectProxy() {
  isTransportActive = true;
  if (!window.__REACT_DEVTOOLS_PROXY_INJECTED__) {
    window.__REACT_DEVTOOLS_PROXY_INJECTED__ = true;
    listenToMessagesFromBackend();
    connectPort();
    sayHelloToBackendManager();
    backendManagerHelloIntervalID = setInterval(() => {
      if (backendInitialized) {
        stopPollingForBackendManager();
      } else {
        sayHelloToBackendManager();
      }
    }, 500);
  }
}
function handlePageShow() {
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', injectProxy, {
      once: true
    });
  } else {
    injectProxy();
  }
}
window.addEventListener('pagereveal', injectProxy);
window.addEventListener('pageshow', handlePageShow);
window.addEventListener('pagehide', function ({
  target
}) {
  if (target !== window.document) {
    return;
  }
  isTransportActive = false;
  backendInitialized = false;
  isBridgeConnected = false;
  pendingMessages.length = 0;
  stopPollingForBackendManager();
  delete window.__REACT_DEVTOOLS_PROXY_INJECTED__;
});
let port = null;
let isTransportActive = true;
let backendInitialized = false;
let isBridgeConnected = false;
let isListeningToMessagesFromBackend = false;
const pendingMessages = [];
let backendManagerHelloIntervalID = null;
function stopPollingForBackendManager() {
  if (backendManagerHelloIntervalID !== null) {
    clearInterval(backendManagerHelloIntervalID);
    backendManagerHelloIntervalID = null;
  }
}
function listenToMessagesFromBackend() {
  if (!isListeningToMessagesFromBackend) {
    window.addEventListener('message', handleMessageFromPage);
    isListeningToMessagesFromBackend = true;
  }
}
function flushPendingMessages() {
  const currentPort = port;
  if (!isBridgeConnected || currentPort === null) {
    return false;
  }
  let sentCount = 0;
  while (sentCount < pendingMessages.length) {
    try {
      currentPort.postMessage(pendingMessages[sentCount]);
      sentCount++;
    } catch (error) {
      isBridgeConnected = false;
      break;
    }
  }
  if (sentCount > 0) {
    pendingMessages.splice(0, sentCount);
  }
  return isBridgeConnected && pendingMessages.length === 0;
}
function sayHelloToBackendManager() {
  window.postMessage({
    source: 'react-devtools-content-script',
    hello: true
  }, '*');
}
function handleMessageFromDevtools(sourcePort, message) {
  if (!isTransportActive || port !== sourcePort) {
    return;
  }
  switch ((0,_constants__WEBPACK_IMPORTED_MODULE_0__.getExtensionBridgeConnectionType)(message)) {
    case _constants__WEBPACK_IMPORTED_MODULE_0__.EXTENSION_BRIDGE_CONNECTION_READY:
      isBridgeConnected = true;
      if (flushPendingMessages()) {
        const currentPort = port;
        if (currentPort === null) {
          return;
        }
        try {
          currentPort.postMessage(message);
        } catch (error) {
          isBridgeConnected = false;
        }
      }
      return;
    case _constants__WEBPACK_IMPORTED_MODULE_0__.EXTENSION_BRIDGE_CONNECTION_DISCONNECTED:
      isBridgeConnected = false;
      return;
  }
  window.postMessage({
    source: 'react-devtools-content-script',
    payload: message
  }, '*');
}
function handleMessageFromPage(event) {
  if (!isTransportActive || event.source !== window || !event.data) {
    return;
  }
  switch (event.data.source) {
    case 'react-devtools-bridge':
      {
        backendInitialized = true;
        pendingMessages.push(event.data.payload);
        flushPendingMessages();
        break;
      }
    case 'react-devtools-backend-manager':
      {
        const {
          source,
          payload
        } = event.data;
        if (payload?.type === 'backend-manager-injected') {
          sayHelloToBackendManager();
          break;
        }
        chrome.runtime.sendMessage({
          source,
          payload
        });
        break;
      }
  }
}
function handleDisconnect(disconnectedPort) {
  if (port !== disconnectedPort) {
    return;
  }
  isBridgeConnected = false;
  port = null;
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', connectPort, {
      once: true
    });
  } else {
    connectPort();
  }
}
function connectPort() {
  if (!isTransportActive) {
    return;
  }
  isBridgeConnected = false;
  const nextPort = chrome.runtime.connect({
    name: 'proxy'
  });
  port = nextPort;
  listenToMessagesFromBackend();
  nextPort.onMessage.addListener(message => handleMessageFromDevtools(nextPort, message));
  nextPort.onDisconnect.addListener(() => handleDisconnect(nextPort));
}
let evalRequestId = 0;
const evalRequestCallbacks = new Map();
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg?.source) {
    case 'devtools-page-eval':
      {
        const {
          scriptId,
          args
        } = msg.payload;
        const requestId = evalRequestId++;
        window.postMessage({
          source: 'react-devtools-content-script-eval',
          payload: {
            requestId,
            scriptId,
            args
          }
        }, '*');
        evalRequestCallbacks.set(requestId, sendResponse);
        return true;
      }
  }
});
window.addEventListener('message', event => {
  if (event.data?.source === 'react-devtools-content-script-eval-response') {
    const {
      requestId,
      response
    } = event.data.payload;
    const callback = evalRequestCallbacks.get(requestId);
    try {
      if (!callback) throw new Error(`No eval request callback for id "${requestId}" exists.`);
      callback(response);
    } catch (e) {
      console.warn('React DevTools Content Script eval response error occurred:', e);
    } finally {
      evalRequestCallbacks.delete(requestId);
    }
  }
});
})();

/******/ })()
;