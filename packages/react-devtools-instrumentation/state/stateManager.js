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
          // Save new state in any case?
          // Difficult to compare state snapshots, DOM elements may now have different size due to screen resizing
          // DOM information are necessary for the metamorphic relations and we need to store everything
          await this.saveToDb({ data: event.payload, type: event.type, storeName: this.dbStores.STATE });
          break;

        case events.HTTP_EVENT:
          // Theoretically, we cannot assume that the answer from the web server will be always the same
          // Data could be updated or deleted, even for GET requests
          // However, we are interested in "data access" more than "data content"
          // So logically if a GET request was accepted before, it must be accepted again if no major changes occur
          // Hence, we don't store HTTP events twice and execute the analysis only once per event
          await this.handleUpdate({ event, storeName: this.dbStores.HTTP_EVENT, keys: ['request'] });
          break;

        case events.DB_SUCCESS:
          break;

        default:
          log({ module: 'state manager', msg: `Received unknown event type: ${event.type}` });
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



  async getStateByID(id) {
    return await this.db.getByID({ id, storeName: this.dbStores.STATE });
  }



  async getHTTPeventByID(id) {
    return await this.db.getByID({ id, storeName: this.dbStores.HTTP_EVENT });
  }



  async getNextHttpEvent(key) {
    return this.db.getNextCursor(this.dbStores.HTTP_EVENT, key);
  }



  async getNextState(key) {
    return this.db.getNextCursor(this.dbStores.STATE, key);
  }



  async hasOneHttpEvent() {
    return await this.db.hasOneHttpEvent();
  }
}
