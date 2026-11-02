//===================
// Import
//===================
import { eventBus, emit, events } from "../../utils/eventBus.js";
import { log, recordMetric, metricKeys } from "../../utils/utils.js";
import { IDBManager } from "./indexedDB.js";
import { config } from "../../config.js";



//===================
// Class
//===================

export class StateManager {
  constructor() {
    this.db = new IDBManager();
    this.dbStores = IDBManager.STORES;

    this.pending = new Map();
    this.active = new Set(); // event handlers currently in flight (for waitForIdle)
  }

  async init() {
    await this.db.init();

    // Each event is handled asynchronously; its promise is tracked so waitForIdle() (used by the
    // crawler's wait-to-action) can tell when the save pipeline has fully drained.
    eventBus.subscribe((event) => {
      const task = this.handleEvent(event).catch(() => {});
      this.active.add(task);
      task.finally(() => this.active.delete(task));
    });
  }



  async handleEvent(event) {
    switch (event.type) {
      case events.STATE_UPDATE:
        return await this.handleStateUpdate(event, this.dbStores.STATE);

      case events.HTTP_EVENT:
        return await this.handleHTTPUpdate(event, this.dbStores.HTTP_EVENT);

      case events.NAV:
        return await this.saveToDb({ data: event.payload, type: event.type, storeName: this.dbStores.NAV });

      case events.PREINDEXING_UPDATE:
        return await this.handlePreindexingUpdate(event, this.dbStores.PREINDEXING);

      case events.REPORT:
        return await this.saveToDb({ data: event.payload, type: event.type, storeName: this.dbStores.REPORT });
    }
  }



  // Resolves once no event handler is in flight. A handler can emit another event (eg. STATE_UPDATE
  // -> DB_SUCCESS -> PREINDEXING_UPDATE), so we drain repeatedly until a round adds nothing new.
  async waitForIdle({ maxRounds = 20 } = {}) {
    for (let round = 0; round < maxRounds && this.active.size > 0; round++) {
      await Promise.allSettled([...this.active]);
      await Promise.resolve(); // let any synchronously-chained emit register its handler
    }
  }



  // Clears every store, giving a fresh run on a shared/persistent profile without deleting the DB
  // (which would block other tabs). Exposed as window.__RAPIDOR__reset() for a crawler to call once
  // at the start of a run, before the other tabs have navigated to the target.
  async reset() {
    await this.db.clearAll();
  }



  async handleStateUpdate(event, storeName) {
    await this.handleUpdate(event, storeName);

    // Delete old state snapshots and pre-indexing if we are outside of the analysis window
    const totStates = await this.getTotalStates();
    if (totStates <= config.maxStateSnapshots) { return; }

    // IndexedDB does not support relations. Here we have 1 (state) -> N (preindexing)
    // we need to manually delete all the data in the related table
    const deleted = await this.db.deleteFirst({ storeName });

    if (deleted) {
      await this.db.deleteByIndex({
        storeName: this.dbStores.PREINDEXING,
        index: 'graphIndex',
        value: deleted.value.graphIndex
      })
    }

    log({ module: "state manager", msg: `Out of analysis window. Deleted state snapshot and preindexed data at key ${deleted.value.graphIndex}` })
  }



  async handlePreindexingUpdate(event, storeName) {
    await this.saveToDb({
      data: event.payload,
      type: event.type,
      storeName,
      batch: true,
    });
  }



  async handleHTTPUpdate(event, storeName) {
    return await this.handleUpdate(event, storeName);
  }



  async handleUpdate(event, storeName) {
    const isStored = await this.db.isDataStored({ storeName, fingerprint: event.payload.fingerprint });
    const isState = storeName === this.dbStores.STATE;

    if (isStored) {
      log({ module: 'state manager', msg: `Event ${event.type} already saved to DB, skipping` });
      recordMetric({ key: isState ? metricKeys.STATES_SKIPPED_DUPLICATE : metricKeys.HTTP_EVENTS_SKIPPED_DUPLICATE });
      return false;
    }

    const data = this.prepareData(event.payload);
    const result = await this.saveToDb({ data, type: event.type, storeName });

    // result is null when a concurrent tab saved the same fingerprint first (unique-constraint
    // duplicate): count it as skipped, not saved.
    if (result) {
      recordMetric({ key: isState ? metricKeys.STATES_SAVED : metricKeys.HTTP_EVENTS_SAVED });
    } else {
      recordMetric({ key: isState ? metricKeys.STATES_SKIPPED_DUPLICATE : metricKeys.HTTP_EVENTS_SKIPPED_DUPLICATE });
    }

    return result;
  }



  prepareData(data) {
    // direct mutation O(1) is more efficient than using spread notation O(n), which iterate on data
    data.sessionID = config.sessionID;
    data.timestamp = Date.now();
    return data;
  }



  /**
   * Save serialized data
   * @param {Object} data data to save 
   * @param {String} type type of event 
   * @param {String} storeName store name 
   */
  async saveToDb({ data, type, storeName, batch }) {
    const id = data?.fingerprint || data?.id;

    if (this.pending.has(id)) {
      return this.pending.get(id); // returns the same promise
    }

    const promise = (async () => {
      try {
        const response = await this.db.saveState({ data, storeName, batch });
        // null => a concurrent tab already saved this (unique-constraint duplicate): nothing new, so
        // do not announce a DB_SUCCESS (it would trigger analysis/preindexing for a save that is not ours).
        if (!response) { return null; }
        log({ module: 'state manager', msg: `Saved ${type} to DB` });
        emit({ type: events.DB_SUCCESS, payload: { type, response } });
        return response;
      } finally {
        this.pending.delete(id);
      }
    })();

    this.pending.set(id, promise);

    return promise;
  }



  // Reads a state snapshot, returning null (not throwing) if it is gone. A preindexed match can
  // point at a snapshot the analysis window has since pruned (states churn fast when several tabs
  // share the DB); the match must then be skipped, not crash the whole analysis pass.
  async getStateOrNull(graphIndex) {
    return (await this.db.query({ storeName: this.dbStores.STATE, method: 'get', query: graphIndex })) ?? null;
  }



  // returns node
  async getNodeByID(graphIndex, nodeId) {
    const state = await this.getStateOrNull(graphIndex);
    return state?.nodes?.[nodeId];
  }



  // returns node relations
  async getRelationsByID(graphIndex, nodeId) {
    const state = await this.getStateOrNull(graphIndex);
    return state?.relations?.[nodeId];
  }



  async deleteHTTPEvent(key) {
    return await this.db.deleteById({ id: key, storeName: this.dbStores.HTTP_EVENT });
  }



  // returns component index
  async getComponentIndexByID(graphIndex) {
    const state = await this.getStateOrNull(graphIndex);
    return state?.componentIndex;
  }



  async getPreIndexed(value) {
    return await this.db.getPreIndexedByValue(String(value).toString());
  }



  async getNextHttpEvent(key) {
    return await this.db.getNextCursor(this.dbStores.HTTP_EVENT, key);
  }



  async getTotalHttpEvent() {
    return await this.db.countData({ storeName: this.dbStores.HTTP_EVENT });
  }



  async getTotalStates() {
    return await this.db.countData({ storeName: this.dbStores.STATE });
  }



  async hasAlreadyDoneRequest(fingerprint) {
    return await this.db.existsByIndex({ storeName: this.dbStores.HTTP_EVENT, index: 'fingerprint', query: fingerprint });
  }



  async hasOneHttpEvent() {
    return await this.db.hasAny({ storeName: this.dbStores.HTTP_EVENT });
  }



  async hasOneState() {
    return await this.db.hasAny({ storeName: this.dbStores.STATE });
  }



  async hasOnePreIndexed() {
    return await this.db.hasAny({ storeName: this.dbStores.PREINDEXING });
  }
}
