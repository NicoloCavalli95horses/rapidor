/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!**********************!*\
  !*** ./src/panel.js ***!
  \**********************/
window.container = document.getElementById('container');
let hasInjectedStyles = false;
window.injectStyles = getLinkTags => {
  if (!hasInjectedStyles) {
    hasInjectedStyles = true;
    const linkTags = getLinkTags();
    for (const linkTag of linkTags) {
      document.head.appendChild(linkTag);
    }
  }
};
/******/ })()
;