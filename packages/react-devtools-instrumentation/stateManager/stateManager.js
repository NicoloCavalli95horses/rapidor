//===================
// Import
//===================
import { eventBus } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage } from "../utils.js";
import { IDBManager } from "./indexedDB.js";



//===================
// Class
//===================

export class StateManager {
  constructor() {
    this.db = new IDBManager();
  }

  async init() {
    await this.db.init();

    eventBus
      .pipe(filter(event => event.type === "STATE_UPDATE"))
      .subscribe(event => {
        // Save serializable objects
        this.db.saveState(event.payload);
        log('[DEBUG] Saved to DB');
      });
  }

  async getData(id) {
    return await this.db.getState(id);
  }
}
