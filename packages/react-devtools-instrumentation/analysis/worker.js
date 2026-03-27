//===================
// Import
//===================
import { emit, eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { hasOwnKeys, log, sendPostMessage } from "../utils.js";
import { StateManager } from "../state/stateManager.js";
import { RequestGenerator } from "./requestGenerator.js";
import { config } from "../config.js";



//===================
// Functions
//===================
export class Worker {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.requestGenerator = new RequestGenerator(this.stateManager);
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

      const http = httpEvent.value;
      const httpKey = httpEvent.key;
      const { request, doneOn, ignore, navigationInfo: httpNavInfo } = http;
      const property = request.analysis.toEvaluate.property;
      const queryParams = request.analysis.toEvaluate.queryParams;
      const properties = [property, ...queryParams];

      if (!property && !queryParams.length) {
        this.updateDOM({ totStates, totHTTPevents, increment: totStates });
        continue;
      }

      let snapshot = {};

      if (ignore) {
        // HTTP event already analized 
        this.updateDOM({ totStates, totHTTPevents, increment: totStates });
        continue;
      }

      stateLoop: while (true) {
        snapshot = await this.stateManager.getNextState(snapshot?.key);
        if (!snapshot) { break stateLoop; } // no more state events, break only this loop and try other HTTP events

        const { nodes, relations, componentIndex, navigationInfo: stateNavInfo } = snapshot.value;
        const snapshotKey = snapshot.key;

        this.updateDOM({ totStates, totHTTPevents });

        if (doneOn.has(snapshotKey) || !this.isInAnalysisWindow(httpNavInfo?.idx, stateNavInfo?.idx)) { continue; }

        // find components that have the properties and that have at least another istance
        const results = this.getMatches({ nodes, componentIndex, relations, key: snapshotKey, properties });
        const matchingSets = await this.processResults({ results, componentIndex, nodes, relations });

        matchingSets?.length
          ? emit({ type: events.GEN_REQ, payload: { matchingSets, http } })
          : log({ module: 'analysis manager', msg: 'no matches found' });

        doneOn.add(snapshotKey); // flag current HTTP event as done for this snapshot
        await this.stateManager.updateHTTPevent({ id: httpKey, payload: { doneOn } });
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

    // console.log({ current: payload.progress.value, total: totalOperations, totHTTPevents, totStates })

    if (payload.progress.value == totalOperations) {
      payload.on_progress = false;
    }

    emit({ type: events.ANALYSIS_IN_PROGRESS, payload });
  }



  // Returns array of matching nodes [ {node},{node} ]
  // DFS (deep-first search) executed once per set of properties
  getMatches({ nodes, componentIndex, relations, key, properties }) {
    const targets = properties.length ? properties.filter(p => p.value) : [];
    if (!targets.length) { return []; }
    if (!properties.length) { return []; }

    const results = [];
    const ids = new Set();

    for (const nodeIds of Object.values(componentIndex)) {
      if (nodeIds.length <= 1) { continue; } // single istance of component, no possible alternative data

      for (const nodeId of nodeIds) {
        if (ids.has(nodeId)) { continue; }

        const node = nodes[nodeId];
        if (!config.tagsWhitelist.includes(node.tag)) { continue; } // [TODO] check other tags

        const matches = this.getMatchingNode({
          value: node,
          targets,
          keysWhitelist: ['props', 'key'],
          depth: config.graphExplorationDepth,
        });

        if (matches?.length) {
          matches.forEach(match => {
            results.push({ node, rowId: key, ...match, relations: relations[nodeId] });
          });
          ids.add(nodeId);
        }
      }
    }

    return results;
  }



  getMatchingNode({ value, targets, keysWhitelist = [], depth }) {
    const visited = new WeakSet();
    const remainingTargets = new Set(targets);
    const matches = [];

    function visit({ value, path, continueSearch = false }) {
      if (depth && path.length > depth) { return; } // limit graph exploration 
      if (visited.has(value)) { return; }
      
      for (const target of Array.from(remainingTargets)) {
        if (value == target.value) { // loose equality, we must match '123' == 123
          matches.push({ path: [...path], target });
          remainingTargets.delete(target);
        }
      }
      
      if (!value || typeof value !== "object") { return; }
      visited.add(value); // must be an object      
      if (!remainingTargets.size) { return; } // quit if every property is found

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          visit({ value: value[i], path: [...path, i], continueSearch });
          if (!remainingTargets.size) { return; }
        }
      } else {
        for (const k of Object.keys(value)) {
          const isWhitelisted = keysWhitelist.includes(k);
          if (!continueSearch && !isWhitelisted) { continue; }

          // explore only allowed properties recursively (props may be another object)
          visit({ value: value[k], path: [...path, k], continueSearch: continueSearch || isWhitelisted });
          if (!remainingTargets.size) { return; }
        }
      }
    }

    visit({ value, path: [], continueSearch: false });

    return matches;
  }



  getValueAtPath(obj, path) {
    return path.reduce((acc, key) => {
      if (acc != null && Object.hasOwn(acc, key)) {
        return acc[key];
      }
      return undefined;
    }, obj);
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
        const candidateMatch = this.getValueAtPath(candidateNode, result.path);

        if ([null, undefined, ''].includes(candidateMatch)) { continue; }

        if (!candidateNode.DOM) {
          domPromises.push(this.stateManager.getAncestorDOM(result.rowId, candidateNode.id).then(dom => { candidateNode.DOM = dom; }));
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

