/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!************************************************!*\
  !*** ./src/contentScripts/prepareInjection.js ***!
  \************************************************/
let lastSentDevToolsHookMessage;
window.addEventListener('message', function onMessage({
  data,
  source
}) {
  if (source !== window || !data) {
    return;
  }
  if (data.source === 'react-devtools-hook') {
    const {
      source: messageSource,
      payload
    } = data;
    const message = {
      source: messageSource,
      payload
    };
    lastSentDevToolsHookMessage = message;
    chrome.runtime.sendMessage(message);
  }
});
window.addEventListener('pageshow', function ({
  target
}) {
  if (!lastSentDevToolsHookMessage || target !== window.document) {
    return;
  }
  chrome.runtime.sendMessage(lastSentDevToolsHookMessage);
});
/******/ })()
;