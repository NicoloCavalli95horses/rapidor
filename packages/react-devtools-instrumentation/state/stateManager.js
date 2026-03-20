//===================
// Import
//===================
import { eventBus, emit, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage } from "../utils.js";
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
          await this.handleStateUpdate(event);
          break;

        case events.HTTP_EVENT:
          await this.handleHTTPUpdate(event);
          break;
      }
    });
  }



  async handleStateUpdate(event) {
    const { payload: data, type } = event;
    const storeName = this.dbStores.STATE;
    const isStored = await this.db.existsByIndex({ storeName, index: 'fingerprint', query: data.fingerprint });

    console.log({ isStored })

    if (!isStored) {
      await this.saveToDb({ data, type, storeName });
    }
  }



  async handleHTTPUpdate(event) {
    // Theoretically, we cannot assume that the answer from the web server will be always the same (data could be updated or deleted, even for GET requests)
    // However, we are interested in "data access" more than "data content": so logically if a GET request was accepted before, it must be accepted again if no major changes occur
    // Hence, we don't store HTTP events twice and execute the analysis only once per event
    const storeName = this.dbStores.HTTP_EVENT;
    const isStored = await this.db.isDataStored({ payload: event.payload, storeName, keys: ['request'] });

    if (!isStored) {
      await this.saveToDb({ data: event.payload, type: event.type, storeName });
    }
  }



  /**
   * Save serialized data
   * @param {Object} data data to save 
   * @param {String} type type of event 
   * @param {String} storeName store name 
   */
  async saveToDb({ data, type, storeName }) {
    const payload = {
      ...data,
      sessionId: config.sessionID,
      url: window.location.href,
      timestamp: Date.now()
    };

    try {
      await this.db.saveState({ data: payload, storeName });
      log({ module: 'state manager', msg: `saved ${type} to DB` });
      emit({ type: events.DB_SUCCESS, payload: { type } }); // this will start the state analysis if HTTP events occurred
    } catch (error) {
      log({ module: 'state manager', msg: `impossible to save on DB: ${error}`, type: 'error' });
    }
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

    return;
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
