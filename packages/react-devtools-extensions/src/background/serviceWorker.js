// [INFO]
// This runs as background script (web worker)
// Does not have access to the same IndexedDB instance as the main thread
// Can communicate to the MAIN world via the backgroundToMainBridge.js

//===================
// Import
//===================
import { config } from "../../../react-devtools-instrumentation/config.js";
import { events } from "../../../react-devtools-instrumentation/utils/eventBus.js";
import { log } from "../../../react-devtools-instrumentation/utils/utils.js";



//===================
// Class
//===================
export class ServiceWorker {
  constructor() {
    this.initialized = false;
    this.tabs = new Set();

    this.onMessage = this.onMessage.bind(this);
    this.onTabRemoved = this.onTabRemoved.bind(this);
  }


  init() {
    if (this.initialized) { return; }

    chrome.runtime.onMessage.addListener(this.onMessage);
    chrome.tabs.onRemoved.addListener(this.onTabRemoved);

    this.initialized = true;

    log({ module: "service worker", msg: "Initialized" });
  }


  async onMessage(message, sender, sendResponse) {
    // Register tabs
    if (message.action === "REGISTER_TAB" && sender.tab?.id != undefined) {
      const tabId = sender.tab.id;
      this.tabs.add(tabId);

      log({ module: "service worker", msg: `Registered new tab: ${[...this.tabs]}` });
      sendResponse({ success: true, tabId }); 
      return;
    }

    if (message.action === "PING" && this.tabs.has(sender.tab?.id)) {
      log({ module: "service worker", msg: `Received from bridge: ${message}` });
      await this.broadcast("PONG", {text: "hello back!"})
    }
  }



  // this is called automatically by Chrome whenever a tab status is changed
  onTabRemoved(tabId) {
    this.tabs.delete(tabId);
    log({ module: "service worker", msg: `Removed tab: ${tabId}` });
  }



  async sendMessage(tabId, action, target = "content-script", payload = {}) {
    return chrome.tabs.sendMessage(tabId, { target, action, payload });
  }



  async broadcast(action, payload = {}) {
    const tabIds = [...this.tabs];
    const results = await Promise.allSettled(tabIds.map(tabId => this.sendMessage(tabId, action, payload)));

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        log({ module: "service worker", msg: `Failed to send to tab ${tabIds[index]}: ${result.reason}` });
        this.tabs.delete(tabIds[index]);
      }
    });

    return results.map((result, index) => ({ tabId: tabIds[index], ...result }));
  }



  destroy() {
    chrome.runtime.onMessage.removeListener(this.onMessage);
    chrome.tabs.onRemoved.removeListener(this.onTabRemoved);
    this.initialized = false;
  }
}