//===================
// Import
//===================
import { log, copyObjKeys } from "../utils.js"



//===================
// Class
//===================
export class IDBManager {
  constructor(name = "db", version = 1) {
    this.name = name;
    this.version = version;
    this.db = null;
  }

  // Config value belonging to the class and not to instances
  // StateManager needs to access this fixed values
  static STORES = {
    STATE: 'state',
    HTTP_EVENT: 'httpEvent',
  }

  async init() {
    this.db = await this.connectToDb();
  }



  connectToDb() {
    return new Promise((resolve, reject) => {
      // for other browsers: mozIndexedDB, webkitIndexedDB, msIndexedDB, shimIndexedDB
      const request = window.indexedDB.open(this.name, this.version);

      request.onerror = (event) => {
        log({module: 'indexedDB', msg: 'IndexedDB error', type: 'error'});
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        // runs initially when the db is created or a new db version is declared
        const db = event.target.result;

        if (!db.objectStoreNames.contains(IDBManager.STORES.STATE)) {
          const state = db.createObjectStore(IDBManager.STORES.STATE, { autoIncrement: true }); // primary key (id) handled by indexedDB

          state.createIndex("sessionId", "sessionId", { unique: false }); // indexName (index name), keyPath (property of the saved object), options
          state.createIndex("url", "url", { unique: false });
          state.createIndex("timestamp", "timestamp", { unique: false });
        }

        if (!db.objectStoreNames.contains(IDBManager.STORES.HTTP_EVENT)) {
          const httpEvent = db.createObjectStore(IDBManager.STORES.HTTP_EVENT, { autoIncrement: true });

          httpEvent.createIndex("type", "type", { unique: false });
          httpEvent.createIndex("sessionId", "sessionId", { unique: false });
          httpEvent.createIndex("timestamp", "timestamp", { unique: false });
        }

        log({module: 'indexedDB', msg: 'IndexedDB initialized'});
      };

      request.onsuccess = (event) => {
        // runs after the 'onpugradeneeded' event, in case of success
        resolve(event.target.result);
      };

      request.onblocked = () => {
        reject(new Error("Database upgrade blocked. Close other tabs."));
      };
    });
  }



  saveState({ data, storeName }) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.put(data); // primary key (id) is handled by indexedDB
      request.onsuccess = () => resolve(storeName);
      request.onerror = (e) => {
        console.error("DB SAVE ERROR PAYLOAD:", data);
        console.error("DB ERROR:", e.target.error);
        reject(e.target.error);
      };
    });
  }



  async getByID({ id = 0, storeName }) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const result = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });

    if (!result) {
      throw new Error(`Object in ${storeName}, with id: ${id} not found`);
    }

    return result;
  }



  // returns next row in given store name
  async getNextCursor(storeName, lastKey = null) {
    const tx = this.db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    return await new Promise((resolve, reject) => {
      const request = (lastKey !== null)
        ? store.openCursor(IDBKeyRange.lowerBound(lastKey, true))
        : store.openCursor();

      request.onsuccess = (e) => resolve(e.target.result); // cursor or null
      request.onerror = (e) => reject(e.target.error);
    });
  }



  async isDataStored({ payload, storeName, keys = [] }) {
    let isStored = false;
    let current = {};

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    while (true) {
      current = await this.getNextCursor(storeName, current?.key);
      if (!current) {
        isStored = false;
        break;
      }

      const storedData = copyObjKeys(current.value, keys);
      const receivedData = copyObjKeys(payload, keys);

      if (JSON.stringify(storedData) === JSON.stringify(receivedData)) {
        isStored = true;
        break;
      }
    }
    
    return isStored;
  }



  // Returns true if at least one HTTP event have been registered
  // [TODO] filter considering likely useless HTTP events
  async hasOneHttpEvent() {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction(IDBManager.STORES.HTTP_EVENT, "readonly");
    const store = tx.objectStore(IDBManager.STORES.HTTP_EVENT);

    return new Promise((resolve, reject) => {
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result > 0);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }
}