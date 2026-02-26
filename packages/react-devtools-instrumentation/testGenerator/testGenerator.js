//===================
// Import
//===================
import { eventBus } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { hasOwnKeys, log, sendPostMessage } from "../utils.js";
import { StateManager } from "../stateManager/stateManager.js";


//===================
// Functions
//===================
export class TestGenerator {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  init() {
    eventBus
      .pipe(filter(event => event.type === "HTTP_EVENT"))
      .subscribe(event => this.onNetworkEvent(event));
  }

  // every time we have an HTTP event, testGenerator performs a search on the EXISTING rows in IndexedDB
  // if rows are added after the HTTP event, we do not see them
  // [TO DO]
  // - save all the HTTP events, and then listening to the STATE_UPDATE events
  // - If more than 3000ms passes after a STATE_UPDATE event, we start working with the HTTP events, and only then we start parsing the available rows
  async onNetworkEvent(event) {
    log('[TEST GENERATOR] processing HTTP event...');

    const { request, response } = event.payload;
    const { fullPath, segments } = request.meta.path; // endpoint details {fullPath: 'api/images/red/...', segments: ['api', 'images', ...]}
    if (segments.length) {
      const result = await this.findComponent(segments);
    }
  }



  // this will return one or more components containing endpoint segments
  async findComponent(properties) {
    return this.stateManager.findState((row) => {
      const result = this.searchProperty({ state: row, properties });

      if (result.length) {
        return result;
      }

      return false;
    });
  }



  // [TODO]
  // - keep the current snapshot as valid and stop the search if we have at least one component matching one property
  // - get sibling components and extract data from them
  // - construct alternative endpoints applying gradual transformation to the endpoint, STARTING FROM THE END ie:
  //   `/api/images/id1/red`
  //   `api/images/id2/red` -> still worth exploring
  //   `api/images/id2/green`

  // For now, the goal is to construct as much requests as possible
  // By evaluating the responses we will filter them, ie basically if we dont get a `200 OK` we rule it out
  // In other words, we just test `accesses by mistake` and we do not test `inaccesses by mistake` (is this a real vulnerability?)
  searchProperty({ state, properties }) {
    const result = new Set(); // to avoid duplicates
    const visited = new WeakSet(); // to avoid infinite loops, memory leaks
    const nodes = state.nodes; // to check, I removed a wrapper

    function visit(value, node) {
      if (properties.includes(value)) {
        node._matchHTTPRequestData = {
          properties,
          value,
          ratio: "at least one value within this node matches at least one property extracted from a HTTP request"
        }
        result.add(node);
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
      console.log(arr);
    }
    return arr;
  }
}

