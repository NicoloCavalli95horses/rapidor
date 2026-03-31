//===================
// Import
//===================
import { eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../utils.js";
import { StateManager } from "../state/stateManager.js";
import { AnalysisLoop } from "./analysisLoop.js";



//===================
// Functions
//===================
export class AnalysisManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.running = false;
    this.loop = new AnalysisLoop(this.stateManager);
  }


  init() {
    this.loop.init();

    eventBus
      .pipe(filter(e => e.type === events.DB_SUCCESS))
      .subscribe(e => this.onDbSuccess());
  }



  async onDbSuccess() {
    if (this.running) { return; }
    this.running = true;

    try {
      await this.startAnalysis();
    } finally {
      this.running = false;
    }
  }



  // process until empty, then sleep until next event
  async startAnalysis() {
    const hasOneHttpEvent = await this.stateManager.hasOneHttpEvent();
    const hasOneState = await this.stateManager.hasOneState();

    if (hasOneHttpEvent && hasOneState) {
      log({ module: 'analysis manager', msg: 'starting the analysis...' });
      await this.loop.startAnalysis();
    } else {
      log({ module: 'analysis manager', msg: 'nothing to analyze yet' });
    }
  }
}
