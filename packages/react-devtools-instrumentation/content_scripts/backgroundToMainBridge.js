// This runs as content script (isolated world, has access to chrome APIs)
// Pass postMessage events to background scripts

//===================
// Import
//===================
import { events } from "../utils/eventBus.js";



//===================
// Const
//===================




//===================
// Bridge
//===================
console.log("[Content script] loaded");

chrome.runtime.sendMessage({ action: "REGISTER_TAB" });
chrome.runtime.sendMessage({ action: "PING" });

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    console.log("[Content script] received from sw:", message);
    sendResponse({ success: true });
  }
);


// Note:
// use postMessage to send to other scripts in the main execution context