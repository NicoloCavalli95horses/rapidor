/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/evalScripts.js":
/*!****************************!*\
  !*** ./src/evalScripts.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "evalScripts": () => (/* binding */ evalScripts)
/* harmony export */ });
const evalScripts = {
  checkIfBackendManagerIsInjected: {
    fn: () => window.__REACT_DEVTOOLS_BACKEND_MANAGER_INJECTED__ === true,
    code: () => 'window.__REACT_DEVTOOLS_BACKEND_MANAGER_INJECTED__ === true'
  },
  checkIfReactPresentInInspectedWindow: {
    fn: () => window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size > 0,
    code: () => 'window.__REACT_DEVTOOLS_GLOBAL_HOOK__ &&' + 'window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size > 0'
  },
  reload: {
    fn: () => window.location.reload(),
    code: () => 'window.location.reload();'
  },
  setBrowserSelectionFromReact: {
    fn: () => {
      throw new Error('Not supported in fallback eval context');
    },
    code: () => '(window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0 !== $0) ?' + '(inspect(window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0), true) :' + 'false'
  },
  setReactSelectionFromBrowser: {
    fn: () => {
      throw new Error('Not supported in fallback eval context');
    },
    code: () => '(window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0 !== $0) ?' + '(window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0 = $0, true) :' + 'false'
  },
  viewAttributeSource: {
    fn: ({
      rendererID,
      elementID,
      path
    }) => {
      return false;
    },
    code: ({
      rendererID,
      elementID,
      path
    }) => '{' + 'const renderer = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.rendererInterfaces.get(' + JSON.stringify(rendererID) + ');' + 'if (renderer) {' + '  const value = renderer.getElementAttributeByPath(' + JSON.stringify(elementID) + ',' + JSON.stringify(path) + ');' + '  if (value) {' + '    inspect(value);' + '    true;' + '  } else {' + '    false;' + '  }' + '} else {' + '  false;' + '}' + '}'
  },
  viewElementSource: {
    fn: ({
      rendererID,
      elementID
    }) => {
      return false;
    },
    code: ({
      rendererID,
      elementID
    }) => '{' + 'const renderer = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.rendererInterfaces.get(' + JSON.stringify(rendererID) + ');' + 'if (renderer) {' + '  const value = renderer.getElementSourceFunctionById(' + JSON.stringify(elementID) + ');' + '  if (value) {' + '    inspect(value);' + '    true;' + '  } else {' + '    false;' + '  }' + '} else {' + '  false;' + '}' + '}'
  }
};

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
/*!***************************************************!*\
  !*** ./src/contentScripts/fallbackEvalContext.js ***!
  \***************************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _evalScripts__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../evalScripts */ "./src/evalScripts.js");

window.addEventListener('message', event => {
  if (event.data?.source === 'react-devtools-content-script-eval') {
    const {
      scriptId,
      args,
      requestId
    } = event.data.payload;
    const response = {
      result: null,
      error: null
    };
    try {
      if (!_evalScripts__WEBPACK_IMPORTED_MODULE_0__.evalScripts[scriptId]) {
        throw new Error(`No eval script with id "${scriptId}" exists.`);
      }
      response.result = _evalScripts__WEBPACK_IMPORTED_MODULE_0__.evalScripts[scriptId].fn.apply(null, args);
    } catch (err) {
      response.error = err.message;
    }
    window.postMessage({
      source: 'react-devtools-content-script-eval-response',
      payload: {
        requestId,
        response
      }
    }, '*');
  }
});
})();

/******/ })()
;