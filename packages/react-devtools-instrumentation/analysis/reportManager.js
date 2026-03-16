//===================
// Import
//===================
import { eventBus, events, emit } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../utils.js";
import { config } from "../config.js";


//===================
// Functions
//===================
export class ReportManager {
  constructor() {
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.REPORT))
      .subscribe(e => this.handleEvent(e.payload));
  }



  handleEvent(event) {
    log({ module: "report manager", msg: "building report..." });
    console.log({report: event});

    // [TODO] here we can:
    // - build and execute tests (eg, given this request and the similarity, this should fail, but it doesnt)
    // - return a JSON report
    // - we could also design an E2E test if we take into consideration event listeners and what happens when you click on an item that has different CSS compared to the reference
    // - just flag a potential access control issue
  }
}