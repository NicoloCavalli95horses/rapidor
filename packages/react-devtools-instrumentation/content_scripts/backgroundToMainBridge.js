// This runs as `content script` (isolated world, has access to chrome APIs)
// It is a bridge between the Service Worker and the main execution context
// - the main execution context uses `clientToBridge.js` to communicate to this content script
// - this script uses Chrome APIs to communicate to the `serviceWorker.js`
// - the service worker replies using Chrome APIs and broadcast messages to all registered tabs

//===================
// Import
//===================
import {log} from '../utils/utils.js';

//===================
// Const
//===================

//===================
// Bridge
//===================
class backgroundToMainBridge {
  constructor() {}

  init() {
    chrome.runtime.sendMessage({action: 'REGISTER_TAB'});
    log({module: 'content script', msg: 'Registered tab'});
    this.listenToClient();
    this.listenToServiceWorker();
  }

  listenToServiceWorker() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // The service worker fans a single crawler request out to every registered tab: each tab
      // returns its local RAPIDOR snapshot, which the service worker then aggregates into one result.
      if (message?.action === 'GET_LOCAL_DATA') {
        this.collectLocalData()
          .then(result => sendResponse({result}))
          .catch(error => sendResponse({error: error.message}));
        return true; // keep the sendResponse channel open for the async reply
      }

      log({module: 'content script', msg: `Received from SW: ${message}`});
      sendResponse({success: true});
      return false;
    });
  }

  // Asks the main-world context (via window.postMessage) for this tab's local getData() snapshot.
  // The content script can't read main-world state directly, so it round-trips through the page.
  collectLocalData({timeoutMs = 10000} = {}) {
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
      window.postMessage(
        {
          source: 'rapidor-bridge',
          type: 'COLLECT',
          requestId,
        },
        window.location.origin
      );
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
          requestId: message.requestId,
        });

        window.postMessage(
          {
            source: 'rapidor-bridge',
            type: 'RESPONSE',
            requestId: message.requestId,
            result,
          },
          window.location.origin
        );
      } catch (error) {
        window.postMessage(
          {
            source: 'rapidor-bridge',
            type: 'RESPONSE',
            requestId: message.requestId,
            error: error.message,
          },
          window.location.origin
        );
      }
    });
  }
}

const bgToBridge = new backgroundToMainBridge();
bgToBridge.init();
