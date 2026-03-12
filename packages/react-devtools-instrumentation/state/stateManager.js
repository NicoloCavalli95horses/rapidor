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
          // High-entropy keys are used in props.value.location.key or navigator.location.key
          // These create differences between stored object, so every page change produces a new state
          // Shall we remove these keys before storing the objects (?) they seem unimportant for our goals
          await this.handleUpdate({ event, storeName: this.dbStores.STATE, keys: ['nodes', 'relations'] });
          break;

        case events.HTTP_EVENT:
          // Theoretically, we cannot assume that the answer from the web server will be always the same
          // Data could be updated or deleted, even for GET requests
          // However, we are interested in "data access" more than "data content"
          // So logically if a GET request was accepted before, it must be accepted again if no major changes occur
          // Hence, we don't store HTTP events twice and execute the analysis only once per event
          await this.handleUpdate({ event, storeName: this.dbStores.HTTP_EVENT, keys: ['request'] });
          break;
      }
    });
  }



  /**
   * Filter objects to store
   * @param {String} event 
   * @param {String} storeName 
   * @param {String} key the key whose value will be considered in filtering 
   */
  async handleUpdate({ event, storeName, keys }) {
    if (event.payload.done) { return; } 

    const isStored = await this.db.isDataStored({ payload: event.payload, storeName, keys });

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



  async hasOneHttpEvent() {
    return await this.db.hasData(this.dbStores.HTTP_EVENT);
  }



  async hasOneState() {
    return await this.db.hasData(this.dbStores.STATE);
  }
}
