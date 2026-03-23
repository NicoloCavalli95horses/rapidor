//===================
// Import
//===================
import { eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../utils.js";
import { StateManager } from "../state/stateManager.js";
import { Worker } from "./worker.js";



//===================
// Functions
//===================
export class AnalysisManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.running = false;
    this.worker = new Worker(this.stateManager);
  }


  init() {
    this.worker.init();

    eventBus
      .pipe(filter(e => e.type === events.DB_SUCCESS))
      .subscribe(e => this.onDbSuccess());
  }



  async onDbSuccess() {
    if (this.running) { return; }
    this.running = true;

    try {
      await this.startWorker();
    } finally {
      this.running = false;
    }
  }



  // process until empty, then sleep until next event
  async startWorker() {
    const hasOneHttpEvent = await this.stateManager.hasOneHttpEvent();
    const hasOneState = await this.stateManager.hasOneState();

    if (hasOneHttpEvent && hasOneState) {
      log({ module: 'analysis manager', msg: 'starting the analysis...' });
      await this.worker.startAnalysis();
    } else {
      log({ module: 'analysis manager', msg: 'nothing to analyze yet' });
    }
  }
}
