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

  async init({ listen = true, cleanDb = true } = {}) {   
    await this.db.init(cleanDb);

    if (!listen) { return; }

    eventBus.subscribe(async (event) => {
      if (event.type === events.STATE_UPDATE) {
        await this.handleUpdate(event, this.dbStores.STATE);
      } else if (event.type === events.HTTP_EVENT) {
        // Theoretically, we cannot assume that the answer from the web server will be always the same (data could be updated or deleted, even for GET requests)
        // However, we are interested in "data access" more than "data content": so logically if a GET request was accepted before, it must be accepted again if no major changes occur
        // Hence, we don't store HTTP events twice and execute the analysis only once per event
        await this.handleUpdate(event, this.dbStores.HTTP_EVENT);
      } else if (event.type === events.NAV) {
        await this.saveToDb({ data: event.payload, type: events.NAV, storeName: this.dbStores.NAV });
      }
    });
  }



  async handleUpdate(event, storeName) {
    const { isStored } = await this.db.isDataStored({ payload: event.payload, storeName, id: 'fingerprint' });

    if (isStored) {
      log({ module: 'state manager', msg: `event already saved to DB, skipping` });
      return;
    }

    const data = await this.prepareData(event.payload);
    await this.saveToDb({ data, type: event.type, storeName });
  }



  async prepareData(data) {
    // direct mutation O(1) is more efficient than using spread notation O(n), which iterate on data
    data.navigationInfo = await this.getNavigationInfo();
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
  async saveToDb({ data, type, storeName }) {
    try {
      const res = await this.db.saveState({ data, storeName });
      log({ module: 'state manager', msg: `saved ${type} to DB` });
      emit({ type: events.DB_SUCCESS, payload: { type } }); // this will start the state analysis if HTTP events occurred
      return res;
    } catch (error) {
      log({ module: 'state manager', msg: `impossible to save on DB: ${error}`, type: 'error' });
    }
  }



  async getNavigationInfo() {
    const storeName = this.dbStores.NAV;
    const url = decodeURIComponent(window.location.href);
    const { isStored, key: idx } = await this.db.isDataStored({ payload: url, storeName });
    return isStored ? { url, idx } : {};
  }



  // returns node
  async getNodeByID(rowId, nodeId) {
    const state = await this.db.getByID({ id: rowId, storeName: this.dbStores.STATE });
    return state.nodes[nodeId];
  }



  // returns node relations
  async getRelationsByID(rowId, nodeId) {
    const state = await this.db.getByID({ id: rowId, storeName: this.dbStores.STATE });
    return state.relations[nodeId];
  }



  async getIdsOfInstances(rowId, componentId) {
    const state = await this.db.getByID({ id: rowId, storeName: this.dbStores.STATE });
    return state.componentIndex[componentId];
  }



  async updateHTTPevent({ id, payload }) {
    return await this.db.updateRow({ id, payload, storeName: this.dbStores.HTTP_EVENT });
  }



  async getAncestorDOM(rowId, parentId) {
    let currentId = parentId;

    while (currentId) {
      const node = await this.getNodeByID(rowId, currentId);
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



  async getHTTPeventByID(rowId) {
    return await this.db.getByID({ id: rowId, storeName: this.dbStores.HTTP_EVENT });
  }



  async getNextHttpEvent(key) {
    return this.db.getNextCursor(this.dbStores.HTTP_EVENT, key);
  }



  async getNextState(key) {
    return this.db.getNextCursor(this.dbStores.STATE, key);
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



  async getIgnoredHTTPEvents() {
    return await this.db.getAllByIndex({ storeName: this.dbStores.HTTP_EVENT, index: 'ignore', query: 1 });
  }
}
