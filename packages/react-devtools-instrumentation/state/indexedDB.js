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
    PREINDEXING: 'preindexing',
    REPORT: 'report',
  }


  // ====================================
  // Init
  // ====================================

  async init() {
    await this.deleteDB(this.name);

    log({ module: 'indexed db', msg: 'Deleted existing data' });

    this.db = await this.connectToDb();
  }



  connectToDb() {
    return new Promise((resolve, reject) => {
      // for other browsers: mozIndexedDB, webkitIndexedDB, msIndexedDB, shimIndexedDB
      const request = indexedDB.open(this.name, this.version); // not window.indexedDB: it will resolve with `self.indexedDB` when a web worker is used

      request.onerror = (event) => {
        log({ module: 'indexed db', msg: 'IndexedDB error', type: 'error' });
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        // runs initially when the db is created or a new db version is declared
        const db = event.target.result;

        if (!db.objectStoreNames.contains(IDBManager.STORES.STATE)) {
          const state = db.createObjectStore(IDBManager.STORES.STATE, { keyPath: "graphIndex" });
          state.createIndex("url", "url", { unique: false });
          state.createIndex("fingerprint", "fingerprint", { unique: true });
        }

        if (!db.objectStoreNames.contains(IDBManager.STORES.HTTP_EVENT)) {
          const httpEvent = db.createObjectStore(IDBManager.STORES.HTTP_EVENT, { autoIncrement: true }); // primary key (id) handled by indexedDB
          httpEvent.createIndex("type", "type", { unique: false });
          httpEvent.createIndex("ignore", "ignore", { unique: false });
          httpEvent.createIndex("fingerprint", "fingerprint", { unique: true });
        }

        if (!db.objectStoreNames.contains(IDBManager.STORES.PREINDEXING)) {
          const preindexing = db.createObjectStore(IDBManager.STORES.PREINDEXING, { autoIncrement: true });
          preindexing.createIndex("graphIndex", "graphIndex", { unique: false });
          preindexing.createIndex("value", "value", { unique: false });
        }

        if (!db.objectStoreNames.contains(IDBManager.STORES.NAV)) {
          db.createObjectStore(IDBManager.STORES.NAV, { autoIncrement: true });
        }

        if (!db.objectStoreNames.contains(IDBManager.STORES.REPORT)) {
          db.createObjectStore(IDBManager.STORES.REPORT, { autoIncrement: true });
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

  saveState({ data, storeName, batch = false }) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        let results = batch ? [] : null;

        if (batch && Array.isArray(data)) {
          data.forEach(item => {
            const request = store.put(item);
            request.onsuccess = (e) => {
              results.push({ key: e.target.result, storeName });
            };
            request.onerror = (e) => {
              console.error("DB SAVE ERROR ITEM:", item);
              console.error("DB ERROR:", e.target.error);
            };
          });
        } else {
          const request = store.put(data);
          request.onsuccess = (e) => {
            results = { key: e.target.result, storeName };
          };
          request.onerror = (e) => {
            console.error("DB SAVE ERROR PAYLOAD:", data);
            console.error("DB ERROR:", e.target.error);
            reject(e.target.error);
          };
        }

        tx.oncomplete = () => resolve(results);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);

      } catch (err) {
        reject(err);
      }
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

      let updatedResult;

      tx.oncomplete = () => {
        resolve(updatedResult);
      };

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      const getRequest = store.get(id);

      getRequest.onerror = () => reject(getRequest.error);

      getRequest.onsuccess = (e) => {
        const existing = e.target.result;

        if (!existing) {
          tx.abort();
          reject(new Error(`Object in ${storeName} at id: ${id} not found`));
          return;
        }

        const updated = { ...existing, ...payload };
        const putRequest = store.put(updated, id);

        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => {
          updatedResult = updated;
        };
      };
    });
  }



  // ====================================
  // Delete
  // ====================================

  async deleteDB(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
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



  async deleteByIndex({ storeName, index, value }) {
    return this._withStore(storeName, "readwrite", (store) => {
      const source = store.index(index);
      const range = IDBKeyRange.only(value);

      return this._deleteWithCursor({ source, range });
    });
  }



  async deleteFirst({ storeName }) {
    return this._withStore(storeName, "readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (e) => {
          const cursor = e.target.result;

          if (!cursor) {
            resolve(false);
            return;
          }

          const deletedValue = { value: cursor.value, key: cursor.key };
          cursor.delete();

          resolve(deletedValue);
        };

        request.onerror = () => reject(request.error);
      });
    });
  }



  async deleteById({ storeName, id }) {
    return this._withStore(storeName, "readwrite", (store) => {
      return this._deleteRows(store, [id]);
    });
  }



  _deleteWithCursor({ source, range = null }) {
    return new Promise((resolve, reject) => {
      const request = source.openCursor(range);

      request.onsuccess = (e) => {
        const cursor = e.target.result;

        if (!cursor) {
          resolve();
          return;
        }

        cursor.delete();
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }


  _deleteRows(store, keys) {
    return Promise.all(
      keys.map(key => {
        return new Promise((resolve, reject) => {
          const req = store.delete(key);
          req.onsuccess = resolve;
          req.onerror = () => reject(req.error);
        });
      })
    );
  }


  async _withStore(storeName, mode, fn) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      Promise.resolve(fn(store))
        .then(result => {
          tx.oncomplete = () => resolve(result);
        })
        .catch(reject);

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
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
    return await this.query({ storeName, index, query, method: 'getAll' });
  }



  async getOneByIndex({ storeName, index, query }) {
    return await this.query({ storeName, index, query, method: 'get' });
  }



  async existsByIndex({ storeName, index, query }) {
    const count = await this.query({ storeName, index, query, method: 'count' });
    return count > 0;
  }



  // Returns matching preindexed nodes of all snapshots in the given interval
  async getPreIndexedByValue(value) {
    const range = IDBKeyRange.only(value);

    return await this.query({
      storeName: IDBManager.STORES.PREINDEXING,
      index: 'value',
      method: 'getAll',
      query: range
    });
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
  async getNextCursor(storeName, lastKey) {
    const tx = this.db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    return await new Promise((resolve, reject) => {
      const request = lastKey
        ? store.openCursor(IDBKeyRange.lowerBound(lastKey, true))
        : store.openCursor();

      request.onsuccess = (e) => resolve(e.target.result); // cursor or null
      request.onerror = (e) => reject(e.target.error);
    });
  }



  async isDataStored({ storeName, fingerprint }) {
    const result = await this.query({
      storeName,
      index: "fingerprint",
      method: "get",
      query: fingerprint
    });

    return !!result;
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