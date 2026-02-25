//===================
// Import
//===================
import { eventBus } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { isObjEmpty, log, sendPostMessage } from "../utils.js";
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

      if (result.matchFound) {
        return result;
      }

      return false;
    });
  }


  searchProperty({ state, properties }) {
    // [TODO]
    // - keep the current snapshot as valid and stop the search if we have at least one component matching one property 
    // - get sibling components and extract data from them
    // - construct alternative endpoints applying gradual transformation to the endpoint, ie:
    //   `/api/images/id1/red`
    //   `api/images/id2/red` -> still worth exploring
    //   `api/images/id2/green`

    // For now, the goal is to construct as much requests as possible
    // By evaluating the responses we will filter them, ie basically if we dont get a `200 OK` we rule it out
    // In other words, we just test `accesses by mistake` and we do not test `inaccesses by mistake` (is this a real vulnerability?)

    const result = {};
    const id = state.id;
    const nodes = state.state.nodes;

    for (const n in nodes) {
      const {props} = nodes[n];  
      if (!isObjEmpty(props)) {

      }
      console.log('props', props);         
    }

    result.matchFound = true;
    return result;
  }


  // event -> {type, payload, meta}

  // [TODO]
  // - fetch data from DB
  // - look for matches (eg. api/uuid -> uuid is found in component C1)
  // - construct alternative endpoints (C1 -> C2)
  // - test requests, compare response, solve oracle problem via metamorphic properties 
}
