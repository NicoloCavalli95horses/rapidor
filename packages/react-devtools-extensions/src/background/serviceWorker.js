// [INFO]
// This runs as background script (web worker)
// Does not have access to the same IndexedDB instance as the main thread
// Can communicate to the MAIN world via the backgroundToMainBridge.js

//===================
// Import
//===================
import { log } from "../../../react-devtools-instrumentation/utils/utils.js";
import { classifyKeys, createOffscreenDocument } from "./utils.js";



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


  async init() {
    if (this.initialized) { return; }

    chrome.runtime.onMessage.addListener(this.onMessage);
    chrome.tabs.onRemoved.addListener(this.onTabRemoved);
    await createOffscreenDocument();
    const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "INITIALIZE_MODEL" });
    
    if (response.success) {
      this.initialized = true;
      log({ module: "service worker", msg: "Initialized" });
    }
  }


  // This handle messages received from backgroundToMainBridge.js
  async onMessage(message, sender, sendResponse) {
    // Register tabs
    if (message.action === "REGISTER_TAB" && sender.tab?.id != undefined) {
      const tabId = sender.tab.id;
      this.tabs.add(tabId);

      log({ module: "service worker", msg: `Registered new tab: ${[...this.tabs]}` });
      sendResponse({ success: true, tabId });
      return;
    }

    // Classify keys
    if (message.action === "CLASSIFY_KEYS") {
      if (!Array.isArray(message.payload)) {
        sendResponse({ error: "payload must be an array" });
        return;
      }

      const keys = message.payload;
      const results = [];

      try {
        // 1. Get classification from cache
        const cacheKeys = keys.map((key) => `classification:${key}`);
        const cached = await chrome.storage.local.get(cacheKeys);
        const keysToClassify = [];

        for (const key of keys) {
          const cacheKey = `classification:${key}`;

          if (cached[cacheKey] !== undefined) {
            results.push(cached[cacheKey]);
          } else {
            keysToClassify.push(key);
          }
        }

        // 2. Classify only new keys
        if (keysToClassify.length > 0) {
          const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "CLASSIFY_KEYS", payload: keysToClassify });
          
          if (response?.error) {
            throw new Error(response.error);
          }

          if (!Array.isArray(response?.results) || response.results.length !== keysToClassify.length) {
            throw new Error("Invalid classification response");
          }

          // 3. Save to persistent cache
          const cacheEntries = {};

          for (let i = 0; i < keysToClassify.length; i++) {
            const key = keysToClassify[i];
            const result = response.results[i];
            results.push(result);
            cacheEntries[`classification:${key}`] = result;
          }

          await chrome.storage.local.set(cacheEntries);
        }

        sendResponse({ results });
      } catch (error) {
        console.error("[background] Classification error:", error);
        sendResponse({ error: error.message });
      }

      return true;
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