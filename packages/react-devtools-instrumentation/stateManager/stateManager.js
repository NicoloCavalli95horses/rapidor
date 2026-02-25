//===================
// Import
//===================
import { eventBus } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage } from "../utils.js";
import { DbManager } from "./db.js";



//===================
// Class
//===================

// Do we need this class? it just use the DbManager class?

export class StateManager {
  constructor() {
    this.db = new DbManager();
  }

  async init() {
    await this.db.init();
    // [to do] retrive data
    // const id = 1;
    // const state = await this.db.getState(id);
    
    eventBus
      .pipe(filter(event => event.type === "STATE_UPDATE"))
      .subscribe(event => {
        // Save serializable objects
        this.db.saveState(event.payload);
        log('[DEBUG] Saved to DB')
      });
  }
}
