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
    // `HTTP events` are often stored before `state events`
    const hasOneHttpEvent = await this.stateManager.hasOneHttpEvent();
    const hasOneState = await this.stateManager.hasOneState();
    const canStartAnalysis = hasOneState && hasOneHttpEvent;
    if (!canStartAnalysis) { return; }
    log({ module: 'analysis manager', msg: 'starting the analysis...' });
    await this.startAnalysis();
  }



  async startAnalysis() {
    this.stop = false;
    let currentHttpEvent = {};
    let currentSnapshot = {};

    while (!this.stop) {
      currentHttpEvent = await this.stateManager.getNextHttpEvent(currentHttpEvent?.key);

      if (!currentHttpEvent) {
        log({ module: 'analysis manager', msg: 'no more HTTP events' });
        this.stop = true;
        break;
      }

      const { request, response, done } = currentHttpEvent.value;
      const { fullPath, segments } = request.meta.path; // {fullPath: 'api/images/red/...', segments: ['api', 'images', ...]}

      if (done || !segments.length) { continue; } // HTTP event already analized 

      while (!this.stop) {
        currentSnapshot = await this.stateManager.getNextState(currentSnapshot?.key);
        if (!currentSnapshot) { break; } // no more state events, break only this loop and try other HTTP events

        // this.analysisCounter++;
        // log({ module: 'analysis manager', msg: `analysis ${this.analysisCounter}, with HTTP event key:${currentHttpEvent.key} and state key:${currentSnapshot.key}` })
        
        const results = this.searchPropertyInGraph({ graph: currentSnapshot.value, key: currentSnapshot.key, property: segments[segments.length - 1] });

        // [TODO]
        // - currently, we find the component whose state matches the last segment in the endpoint (eg. /id)
        // - this is usually a single component, that may have siblings
        // - however, the same components may be used in other sets, with other siblings
        // - we are not matching these components given that they have no direct relation with the data extracted from the endpoint
        // - however, we can look for other instances of the same component. If these instances have siblings, here we go
        // - can this be done from the Bridge (?)

        if (results.size) {
          const matchingSets = await this.processResults([...results]);
          if (matchingSets.length) {
            const payload = { matchingSets, http: currentHttpEvent.value };
            emit({ type: events.GEN_REQ, payload });
          }
        } else {
          log({ module: 'analysis manager', msg: 'no matches found' });
        }

        // flag current HTTP event as done
        await this.stateManager.updateHTTPevent({ id: currentHttpEvent.key, payload: { done: true } });
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
          log({ module: 'analysis manager', msg: !match ? 'value extracted from reference component has no matches on siblings' : 'sibling has the same value as the reference component' });
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
      if (acc === undefined || acc === null) { return undefined; }
      return acc[key];
    }, obj);
  }
}

