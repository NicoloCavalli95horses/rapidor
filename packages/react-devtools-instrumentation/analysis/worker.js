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
      const { request, response, doneOn, ignore, navigationInfo: httpNavInfo } = http;
      const property = request.meta.path.property;
      const isFile = request.meta.isFileByMime;

      if (isFile) {
        // rule out files because we cannot solve the oracle problem in this scenario
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

        const { nodes, relations, navigationInfo: stateNavInfo } = snapshot.value;
        const snapshotKey = snapshot.key;

        this.updateDOM({ totStates, totHTTPevents });

        if (doneOn.has(snapshotKey) || !this.isInAnalysisWindow(httpNavInfo?.idx, stateNavInfo?.idx)) { continue; }

          // find components that have the property and that have siblings
          const matches = this.getMatches({ nodes, relations, key: snapshotKey, property }); // [ {node1}, {node2} ]

        if (matches.length) {
          const matchingSets = await this.processResults(matches); // [[ {referenceNode: {...}}, {siblingNodes: [{...},{...}] ]]

          if (matchingSets?.length) {
            emit({ type: events.GEN_REQ, payload: { matchingSets, http } });
          }
        } else {
          log({ module: 'analysis manager', msg: 'no matches found' });
        }

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
  // each node has: `path` (to the get the value), `relations`, snapshot `key`
  getMatches({ nodes, relations, key, property }) {
    const matches = [];
    const ids = new Set();

    for (const [id, relation] of Object.entries(relations)) {
      // we specifically focus on list of elements, hence we consider only node with siblings
      if (!Object.hasOwn(relation, 'sibling')) { continue; }

      const node = nodes[id];
      const match = this.getMatchingNode({ value: node, toFind: property });

      if (match && !ids.has(node.id)) {
        matches.push({
          node,
          relations: relation,
          rowId: key,
          ratio: "a value within this node matches a segment extracted from an HTTP request. This is the first of many siblings that appear in the component tree",
          ...match
        });

        ids.add(node.id);
      }
    }

    return matches;
  }



  getMatchingNode({ value, path = [], toFind }) {
    const visited = new WeakSet();

    function visit({ value, path }) {
      if (value === toFind) {
        return { path: [...path], value };
      }

      if (!value || typeof value !== "object") { return; }
      if (visited.has(value)) { return; }

      visited.add(value);

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const result = visit({ value: value[i], path: [...path, i] });
          if (result) { return result; }
        }
      } else {
        for (const k of Object.keys(value)) {
          const result = visit({ value: value[k], path: [...path, k] });
          if (result) { return result; }
        }
      }
    }

    return visit({ value, path });
  }



  // for each node, build sub-arrays with siblings and DOM references
  // [[ {referenceNode: {...}}, {siblingNodes: [{...},{...}] ]]
  async processResults(results) {
    const matches = [];
    const self = this;

    for (const result of results) {
      const siblingNodes = [];
      const { path, relations, value: referenceMatch, node: referenceNode, rowId } = result;
      let { sibling, siblingIdx } = relations;
      await prepareNode({ node: referenceNode, rowId, siblingIds: sibling, siblingIdx, match: referenceMatch });

      // consider other istances of the reference node that are NOT among its siblings
      // we can append these istances as artificial siblings to continue the analysis
      if (referenceNode.componentId) {
        const istancesIds = await this.expandSiblingIds({ componentId: referenceNode.componentId, referenceIds: [referenceNode.id, ...sibling], rowId });
        sibling = [...sibling, ...istancesIds];
      }

      for (const id of sibling) {
        const node = await this.stateManager.getNodeByID(rowId, id);
        const relations = await this.stateManager.getRelationsByID(rowId, id);
        const match = this.getValueAtPath(node, path);

        if (!match || match == referenceMatch) {
          log({ module: 'analysis manager', msg: !match ? 'value extracted from reference component has no matches on siblings' : 'a sibling was found, but it has the same value as the reference component' });
          continue;
        }

        await prepareNode({ node, rowId, siblingIds: relations.sibling, siblingIdx: relations.siblingIdx, match });
        siblingNodes.push(node);
      }

      if (siblingNodes.length) {
        // match is invalid if there are no siblings
        matches.push({ referenceNode, siblingNodes });
      }
    }

    return matches;


    async function prepareNode({ node, rowId, siblingIds, siblingIdx, match }) {
      if (!node.DOM) {
        node.DOM = await self.stateManager.getAncestorDOM(rowId, node.id);
      }
      node.siblingIds = siblingIds;
      node.siblingIdx = siblingIdx;
      node.match = match;
    }
  }



  // expand the list of siblings ids considering other istances of the component that are not among the siblings
  // return expanded list of ids
  async expandSiblingIds({ componentId, referenceIds, rowId }) {
    const instancesIds = await this.stateManager.getIdsOfInstances(rowId, componentId);
    const refSet = new Set(referenceIds);
    return instancesIds.filter(id => !refSet.has(id));
  }



  getValueAtPath(obj, path) {
    return path.reduce((acc, key) => {
      if (acc === undefined || acc === null) { return; }
      return acc[key];
    }, obj);
  }
}

