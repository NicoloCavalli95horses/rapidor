//===================
// Import
//===================
import { log, copyObjKeys } from "../utils.js"
import _ from "lodash";



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
        log({ module: 'indexedDB', msg: 'IndexedDB error', type: 'error' });
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

        log({ module: 'indexedDB', msg: 'IndexedDB initialized' });
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



  async getByID({ rowId, nodeId, storeName }) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const result = await new Promise((resolve, reject) => {
      const request = store.get(rowId);
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });

    if (!result) {
      throw new Error(`Object in ${storeName} at id: ${id} not found`);
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

      if (_.isEqual(storedData, receivedData)) {
        isStored = true;
        break;
      }
      // const diff = this.checkDifferences(storedData, receivedData);
      // log({module: 'indexed DB', msg: `differences between stored objects: ${JSON.stringify(diff)}`})
    }

    return isStored;
  }


  checkDifferences(obj1, obj2) {
    const differences = [];

    function walk(a, b, path = "") {
      const isObject = v => v && typeof v === "object";

      if (a === undefined && b !== undefined) {
        differences.push({
          path,
          type: "missing_in_obj1",
          valueInObj2: b
        });
        return;
      }

      if (b === undefined && a !== undefined) {
        differences.push({
          path,
          type: "missing_in_obj2",
          valueInObj1: a
        });
        return;
      }

      if (typeof a !== typeof b) {
        differences.push({
          path,
          type: "different_type",
          valueInObj1: a,
          valueInObj2: b
        });
        return;
      }

      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
          differences.push({
            path,
            type: "different_array_length",
            lengthObj1: a.length,
            lengthObj2: b.length
          });
        }

        const max = Math.max(a.length, b.length);
        for (let i = 0; i < max; i++) {
          walk(a[i], b[i], `${path}[${i}]`);
        }
        return;
      }

      if (isObject(a) && isObject(b)) {
        const keys = new Set([
          ...Object.keys(a),
          ...Object.keys(b)
        ]);

        for (const key of keys) {
          const newPath = path ? `${path}.${key}` : key;
          walk(a[key], b[key], newPath);
        }
        return;
      }

      if (a !== b) {
        differences.push({
          path,
          type: "different_value",
          valueInObj1: a,
          valueInObj2: b
        });
      }
    }

    walk(obj1, obj2);
    return differences;
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