//===================
// Import
//===================
import { emit, eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage, listenToMsg, getValueAtPath } from "../utils.js";
import { StateManager } from "../state/stateManager.js";
import { RequestGenerator } from "./requestGenerator.js";
import { config } from "../config.js";


//===================
// Functions
//===================
export class WorkerHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.requestGenerator = new RequestGenerator(this.stateManager);
    this.analysisCounter = 0;
  }


  init() {
    this.requestGenerator.init();
    this.onResults();
  }



  onResults() {
    const self = this;

    const handler = async (e) => {
      if (e.source !== window) { return; }
      if (e.data?.type != events.ANALYSIS_DONE) { return; }

      const event = e.data.payload?.payload;
      const error = e.data.payload?.error;

      if (error) {
        log({ module: 'worker handler', msg: error, type: 'error' });
        return;
      }
      if (!event.success) { return; }

      const { results, componentIndex, nodes, relations } = event.results;

      // the analysis must be completed here, cannot access the same IndexedDB instance from the service worker
      const matchingSets = await self.processResults({ results, componentIndex, nodes, relations });
      matchingSets.length
        ? emit({ type: events.GEN_REQ, payload: { matchingSets, http: event.http } })
        : log({ module: 'worker handler', msg: 'no results' });
    }

    window.addEventListener('message', handler);
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

        // [worker.js] DFS components graph to find matches on given properties
        sendPostMessage({
          type: events.START_ANALYSIS,
          payload: { snapshot: snapshot.value, key: snapshot.key, properties, http: httpEvent.value }
        });

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



  // For each matching node, build sub-arrays with candidates and DOM references
  // [[ {referenceNode: {...}}, {candidateNodes: [{...},{...}] ]]
  async processResults({ results, componentIndex, nodes, relations }) {
    if (!results.length) { return []; }
    const couples = [];

    for (const result of results) {
      const instanceId = result.node.componentId;
      const nodeIds = componentIndex[instanceId];
      const candidateNodes = [];
      const domPromises = [];

      if (!result.node.DOM) {
        result.node.DOM = await this.stateManager.getAncestorDOM(result.rowId, result.node.id);
      }

      if (!nodeIds.length) { continue; }

      for (const candidateId of nodeIds) {
        if (candidateId === result.node.id) { continue; }

        const candidateNode = nodes[candidateId];
        const candidateMatch = getValueAtPath(candidateNode, result.path);

        if ([null, undefined, ''].includes(candidateMatch)) { continue; }

        if (!candidateNode.DOM) {
          domPromises.push(
            this.stateManager
              .getAncestorDOM(result.rowId, candidateNode.id)
              .then(dom => { candidateNode.DOM = dom; })
          );
        }

        const candidateTarget = structuredClone(result.target);
        candidateTarget.value = candidateMatch;

        candidateNodes.push({
          node: candidateNode,
          rowId: result.rowId,
          path: result.path,
          target: candidateTarget,
          relations: relations[candidateNode.id]
        });
      }

      await Promise.all(domPromises);

      if (candidateNodes.length) {
        couples.push({ referenceNode: result, candidateNodes })
      }
    }

    return couples;
  }
}
