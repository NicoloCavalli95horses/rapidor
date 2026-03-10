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
export class AnalysisManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.stop = false;
    this.requestGenerator = new RequestGenerator(this.stateManager);
    this.analysisCounter = 0;
  }

  init() {
    this.requestGenerator.init();

    eventBus
      .pipe(filter(e => e.type === events.DB_SUCCESS))
      .subscribe(e => this.onDbSuccess(e.payload.type));
  }



  // `HTTP events` can be stored before `state events`
  // start the analysis only after the first state snapshots
  // and only if valid HTTP events are present
  async onDbSuccess(type) {
    if (type !== events.STATE_UPDATE) { return; }
    const canStart = await this.stateManager.hasOneHttpEvent();
    if (!canStart) { return; }

    log({ module: 'analysis manager', msg: 'starting the analysis...' });

    this.stop = false;
    let currentHttpEvent = {};
    let currentSnapshot = {};

    while (!this.stop) {
      currentHttpEvent = await this.stateManager.getNextHttpEvent(currentHttpEvent?.key);
      if (!currentHttpEvent) { this.stop = true; break; } // no more HTTP events

      const { request, response, done } = currentHttpEvent.value;
      const { fullPath, segments } = request.meta.path; // {fullPath: 'api/images/red/...', segments: ['api', 'images', ...]}

      if (done || !segments.length) { continue; } // HTTP event already analized 

      while (!this.stop) {
        currentSnapshot = await this.stateManager.getNextState(currentSnapshot?.key);
        if (!currentSnapshot) { break; } // no more state events, break only this loop and try other HTTP events

        this.analysisCounter++;
        // log({ module: 'analysis manager', msg: `analysis ${this.analysisCounter}, with HTTP event key:${currentHttpEvent.key} and state key:${currentSnapshot.key}` })
        const results = this.searchPropertyInGraph({ graph: currentSnapshot.value, key: currentSnapshot.key, property: segments[segments.length - 1] });

        if (results.size) {
          const matchingSets = await this.processResults([...results]);
          const payload = { matchingSets, http: currentHttpEvent.value };
          emit({ type: events.GEN_REQ, payload });
        } else {
          log({ module: 'analysis manager', msg: 'no matches found' });
        }

        // flag current HTTP event as done
        const res = await this.stateManager.updateHTTPevent({ id: currentHttpEvent.key, payload: { done: true } });
      }
    }

    log({ module: 'analysis manager', msg: 'exit analysis' });
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
      const { path, relations, value, node: referenceNode, rowId } = result;
      const { sibling: siblingIds, siblingIdx } = relations;

      if (!referenceNode.DOM) {
        referenceNode.DOM = await this.stateManager.getAncestorDOM(rowId, referenceNode.parent);
      }

      referenceNode.siblingIds = siblingIds;
      referenceNode.siblingIdx = siblingIdx;
      referenceNode.match = value;

      for (const id of siblingIds) {
        const siblingNode = await this.stateManager.getNodeByID(rowId, id);
        const siblingRelations = await this.stateManager.getRelationsByID(rowId, id);

        // take matching value from sibling node
        const match = this.getValueAtPath(siblingNode, path);
        if (!match) { continue; }

        // find DOM references if not present
        if (!siblingNode.DOM) {
          siblingNode.DOM = await this.stateManager.getAncestorDOM(rowId, id);
        }

        siblingNode.siblingIds = siblingRelations.sibling;
        siblingNode.siblingIdx = siblingRelations.siblingIdx;
        siblingNode.match = match;
        siblingNodes.push(siblingNode);
      }
      matches.push({ referenceNode, siblingNodes });
    }

    return matches;
  }



  getValueAtPath(obj, path) {
    return path.reduce((acc, key) => {
      if (acc === undefined || acc === null) { return undefined; }
      return acc[key];
    }, obj);
  }
}

