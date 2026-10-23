//===================
// Import
//===================
import { emit, events } from "../../utils/eventBus.js";
import { log } from "../../utils/utils.js";
import { RequestGenerator } from "./requestGenerator.js";
import { MatchFinder } from "./matchFinder.js";



//===================
// Functions
//===================
export class AnalysisLoop {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.requestGenerator = new RequestGenerator();
    this.matchFinder = new MatchFinder(this.stateManager);
  }



  init() {
    this.requestGenerator.init();
  }



  async startAnalysis() {
    let httpEvent = {};
    let lastKey = undefined;

    while (true) {
      httpEvent = await this.stateManager.getNextHttpEvent(lastKey);

      if (!httpEvent) {
        log({ module: 'analysis manager', msg: 'No more HTTP events' });
        break;
      }

      lastKey = httpEvent.key;

      // Find matches on preindexed values, get full nodes, return alternative instances
      const match = await this.matchFinder.find(httpEvent);

      match.success ? emit({ type: events.GEN_REQ, payload: match }) : log({ module: 'analysis loop', msg: 'No results' });

      // Keys of remaining elements do not change after deleting an entry
      await this.stateManager.deleteHTTPEvent(lastKey);
    }

    log({ module: 'analysis manager', msg: 'Exit analysis' });
  }
}
