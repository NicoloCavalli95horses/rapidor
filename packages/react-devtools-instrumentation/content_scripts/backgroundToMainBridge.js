// This runs as content script (isolated world, has access to chrome APIs)
// Pass postMessage events to background scripts

//===================
// Import
//===================
import { events } from "../utils/eventBus.js";
import { watchConfig } from "../config.js";


//===================
// Const
//===================
const MESSAGE = 'message';



//===================
// Bridge
//===================
window.addEventListener(MESSAGE, (event) => {
  // a postMessage is received
  if (event.data.type === events.START_ANALYSIS) { // custom event to set up
    chrome.runtime.sendMessage({
      type: events.START_ANALYSIS,
      payload: event.data.payload
    }, (response) => {
      // response is sent to the caller
      window.postMessage({ type: events.ANALYSIS_DONE, payload: response }, '*');
    });
  }
});


if (watchConfig.openNewTab()) {
  document.addEventListener("DOMContentLoaded", (_) => {

    // Handle tab opening
    chrome.runtime.sendMessage({
      type: events.OPEN_TAB,
      payload: {
        url: window.location.href
      }
    });
  });
  
}