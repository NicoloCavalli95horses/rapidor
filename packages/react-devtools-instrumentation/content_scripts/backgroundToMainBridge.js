// This runs as `content script` (isolated world, has access to chrome APIs)
// It is a bridge between the Service Worker and the main execution context
// - the main execution context uses `clientToBridge.js` to communicate to this content script
// - this script uses Chrome APIs to communicate to the `serviceWorker.js`
// - the service worker replies using Chrome APIs and broadcast messages to all registered tabs

//===================
// Import
//===================
import { log } from "../utils/utils.js";



//===================
// Const
//===================




//===================
// Bridge
//===================
class backgroundToMainBridge {
  constructor() { }

  init() {
    chrome.runtime.sendMessage({ action: "REGISTER_TAB" });
    log({ module: "content script", msg: "Registered tab" });
    this.listenToClient();
    this.listenToServiceWorker();
  }


  listenToServiceWorker() {
    chrome.runtime.onMessage.addListener(
      (message, sender, sendResponse) => {
        log({ module: "content script", msg: `Received from SW: ${message}` });
        sendResponse({ success: true });
      }
    );
  }


  listenToClient() {
    window.addEventListener("message", async (event) => {
      if (event.source !== window) { return };
      if (event.origin !== window.location.origin) { return };

      const message = event.data;

      if (message?.source !== "rapidor-main") { return };
      if (message.type !== "REQUEST") { return };

      try {
        const result = await chrome.runtime.sendMessage({
          target: "service-worker",
          action: message.action,
          payload: message.payload,
          requestId: message.requestId,
        });

        window.postMessage({
          source: "rapidor-bridge",
          type: "RESPONSE",
          requestId: message.requestId,
          result,
        }, window.location.origin);
      } catch (error) {
        window.postMessage({
          source: "rapidor-bridge",
          type: "RESPONSE",
          requestId: message.requestId,
          error: error.message,
        }, window.location.origin);
      }
    });
  }
}



const bgToBridge = new backgroundToMainBridge();
bgToBridge.init();