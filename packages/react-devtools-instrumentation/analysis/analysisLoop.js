//===================
// Import
//===================
import { emit, eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage, listenToMsg, getValueAtPath } from "../utils.js";
import { StateManager } from "../state/stateManager.js";
import { RequestGenerator } from "./requestGenerator.js";
import { config } from "../config.js";
import { GraphSearch } from "./graphSearch.js";


//===================
// Functions
//===================
export class AnalysisLoop {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.requestGenerator = new RequestGenerator(this.stateManager);
    this.graphSearch = new GraphSearch(this.stateManager);
    this.analysisCounter = 0;
  }


  init() {
    this.requestGenerator.init();
  }



  async startAnalysis() {
    this.analysisCounter = 0;
    let httpEvent = {};

    httpEventLoop: while (true) { // HTTP events loop
      httpEvent = await this.stateManager.getNextHttpEvent(httpEvent?.key);

      if (!httpEvent) {
        log({ module: 'analysis manager', msg: 'no more HTTP events' });
        break httpEventLoop;
      }

      const totHTTPevents = await this.stateManager.getTotalHttpEvent();
      const totStates = await this.stateManager.getTotalStates();
      const { request, doneOn, ignore, navigationInfo: httpNavInfo } = httpEvent.value;
      const properties = request.analysis.toEvaluate;

      if (!properties.length || !properties.some(i => i.value) || ignore) {
        this.updateDOM({ totStates, totHTTPevents, increment: totStates });
        continue;
      }

      let snapshot = {};

      stateLoop: while (true) {
        snapshot = await this.stateManager.getNextState(snapshot?.key);
        // log({ module: 'worker handler', msg: `HTTP event ${httpEvent.key}, state ${snapshot?.key}` });
        if (!snapshot) { break stateLoop; }

        this.updateDOM({ totStates, totHTTPevents });

        const { navigationInfo: stateNavInfo } = snapshot.value;
        if (doneOn.has(snapshot.key) || !this.isInAnalysisWindow(httpNavInfo?.idx, stateNavInfo?.idx)) { continue; }

        console.time('searchInGraph');
        const results = await this.graphSearch.find({ snapshot: snapshot.value, key: snapshot.key, properties, http: httpEvent.value });
        console.timeEnd('searchInGraph');

        results.success
          ? emit({ type: events.GEN_REQ, payload: results })
          : log({ module: 'worker handler', msg: 'no results' });

        doneOn.add(snapshot.key); // flag current HTTP event as done for this snapshot
        await this.stateManager.updateHTTPevent({ id: httpEvent.key, payload: { doneOn } });
      }
    }

    log({ module: 'analysis manager', msg: 'exit analysis' });
  }



  isInAnalysisWindow(id1, id2) {
    if (!id1 || !id2) { return false; }
    const isValid = Math.abs(id1 - id2) <= config.maxPagesPerHTTPEvent;
    if (!isValid) {
      log({ module: 'analysis manager', msg: 'HTTP event out of analysis window, analysis skipped' });
      // [TODO] delete old http event (?)
    }
    return isValid;
  }



  updateDOM({ totStates, totHTTPevents, increment = 1 }) {
    this.analysisCounter += increment;
    const payload = { on_progress: true, progress: {} };

    const totalOperations = totHTTPevents * totStates;
    payload.progress.max = totalOperations;
    payload.progress.totHTTPevents = totHTTPevents;
    payload.progress.totStates = totStates;
    payload.progress.value = this.analysisCounter;

    if (payload.progress.value == totalOperations) {
      payload.on_progress = false;
    }

    emit({ type: events.ANALYSIS_IN_PROGRESS, payload });
  }
}
