//===================
// Import
//===================
import { eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';


//===================
// Functions
//===================
export class RequestGenerator {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.GEN_REQ))
      .subscribe(e => this.handleGenerate(e.payload));
  }

  handleGenerate(event) {
    const { nodes, http } = event;

    // for (let i = 0; i < nodes.length; i++) {
    //   const node = nodes[i];
    //   const _results = node._results;
    //   for (let j = 0; j < _results.length; j++) {
    //     const _result = _results[j];
    //     // [to do...]
    //   }
    // }

    console.log(event);
  }
}