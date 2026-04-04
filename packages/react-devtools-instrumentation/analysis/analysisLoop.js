//===================
// Import
//===================
import { emit, eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage, listenToMsg, getValueAtPath } from "../utils.js";
import { StateManager } from "../state/stateManager.js";
import { RequestGenerator } from "./requestGenerator.js";
import { config } from "../config.js";
import { MatchFinder } from "./matchFinder.js";



//===================
// Functions
//===================
export class AnalysisLoop {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.requestGenerator = new RequestGenerator(this.stateManager);
    this.matchFinder = new MatchFinder(this.stateManager);
  }



  init() {
    this.requestGenerator.init();
  }



  async startAnalysis() {
    let httpEvent = {};
    let lastKey = undefined;

    const total = await this.stateManager.getTotalHttpEvent();

    while (true) {
      httpEvent = await this.stateManager.getNextHttpEvent(lastKey);

      if (!httpEvent) {
        log({ module: 'analysis manager', msg: 'no more HTTP events' });
        break;
      }

      lastKey = httpEvent.key;

      // Show progress bar
      // this.updateDOM({ total, current: lastKey })

      // Find matches on preindexed values, get full nodes, return alternative instances
      const match = await this.matchFinder.find(httpEvent);
      match.success ? emit({ type: events.GEN_REQ, payload: match }) : log({ module: 'analysis loop', msg: 'no results' });
    
      // Safe delete: the keys of the remaining elements do not change after deleting an entry
      await this.stateManager.deleteHTTPEvent(lastKey);
    }

    log({ module: 'analysis manager', msg: 'exit analysis' });
  }



  // [TODO]: since we delete the HTTP events, we need to refactor this
  updateDOM({ total, current = 1 }) {
    emit({
      type: events.ANALYSIS_IN_PROGRESS,
      payload: {
        on_progress: current != total,
        progress: {
          max: total,
          value: current,
        }
      }
    });
  }
}
