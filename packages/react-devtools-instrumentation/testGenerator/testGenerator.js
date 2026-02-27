//===================
// Import
//===================
import { eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { hasOwnKeys, log, sendPostMessage } from "../utils.js";
import { StateManager } from "../stateManager/stateManager.js";


//===================
// Functions
//===================
export class TestGenerator {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.stop = false;
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.DB_SUCCESS))
      .subscribe(e => this.onDbSuccess(e.payload.type));
  }



  async onDbSuccess(type) {
    // `HTTP events` can be stored before `state events`
    // start the analysis only after the first state snapshots
    // and only if (valid) HTTP events have been stored
    if (type !== events.STATE_UPDATE) { return; }
    const canStart = await this.stateManager.hasHTTPevents();
    if (!canStart) { return; }

    log('[TEST GENERATOR] starting the test generation...');

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
        currentSnapshot = await this.stateManager.getNextState(currentSnapshot?.key);

        if (!currentSnapshot) {
          // dont exit here, we want to try other stored HTTP events
          break;
        }

        const { nodes, relations } = currentSnapshot.value;

        await this.searchProperties({ nodes, properties: segments });
      }
    }
    log('[TEST GENERATOR] exit analysis')
  }



  // [TODO]
  // - keep the currentHttpEvent snapshot as valid and stop the search if we have at least one component matching one properties
  // - get sibling components and extract data from them
  // - construct alternative endpoints applying gradual transformation to the endpoint, STARTING FROM THE END ie:
  //   `/api/images/id1/red`
  //   `api/images/id2/red` -> still worth exploring
  //   `api/images/id2/green`

  // For now, the goal is to construct as much requests as possible
  // By evaluating the responses we will filter them, ie basically if we dont get a `200 OK` we rule it out
  // In other words, we just test `accesses by mistake` and we do not test `inaccesses by mistake` (is this a real vulnerability?)
  searchProperties({ nodes, properties }) {
    const result = new Set(); // to avoid duplicates
    const visited = new WeakSet(); // to avoid infinite loops, memory leaks
    const self = this;

    function visit(value, node) {
      if (properties.includes(value)) {
        node._priv = {
          properties,
          value,
          ratio: "one or more values within this node matches one or more properties extracted from an HTTP request"
        }
        result.add(node);
        self.stop = true;
        return;
      }

      if (!value || typeof value !== "object") { return };

      if (visited.has(value)) { return };

      visited.add(value);

      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item, node);
        }
      } else {
        for (const key of Object.keys(value)) {
          visit(value[key], node);
        }
      }
    }

    for (const node of Object.values(nodes)) {
      if (node.tag != 5) { continue; } // HostComponent
      visit(node.props, node);
    }

    const arr = Array.from(result);
    if (arr.length) {
      log('[TEST GENERATOR] Nodes matches: ', arr);
    }
    return arr;
  }
}

