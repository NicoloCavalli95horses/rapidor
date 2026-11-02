//===================
// Import
//===================
import { eventBus, events } from "../../utils/eventBus.js";
import { log } from "../../utils/utils.js";
import { AnalysisLoop } from "../analysis/analysisLoop.js";
import { analysisActivity } from "./activity.js";



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
    eventBus.subscribe(e => {
      if (e.type === events.DB_SUCCESS) {
        this.onDbSuccess()
      }
    });
  }



  async onDbSuccess() {
    if (this.running) { return; }
    this.running = true;

    // counted as in-flight analysis so a crawler's waitForAnalysis() blocks until the loop (and the
    // request generation / evaluation it triggers) has drained
    analysisActivity.begin();
    try {
      await this.startAnalysis();
    } finally {
      this.running = false;
      analysisActivity.end();
    }
  }



  // process until empty, then sleep until next event
  async startAnalysis() {
    const hasOneHttpEvent = await this.stateManager.hasOneHttpEvent();
    const hasOneState = await this.stateManager.hasOneState();
    const hasOnePreIndexed = await this.stateManager.hasOnePreIndexed();

    if (hasOneHttpEvent && hasOneState && hasOnePreIndexed) {
      log({ module: 'analysis manager', msg: 'Starting the analysis...' });
      await this.loop.startAnalysis();
    } else {
      log({ module: 'analysis manager', msg: 'Nothing to analyze yet' });
    }
  }
}
