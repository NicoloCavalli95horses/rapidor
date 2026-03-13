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
    this.stop = false;
    this.requestGenerator = new RequestGenerator(this.stateManager);
    this.analysisCounter = 0;
  }


  init() {
    this.requestGenerator.init();
  }



  async startAnalysis() {
    this.stop = false;
    this.analysisCounter = 0;
    let httpEvent = {};

    while (!this.stop) { // HTTP events loop
      httpEvent = await this.stateManager.getNextHttpEvent(httpEvent?.key);

      if (!httpEvent) {
        log({ module: 'analysis manager', msg: 'no more HTTP events' });
        this.stop = true;
        break;
      }

      const http = httpEvent.value;
      const httpKey = httpEvent.key;
      const { request, response, doneOn, ignore } = http;
      const { fullPath, segments } = request.meta.path; // {fullPath: 'api/images/red/...', segments: ['api', 'images', ...]}
      const property = segments[segments.length - 1];
      const totHTTPevents = await this.stateManager.getTotalHttpEvent();
      const totStates = await this.stateManager.getTotalStates();
      let snapshot = {};

      if (ignore) {
        // HTTP event already analized 
        this.updateDOM({ totStates, totHTTPevents, increment: totStates });
        continue;
      }

      while (true) { // state loop
        snapshot = await this.stateManager.getNextState(snapshot?.key);
        if (!snapshot) { break; } // no more state events, break only this loop and try other HTTP events

        const graph = snapshot.value;
        const snapshotKey = snapshot.key;

        this.updateDOM({ totStates, totHTTPevents });

        if (doneOn.has(snapshotKey)) {
          continue;
        }

        const results = this.searchPropertyInGraph({ graph, key: snapshotKey, property });

        if (results.size) {
          const res = [...results];
          const matchingSets = await this.processResults(res);
          if (matchingSets.length) {
            emit({ type: events.GEN_REQ, payload: { matchingSets, http } });

            // there is a match: explore instances of the matching node other than siblings
            for (let i = 0; i < res.length; i++) {
              const node = res[i].node;
              const instances = await this.stateManager.getInstancesOfComponent(snapshotKey, node.componentId);
              // console.log({instances});              
            }
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



  // searching for property (eg. api/collection/id -> id) inside a graph
  // returns array of matching nodes [ {node},{node} ]
  // each node has: `path` (to the get the value), `relations`, snapshot `key`
  searchPropertyInGraph({ graph, key, property }) {
    const { nodes, relations } = graph;
    const results = new Set();
    const visited = new WeakSet();

    function visit({ value, path, node }) {

      if (property === value) {
        results.add({
          node: { ...node, isOriginalMatch: true },
          relations: relations[node.id],
          rowId: key,
          path: [...path],
          value,
          ratio: "a value within this node matches a segment extracted from an HTTP request. This is the first of many siblings that appear in the component tree",
        });

        return;
      }

      if (!value || typeof value !== "object") { return; }
      if (visited.has(value)) { return; }

      visited.add(value);

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          visit({ value: item, path: [...path, index], node });
        });
      } else {
        Object.keys(value).forEach(key => {
          visit({ value: value[key], path: [...path, key], node });
        });
      }
    }

    const ids = new Set();

    // we specifically focus on list of elements, hence we consider only node with siblings
    for (const [id, relation] of Object.entries(relations)) {
      if (Object.hasOwn(relation, 'sibling')) {
        ids.add(id);
      }
    }

    for (const id of ids) {
      const node = nodes[id];
      visit({ value: node, path: [], node });
    }

    return results;
  }



  // for each node, build sub-arrays with siblings and DOM references
  // returns = [ [{node},{node}]  [{node},{node}] ]
  async processResults(results) {
    // [TODO] if the ancestor that has DOM info is common, we may save it just once, like {DOM: {}, matches:{}}
    const matches = [];

    for (const result of results) {
      const siblingNodes = [];
      const { path, relations, value: referenceMatch, node: referenceNode, rowId } = result;
      const { sibling: siblingIds, siblingIdx } = relations;

      if (!referenceNode.DOM) {
        referenceNode.DOM = await this.stateManager.getAncestorDOM(rowId, referenceNode.parent);
      }

      referenceNode.siblingIds = siblingIds;
      referenceNode.siblingIdx = siblingIdx;
      referenceNode.match = referenceMatch;

      for (const id of siblingIds) {
        const siblingNode = await this.stateManager.getNodeByID(rowId, id);
        const siblingRelations = await this.stateManager.getRelationsByID(rowId, id);

        // take matching value from sibling node
        const match = this.getValueAtPath(siblingNode, path);

        if (!match || match == referenceMatch) {
          log({ module: 'analysis manager', msg: !match ? 'value extracted from reference component has no matches on siblings' : 'a sibling was found, but it has the same value as the reference component' });
          continue;
        }

        // find DOM references if not present
        if (!siblingNode.DOM) {
          siblingNode.DOM = await this.stateManager.getAncestorDOM(rowId, id);
        }

        siblingNode.siblingIds = siblingRelations.sibling;
        siblingNode.siblingIdx = siblingRelations.siblingIdx;
        siblingNode.match = match;
        siblingNodes.push(siblingNode);
      }

      if (siblingNodes.length) {
        // match is invalid if there are no siblings
        matches.push({ referenceNode, siblingNodes });
      }
    }

    return matches;
  }



  getValueAtPath(obj, path) {
    return path.reduce((acc, key) => {
      if (acc === undefined || acc === null) { return; }
      return acc[key];
    }, obj);
  }
}

