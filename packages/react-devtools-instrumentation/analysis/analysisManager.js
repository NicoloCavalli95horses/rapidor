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
        log({ module: 'analysis manager', msg: `analysis ${this.analysisCounter}, with HTTP event key:${currentHttpEvent.key} and state key:${currentSnapshot.key}` })

        const { nodes, relations } = currentSnapshot.value;

        const results = await this.searchPropertyInNodes({ nodes, property: segments[segments.length - 1], rowId: currentSnapshot.key });

        if (results.size) {
          emit({
            type: events.GEN_REQ,
            payload: {
              results: [...results],
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



  searchPropertyInNodes({ nodes, property, rowId }) {
    const results = new Set();
    const visited = new WeakSet();

    function visit({ value, node, path }) {
      if (property === value) {
        results.add({
          nodeId: node.id,
          path: [...path],
          value,
          ratio: "a value within this node matches a segment extracted from an HTTP request",
          rowId,
          node,
        });

        return;
      }

      if (!value || typeof value !== "object") { return; }
      if (visited.has(value)) { return; }

      visited.add(value);

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          visit({ value: item, node, path: [...path, index] });
        });
      } else {
        Object.keys(value).forEach(key => {
          visit({ value: value[key], node, path: [...path, key] });
        });
      }
    }

    for (const node of Object.values(nodes)) {
      if (config.allowedNodeTags.includes(node.tag)) {
        visit({ value: node.props, node, path: ['props'] });
      }
    }

    return results;
  }
}

