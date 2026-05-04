//===================
// Import
//===================
import { emit, eventBus, events } from "../../utils/eventBus.js";
import { log } from "../../utils/utils.js";
import { config } from "../../config.js";

import { StateManager } from "../state/stateManager.js";
import { RequestGenerator } from "./requestGenerator.js";
import { MatchFinder } from "./matchFinder.js";



//===================
// Const
//===================
const MODES = Object.freeze({
  VERTICAL: "vertical",
  HORIZONTAL: "horizontal"
});



//===================
// Functions
//===================
export class AnalysisManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.running = false;
    this.requestGenerator = new RequestGenerator();
    this.matchFinder = new MatchFinder(this.stateManager);

    this.modeHandlers = {
      [MODES.VERTICAL]: {
        canStart: this.canStartVertical.bind(this),
        run: this.startVerticalAnalysis.bind(this),
      },

      [MODES.HORIZONTAL]: {
        canStart: this.canStartHorizontal.bind(this),
        run: this.startHorizontalAnalysis.bind(this),
      },
    };
  }



  init() {
    this.requestGenerator.init();

    eventBus.subscribe(e => {
      if (e.type === events.DB_SUCCESS) {
        this.onDbSuccess()
      }
    });
  }



  async canStartVertical() {
    const [http, state, pre] = await Promise.all([
      this.stateManager.hasOneHttpEvent(),
      this.stateManager.hasOneState(),
      this.stateManager.hasOnePreIndexed(),
    ]);
    return http && state && pre;
  }



   async canStartHorizontal() {
    const [http, state, pre] = await Promise.all([
      this.stateManager.hasOneHttpEvent(),
      this.stateManager.hasOneState(),
      this.stateManager.hasOnePreIndexed(),
    ]);
    return http && state && pre;
  }



  async onDbSuccess() {
    if (this.running) { return; }
    this.running = true;

    try {
      await this.handleDbSuccess();
    } finally {
      this.running = false;
    }
  }



  // process until empty, then sleep until next event
  async handleDbSuccess() {
    const mode = config.detectionMode;
    const handler = this.modeHandlers[mode];

    if (!handler) {
      throw new Error(`Unknown mode: ${mode}`);
    }

    if (await handler.canStart()) {
      log({ module: 'analysis manager', msg: 'Starting the analysis...' });
      await handler.run();
    } else {
      log({ module: 'analysis manager', msg: 'Nothing to analyze yet' });
    }
  }



  async startVerticalAnalysis() {
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

      match.success
        ? emit({ type: events.GEN_REQ, payload: match })
        : log({ module: 'analysis loop', msg: 'No results' });

      // keys of remaining elements do not change after deleting an entry
      await this.stateManager.deleteHTTPEvent(lastKey);
    }

    log({ module: 'analysis manager', msg: 'Exit analysis' });
  }



  async startHorizontalAnalysis() {

  }
}
