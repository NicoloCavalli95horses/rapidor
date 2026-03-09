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



  async onDbSuccess(type) {
    // `HTTP events` can be stored before `state events`
    // start the analysis only after the first state snapshots
    // and only if valid HTTP events are present
    if (type !== events.STATE_UPDATE) { return; }
    const canStart = await this.stateManager.hasOneHttpEvent();
    if (!canStart) { return; }

    log({ module: 'analysis manager', msg: 'starting the analysis...' });

    this.stop = false;
    let currentHttpEvent = {};
    let currentSnapshot = {};

    while (!this.stop) {
      currentHttpEvent = await this.stateManager.getNextHttpEvent(currentHttpEvent?.key);

      if (!currentHttpEvent) {
        // no more HTTP events
        this.stop = true;
        break;
      }

      const { request, response, done } = currentHttpEvent.value;
      const { fullPath, segments } = request.meta.path; // endpoint details {fullPath: 'api/images/red/...', segments: ['api', 'images', ...]}

      if (done || !segments.length) {
        // HTTP event already analized 
        continue;
      }

      while (!this.stop) {
        currentSnapshot = await this.stateManager.getNextState(currentSnapshot?.key);

        if (!currentSnapshot) {
          // no more state events, break this loop and try other HTTP events
          break;
        }

        this.analysisCounter++;
        // log({ module: 'analysis manager', msg: `analysis ${this.analysisCounter}, with HTTP event key:${currentHttpEvent.key} and state key:${currentSnapshot.key}` })

        // searching for last segment in endpoint (eg. api/collection/id -> id)
        // results = [ {node},{node} ] array of unique matching nodes
        const results = this.searchPropertyInGraph({
          graph: currentSnapshot.value,
          key: currentSnapshot.key,
          property: segments[segments.length - 1]
        });

        if (results.size) {
          // for each matching node, build sub-arrays with siblings and DOM references
          // matchingSets = [ [{node},{node}]  [{node},{node}] ]
          const matchingSets = await this.processResults([...results]);
          emit({
            type: events.GEN_REQ,
            payload: {
              matchingSets,
              http: currentHttpEvent.value
            }
          });
        } else {
          log({ module: 'analysis manager', msg: 'no matches found' });
        }

        // flag current HTTP event as done
        const res = await this.stateManager.updateHTTPevent({
          id: currentHttpEvent.key,
          payload: { done: true }
        });

      }
    }

    log({ module: 'analysis manager', msg: 'exit analysis' });
  }



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
          ratio: "a value within this node matches a segment extracted from an HTTP request",
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


  // for each nodes, get siblings and append DOM references 
  async processResults(results) {
    // [TODO] if the ancestor that has DOM info is common, we may save it just once, like {DOM: {}, matches:{}}
    const matches = [];

    for (const result of results) {
      const siblingNodes = [];
      const { path, relations, value, node: referenceNode, rowId } = result;
      const { sibling: siblingIds } = relations;

      if (!referenceNode.DOM) {
        referenceNode.DOM = await this.stateManager.getAncestorDOM(rowId, referenceNode.parent);
      }

      referenceNode.siblingIds = siblingIds;
      referenceNode.match = value;

      for (const id of siblingIds) {
        const siblingNode = await this.stateManager.getStateByID(rowId, id);

        // take matching value from sibling node
        const match = this.getValueAtPath(siblingNode, path);

        if (!match) { continue; }

        // find DOM references if not present
        if (!siblingNode.DOM) {
          siblingNode.DOM = await this.stateManager.getAncestorDOM(rowId, id);
        }

        siblingNode.siblingIds = [...siblingIds, referenceNode.id].filter(id => id !== siblingNode.id);
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

