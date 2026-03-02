//===================
// Import
//===================
import { emit, eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { hasOwnKeys, log, sendPostMessage } from "../utils.js";
import { StateManager } from "../state/stateManager.js";
import { RequestGenerator } from "./requestGenerator.js";



//===================
// Functions
//===================
export class AnalysisManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.stop = false;
    this.requestGenerator = new RequestGenerator(this.stateManager);
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
    // and only if (valid) HTTP events have been stored
    if (type !== events.STATE_UPDATE) { return; }
    const canStart = await this.stateManager.hasOneHttpEvent();
    if (!canStart) { return; }

    log('[ANALYSIS MANAGER] starting the test generation...');

    this.stop = false;
    let currentHttpEvent = {};
    let currentSnapshot = {};

    while (!this.stop) {
      currentHttpEvent = await this.stateManager.getNextHttpEvent(currentHttpEvent?.key);

      if (!currentHttpEvent) {
        this.stop = true;
        break;
      }

      const { request, response } = currentHttpEvent.value;
      const { fullPath, segments } = request.meta.path; // endpoint details {fullPath: 'api/images/red/...', segments: ['api', 'images', ...]}

      if (!segments.length) {
        this.stop = true;
        break;
      }

      while (!this.stop) {
        // if (this.results.size) {
        //   // results are found in a snapshot, do not iterate over the next
        //   break;
        // }

        currentSnapshot = await this.stateManager.getNextState(currentSnapshot?.key);

        if (!currentSnapshot) {
          // dont exit here, we want to try other stored HTTP events
          break;
        }

        const { nodes, relations } = currentSnapshot.value;

        const res = await this.searchProperty({ nodes, property: segments[segments.length -1] });

        if (res.size) {
          const payload = {
            nodes: [...res],
            http: currentHttpEvent.value
          };

          emit({ type: events.GEN_REQ, payload });
        }
      }
    }

    log('[ANALYSIS MANAGER] exit analysis')
  }



  searchProperty({ nodes, property }) {
    const results = new Set();
    const visited = new WeakSet();

    function visit({ value, node, path }) {
      if (property === value) {
        node._results.push({
          path: [...path],
          value,
          ratio: "a value within this node matches a segment extracted from an HTTP request"
        });
        
        results.add(node);
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
      if (node.tag != 5) { continue; } // HostComponent
      node._results = [];
      visit({ value: node.props, node, path: ['props'] });
    }

    return results;
  }
}

