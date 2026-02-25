//===================
// Import
//===================
import {log} from "../utils.js"



//===================
// Class
//===================
export class IDBManager {
  constructor(name = "db", version = 1) {
    this.name = name;
    this.version = version;
    this.db = null;
    this.id = 0;
  }

  async init() {
    this.db = await this.connectToDb();
  }

  connectToDb() {
    return new Promise((resolve, reject) => {
      // for other browsers: mozIndexedDB, webkitIndexedDB, msIndexedDB, shimIndexedDB
      const request = window.indexedDB.open(this.name, this.version);

      request.onerror = (event) => {
        log("IndexedDB error: ", event);
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        // runs initially when the db is created or a new db version is declared
        const db = event.target.result;

        const store = db.createObjectStore("state", { keyPath: "id" }); //primary key
        store.createIndex("state_snapshot", "snapshot", { unique: false });
      };

      request.onsuccess = (event) => {
        // runs after the 'onpugradeneeded' event, in case of success
        resolve(event.target.result);
      };
    });
  }

  saveState(data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("state", "readwrite");
      const store = tx.objectStore("state");
      this.id++;

      const payload = {id: this.id, state: data};
      const request = store.put(payload);

      request.onsuccess = () => resolve(payload);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  getState(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("state", "readonly");
      const store = tx.objectStore("state");
      const request = store.get(id);

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }
}