//===================
// Import
//===================
import { eventBus } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage } from "../utils.js";


//===================
// Functions
//===================
export class TestGenerator {
  constructor() {
  }



  init() {
    eventBus
      .pipe(filter(event => event.type === "HTTP_EVENT"))
      .subscribe(event => {
        // event -> {type, payload, meta}

        // [TODO]
        // - fetch data from DB
        // - look for matches (eg. api/uuid -> uuid is found in component C1)
        // - construct alternative endpoints (C1 -> C2)
        // - test requests, compare response, solve oracle problem via metamorphic properties
       });
  }
}
