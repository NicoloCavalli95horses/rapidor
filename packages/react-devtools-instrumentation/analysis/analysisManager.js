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

    emit({ type: events.ANALYSIS_IN_PROGRESS, payload: true })

    while (!this.stop) {
      currentHttpEvent = await this.stateManager.getNextHttpEvent(currentHttpEvent?.key);

      if (!currentHttpEvent) {
        log({ module: 'analysis manager', msg: 'no more HTTP events' });
        this.stop = true;
        break;
      }

      const http = currentHttpEvent.value;
      const httpKey = currentHttpEvent.key;
      const { request, response, doneOn, ignore } = http;
      const { fullPath, segments } = request.meta.path; // {fullPath: 'api/images/red/...', segments: ['api', 'images', ...]}
      const property = segments[segments.length - 1];

      if (ignore) { continue; } // HTTP event already analized 

      while (!this.stop) {
        currentSnapshot = await this.stateManager.getNextState(currentSnapshot?.key);
        if (!currentSnapshot) { break; } // no more state events, break only this loop and try other HTTP events

        const graph = currentSnapshot.value;
        const snapshotKey = currentSnapshot.key;

        if (doneOn.has(snapshotKey)) { continue; }

        // this.analysisCounter++;
        // log({ module: 'analysis manager', msg: `analysis ${this.analysisCounter}, with HTTP event key:${httpKey} and state key:${currentSnapshot.key}` })

        const results = this.searchPropertyInGraph({ graph, key: snapshotKey, property });

        // [TODO]
        // - currently, we find the component whose state matches the last segment in the endpoint (eg. /id)
        // - this is usually a unique component, that may have siblings
        // - however, the same components may be used elsewhere in the app, with other siblings
        // - we are not matching these other components, given that they have no direct relation with the data extracted from the endpoint

        if (results.size) {
          const matchingSets = await this.processResults([...results]);
          if (matchingSets.length) {
            const payload = { matchingSets, http };
            emit({ type: events.GEN_REQ, payload });
          }
        } else {
          log({ module: 'analysis manager', msg: 'no matches found' });
        }

        doneOn.add(snapshotKey); // flag current HTTP event as done for this snapshot
        await this.stateManager.updateHTTPevent({ id: httpKey, payload: { doneOn } });
      }
    }

    log({ module: 'analysis manager', msg: 'exit analysis' });
    emit({ type: events.ANALYSIS_IN_PROGRESS, payload: false })
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

