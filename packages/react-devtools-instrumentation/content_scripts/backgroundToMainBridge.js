// This runs as content script (isolated world, has access to chrome APIs)
// Pass postMessage events to background scripts (worker.js)

//===================
// Import
//===================
import { events } from "../eventBus.js";



//===================
// Const
//===================
const MESSAGE = 'message';



//===================
// Bridge
//===================
window.addEventListener(MESSAGE, (event) => {
  if (event.data.type === events.START_ANALYSIS) {
     chrome.runtime.sendMessage({
      type: events.START_ANALYSIS,
      payload: event.data.payload
    }, (response) => {
      window.postMessage({ type: events.ANALYSIS_DONE, payload: response }, '*');
    });
  }
});