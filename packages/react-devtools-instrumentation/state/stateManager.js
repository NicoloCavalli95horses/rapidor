//===================
// Import
//===================
import { eventBus, emit, events } from "../eventBus.js";
import { log } from "../utils.js";
import { IDBManager } from "./indexedDB.js";
import { config } from "../config.js";



//===================
// Class
//===================

export class StateManager {
  constructor() {
    this.db = new IDBManager();
    this.dbStores = IDBManager.STORES;
  }

  async init() {
    await this.db.init();

    eventBus.subscribe(async (event) => {

      switch (event.type) {
        case events.STATE_UPDATE:
          await this.handleStateUpdate(event, this.dbStores.STATE);
          break;

        case events.HTTP_EVENT:
          await this.handleHTTPUpdate(event, this.dbStores.HTTP_EVENT);
          break;

        case events.NAV:
          await this.saveToDb({ data: event.payload, type: event.type, storeName: this.dbStores.NAV });
          break;

        case events.PREINDEXING_UPDATE:
          // [TODO] do not save two row with the same primitive values, just update the snapshot key
          await this.saveToDb({ data: event.payload, type: event.type, storeName: this.dbStores.PREINDEXING, batch: true });
          break;

        case events.REPORT:
          await this.saveToDb({ data: event.payload, type: event.type, storeName: this.dbStores.REPORT });
          break;
      }
    });
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



  async handleHTTPUpdate(event, storeName) {
    return await this.handleUpdate(event, storeName);
  }



  async handleUpdate(event, storeName) {
    const isStored = await this.db.isDataStored({ storeName, fingerprint: event.payload.fingerprint });

    if (isStored) {
      log({ module: 'state manager', msg: `Event ${event.type} already saved to DB, skipping` });
      return false;
    }

    const data = this.prepareData(event.payload);
    return await this.saveToDb({ data, type: event.type, storeName });
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
    try {
      const res = await this.db.saveState({ data, storeName, batch });
      log({ module: 'state manager', msg: `saved ${type} to DB` });
      emit({ type: events.DB_SUCCESS, payload: type });
      return res;
    } catch (error) {
      log({ module: 'state manager', msg: `impossible to save on DB: ${error}`, type: 'error' });
    }
  }



  // returns node
  async getNodeByID(graphIndex, nodeId) {
    const state = await this.db.getByID({ id: graphIndex, storeName: this.dbStores.STATE });
    return state.nodes[nodeId];
  }



  // returns node relations
  async getRelationsByID(graphIndex, nodeId) {
    const state = await this.db.getByID({ id: graphIndex, storeName: this.dbStores.STATE });
    return state.relations[nodeId];
  }



  async deleteHTTPEvent(key) {
    return await this.db.deleteById({ id: key, storeName: this.dbStores.HTTP_EVENT });
  }



  // returns component index
  async getComponentIndexByID(graphIndex) {
    const state = await this.db.getByID({ id: graphIndex, storeName: this.dbStores.STATE });
    return state.componentIndex;
  }



  async getIdsOfInstances(graphIndex, componentId) {
    const state = await this.db.getByID({ id: graphIndex, storeName: this.dbStores.STATE });
    return state.componentIndex[componentId];
  }



  async updateHTTPevent({ id, payload }) {
    return await this.db.updateRow({ id, payload, storeName: this.dbStores.HTTP_EVENT });
  }



  async getPreIndexed(value) {
    return await this.db.getPreIndexedByValue(value.toString());
  }



  async getAncestorDOM(graphIndex, parentId) {
    let currentId = parentId;

    while (currentId) {
      const node = await this.getNodeByID(graphIndex, currentId);
      if (!node) { return; }
      if (node.DOM) {
        return {
          ...node.DOM,
          isAncestorDOM: true,
          ancestorId: currentId
        }
      }
      currentId = node.parent;
    }

    return undefined;
  }



  async getHTTPeventByID(graphIndex) {
    return await this.db.getByID({ id: graphIndex, storeName: this.dbStores.HTTP_EVENT });
  }



  async getNextHttpEvent(key) {
    return await this.db.getNextCursor(this.dbStores.HTTP_EVENT, key);
  }



  async getNextState(key) {
    return await this.db.getNextCursor(this.dbStores.STATE, key);
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



  async getIgnoredHTTPEvents() {
    return await this.db.getAllByIndex({ storeName: this.dbStores.HTTP_EVENT, index: 'ignore', query: 1 });
  }
}
