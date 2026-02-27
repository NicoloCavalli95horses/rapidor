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

    // A bit too verbose (?)
    // We could combine `type` and `objectStore` but this means giving the DB module the knowledge
    // to do the mapping, which is out of its responsabilities
    eventBus.subscribe(async (e) => {
      switch (e.type) {
        case events.STATE_UPDATE:
          await this.saveToDb({ data: e.payload, type: e.type, objectStore: this.dbStores.STATE });
          break;

        case events.HTTP_EVENT:
          await this.saveToDb({ data: e.payload, type: e.type, objectStore: this.dbStores.HTTP_EVENT });
          break;

        case events.DB_SUCCESS:
          break;

        default:
          log('[STATE MANAGER] Received unknown event type', e.type);
      }
    });
  }

  
  // [TODO]: dont store two times the same event
  // - check request/response identity
  // - same for state snapshots?

  /**
   * Save serialized data
   * @param {data} Object data to save 
   * @param {type} String type of event 
   * @param {objectStore} String store name 
   */
  async saveToDb({ data, type, objectStore }) {
    const payload = {
      ...data,
      sessionId: config.sessionID,
      url: window.location.href,
      timestamp: Date.now()
    };

    try {
      await this.db.saveState({ data: payload, objectStore });
      log(`[STATE MANAGER] saved ${type} to DB`);
      emit({ type: events.DB_SUCCESS, payload: { type } }); // this will start the state analysis if HTTP events occurred
    } catch (error) {
      log(`[STATE MANAGER] impossible to save on DB: ${error}`);
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



  async hasHTTPevents() {
    return await this.db.hasHttpEvent();
  }
}
