//===================
// Import
//===================
import { config } from "../config.js";
import { log, copyObjKeys } from "../utils.js"



//===================
// Class
//===================
export class IDBManager {
  constructor(name = `${config.toolName}_DB`, version = 1) {
    this.name = name;
    this.version = version;
    this.db = null;
  }

  // Config value belonging to the class and not to instances
  // StateManager needs to access this fixed values
  static STORES = {
    STATE: 'state',
    HTTP_EVENT: 'httpEvent',
    NAV: 'navigation',
  }


  // ====================================
  // Init
  // ====================================

  async init() {
    await this.deleteDB(this.name);

    this.db = await this.connectToDb();
    log({ module: 'indexed db', msg: 'IndexedDB initialized' });
  }



  connectToDb() {
    return new Promise((resolve, reject) => {
      // for other browsers: mozIndexedDB, webkitIndexedDB, msIndexedDB, shimIndexedDB
      const request = window.indexedDB.open(this.name, this.version);

      request.onerror = (event) => {
        log({ module: 'indexed db', msg: 'IndexedDB error', type: 'error' });
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        // runs initially when the db is created or a new db version is declared
        const db = event.target.result;

        if (!db.objectStoreNames.contains(IDBManager.STORES.STATE)) {
          const state = db.createObjectStore(IDBManager.STORES.STATE, { autoIncrement: true }); // primary key (id) handled by indexedDB
          state.createIndex("url", "url", { unique: false });
          state.createIndex("fingerprint", "fingerprint", { unique: false });
        }

        if (!db.objectStoreNames.contains(IDBManager.STORES.HTTP_EVENT)) {
          const httpEvent = db.createObjectStore(IDBManager.STORES.HTTP_EVENT, { autoIncrement: true });

          httpEvent.createIndex("type", "type", { unique: false });
          httpEvent.createIndex("ignore", "ignore", { unique: false });
          httpEvent.createIndex("fingerprint", "fingerprint", { unique: false });
        }

        if (!db.objectStoreNames.contains(IDBManager.STORES.NAV)) {
          const nav = db.createObjectStore(IDBManager.STORES.NAV, { autoIncrement: true });
        }
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



  // ====================================
  // Create
  // ====================================

  saveState({ data, storeName }) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.put(data); // primary key (id) is handled by indexedDB
      request.onsuccess = (e) => resolve({ key: e.target.result, storeName });
      request.onerror = (e) => {
        console.error("DB SAVE ERROR PAYLOAD:", data);
        console.error("DB ERROR:", e.target.error);
        reject(e.target.error);
      };
    });
  }


  // ====================================
  // Update
  // ====================================

  async updateRow({ id, payload, storeName }) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      tx.onerror = (e) => reject(e.target.error);
      tx.onabort = (e) => reject(e.target.error);

      const getRequest = store.get(id);

      getRequest.onerror = (e) => reject(e.target.error);

      getRequest.onsuccess = (e) => {
        const existing = e.target.result;

        if (!existing) {
          reject(new Error(`Object in ${storeName} at id: ${id} not found`));
          return;
        }

        const updated = { ...existing, ...payload };
        store.put(updated, id);
        resolve(updated);
      };
    });
  }



  // ====================================
  // Delete
  // ====================================

  async deleteDB(name) {
    return new Promise((resolve, reject) => {
      const req = window.indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => console.error("Error during DB deletion");
    });
  }



  async clearStore(dbName, storeName) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    await new Promise((res, rej) => {
      const tx = this.db.transaction(storeName, "readwrite");
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.objectStore(storeName).clear();
    });
  }



  // ====================================
  // Read
  // ====================================
  async query({ storeName, index = null, method = 'get', query = undefined }) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const target = index ? store.index(index) : store;

    return new Promise((resolve, reject) => {
      let request;

      switch (method) {
        case 'get':
          request = target.get(query);
          break;

        case 'getAll':
          request = target.getAll(query);
          break;

        case 'count':
          request = (query !== undefined) ? target.count(query) : target.count();
          break;

        default:
          return reject(new Error(`Unsupported method: ${method}`));
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }



  // Index-based reads
  // ====================================

  async getAllByIndex({ storeName, index, query }) {
    return this.query({ storeName, index, query, method: 'getAll' });
  }



  async getOneByIndex({ storeName, index, query }) {
    return this.query({ storeName, index, query, method: 'get' });
  }



  async existsByIndex({ storeName, index, query }) {
    const count = await this.query({ storeName, index, query, method: 'count' });
    return count > 0;
  }



  // Store-based reads
  // ====================================

  async getByID({ storeName, id }) {
    const result = await this.query({ storeName, method: 'get', query: id });

    if (!result) {
      throw new Error(`Object in ${storeName} at id: ${id} not found`);
    }

    return result;
  }



  async countData({ storeName }) {
    return await this.query({ storeName, method: 'count' });
  }



  async hasAny({ storeName }) {
    const count = await this.query({ storeName, method: 'count' });
    return count > 0;
  }



  // ====================================
  // Utils
  // ====================================

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



  async isDataStored({ payload, storeName }) {
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

      if (current.value.fingerprint === payload.fingerprint) {
        isStored = true;
        break;
      }
      // const diff = this.checkDifferences(storedData, receivedData);
      // log({module: 'indexed DB', msg: `differences between stored objects: ${JSON.stringify(diff)}`})
    }

    return { isStored, key: current?.key };
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
}