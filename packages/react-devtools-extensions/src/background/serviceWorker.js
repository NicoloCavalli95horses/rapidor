// [INFO]
// This runs as background script (web worker)
// Does not have access to the same IndexedDB instance as the main thread
// Can communicate to the MAIN world via the backgroundToMainBridge.js

//===================
// Import
//===================
import {log} from '../../../react-devtools-instrumentation/utils/utils.js';
import {classifyKeys, createOffscreenDocument} from './utils.js';

//===================
// Class
//===================
export class ServiceWorker {
  constructor() {
    this.initialized = false;
    this.tabs = new Set();
    this.collecting = null; // in-flight collectAllTabsData() promise (single-flight guard)

    this.onMessage = this.onMessage.bind(this);
    this.onTabRemoved = this.onTabRemoved.bind(this);
  }

  async init() {
    if (this.initialized) {
      return;
    }

    chrome.runtime.onMessage.addListener(this.onMessage);
    chrome.tabs.onRemoved.addListener(this.onTabRemoved);
    await createOffscreenDocument();
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'INITIALIZE_MODEL',
    });

    if (response.success) {
      this.initialized = true;
      log({module: 'service worker', msg: 'Initialized'});
    }
  }

  // This handle messages received from backgroundToMainBridge.js
  async onMessage(message, sender, sendResponse) {
    // Register tabs
    if (message.action === 'REGISTER_TAB' && sender.tab?.id != undefined) {
      const tabId = sender.tab.id;
      this.tabs.add(tabId);

      log({
        module: 'service worker',
        msg: `Registered new tab: ${[...this.tabs]}`,
      });
      sendResponse({success: true, tabId});
      return;
    }

    // Crawler aggregation: a single crawler call (on one tab) asks for data from *every* open tab.
    // Collect each registered tab's local snapshot and merge into one result, so the crawler reports
    // once across all tabs instead of polling each tab itself.
    if (message.action === 'GET_ALL_TABS_DATA') {
      this.collectAllTabsData()
        .then(data => sendResponse(data))
        .catch(error => sendResponse({error: error.message}));

      return true; // keep the sendResponse channel open for the async reply
    }

    // Classify keys
    if (message.action === 'CLASSIFY_KEYS') {
      if (!Array.isArray(message.payload)) {
        sendResponse({error: 'payload must be an array'});
        return;
      }

      const keys = message.payload;
      const results = [];

      try {
        // 1. Get classification from cache
        const cacheKeys = keys.map(key => `classification:${key}`);
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
          const response = await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'CLASSIFY_KEYS',
            payload: keysToClassify,
          });

          if (response?.error) {
            throw new Error(response.error);
          }

          if (
            !Array.isArray(response?.results) ||
            response.results.length !== keysToClassify.length
          ) {
            throw new Error('Invalid classification response');
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

        sendResponse({results});
      } catch (error) {
        console.error('[background] Classification error:', error);
        sendResponse({error: error.message});
      }

      return true;
    }
  }

  // this is called automatically by Chrome whenever a tab status is changed
  onTabRemoved(tabId) {
    this.tabs.delete(tabId);
    log({module: 'service worker', msg: `Removed tab: ${tabId}`});
  }

  async sendMessage(tabId, action, target = 'content-script', payload = {}) {
    return chrome.tabs.sendMessage(tabId, {target, action, payload});
  }

  async broadcast(action, payload = {}) {
    const tabIds = [...this.tabs];
    const results = await Promise.allSettled(
      tabIds.map(tabId => this.sendMessage(tabId, action, payload)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        log({
          module: 'service worker',
          msg: `Failed to send to tab ${tabIds[index]}: ${result.reason}`,
        });
        this.tabs.delete(tabIds[index]);
      }
    });

    return results.map((result, index) => ({tabId: tabIds[index], ...result}));
  }

  // Single-flight entry point. The service worker is the only context shared across every tab, so
  // it is the right place to guarantee one collection at a time: if a crawler triggers this twice
  // (eg. from two tabs at once, or an accidental double call) while one is still gathering, every
  // caller shares the same in-flight promise instead of starting a second fan-out. Idempotent reads,
  // so the shared result is correct for all of them.
  async collectAllTabsData() {
    if (this.collecting) {
      return this.collecting;
    }

    this.collecting = this.doCollectAllTabsData().finally(() => {
      this.collecting = null;
    });

    return this.collecting;
  }

  // Asks every registered tab for its local RAPIDOR snapshot (getData(), via the content-script
  // bridge) and merges them. Logs and stats come back as arrays with one entry per tab, each tagged
  // with its tabId so the crawler can tell them apart, eg.
  //   { logs: [{ tabId, logs: [...] }, ...], stats: [{ tabId, stats: {...} }, ...] }
  // A tab that went away or never answers is dropped (and de-registered) rather than failing the
  // whole collection.
  async doCollectAllTabsData() {
    const tabIds = [...this.tabs];
    const settled = await Promise.allSettled(
      tabIds.map(tabId =>
        this.sendMessage(tabId, 'GET_LOCAL_DATA', 'content-script'),
      ),
    );

    const logs = [];
    const stats = [];

    settled.forEach((outcome, index) => {
      const tabId = tabIds[index];
      const data =
        outcome.status === 'fulfilled' ? outcome.value?.result : undefined;

      if (!data) {
        log({
          module: 'service worker',
          msg: `No data from tab ${tabId}, dropping it`,
        });
        this.tabs.delete(tabId);
        return;
      }

      logs.push({tabId, logs: data.logs});
      stats.push({tabId, stats: data.stats});
    });

    return {logs, stats};
  }

  destroy() {
    chrome.runtime.onMessage.removeListener(this.onMessage);
    chrome.tabs.onRemoved.removeListener(this.onTabRemoved);
    this.initialized = false;
  }
}
