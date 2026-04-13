//===================
// Import
//===================
import { emit, eventBus, events } from "../../utils/eventBus.js";
import { log, updateDOM } from "../../utils/utils.js";
import { config } from "../../config.js";
import { StateManager } from "../state/stateManager.js";
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
    this.displayInfo({ h2: "Matching data from HTTP requests with available data", keepOverlay: true });

    while (true) {
      httpEvent = await this.stateManager.getNextHttpEvent(lastKey);

      if (!httpEvent) {
        log({ module: 'analysis manager', msg: 'No more HTTP events' });
        break;
      }

      lastKey = httpEvent.key;

      const match = await this.matchFinder.find(httpEvent); // Find matches on preindexed values, get full nodes, return alternative instances
      match.success
        ? emit({ type: events.GEN_REQ, payload: match })
        : log({ module: 'analysis loop', msg: 'No results' });

      await this.stateManager.deleteHTTPEvent(lastKey); // keys of remaining elements do not change after deleting an entry
    }

    log({ module: 'analysis manager', msg: 'Exit analysis' });
    this.displayInfo();
  }



  displayInfo({ h1, h2, p, keepOverlay } = {}) {
    updateDOM({ h1, h2, p, keepOverlay });
  }
}
