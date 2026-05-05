// [INFO]
// This runs as background script (web worker)
// Does not have access to the same IndexedDB instance as the main thread
// Can communicate to the MAIN world via the backgroundToMainBridge.js

//===================
// Import
//===================
import { config } from "../../../react-devtools-instrumentation/config.js";
import { events } from "../../../react-devtools-instrumentation/utils/eventBus.js";



//===================
// Class
//===================
export class ServiceWorker {
  constructor() {
    this.rootTabId = undefined;
  }



  init() {
    this.listenToMsg();
    this.listenToTabClosed();
  }



  listenToMsg() {
    chrome.runtime.onMessage.addListener((message, sender) => {

      if (message.type === events.OPEN_TAB) {
        if (this.rootTabId) { return; }
        const id = sender.tab?.id;
        this.handleTabOpening(id, message.payload.url);
      }

    });
  }



  handleTabOpening(id, url) {
    if (!id) { return; }
    this.rootTabId = this.rootTabId || id;

    if (this.rootTabId === id) {
      chrome.tabs.create({ url });
    }
  }



  listenToTabClosed() {
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === this.rootTabId) {
        this.rootTabId = undefined;
      }
    });
  }
}