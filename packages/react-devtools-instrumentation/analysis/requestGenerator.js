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

    // [TODO] here we have the component(s) involved in the HTTP requests
    // 1) find siblings of the current component by using the given path
    // 2) extract data from sibilngs by leveraging structural equivalence
    // 3) analyze visual differences (DOM classes) and props differences (boolean, etc) in siblings
    // 4) create requests by modifying only 1 field at the time
    // 5) store new requests and responses
    // 5) evaluate responses based on metamorphic relations

    console.log(event);
  }

  async fetchRequest({ path, options = { method: "GET", body: '', headers: {} } }) {
    try {
      const response = await fetch(path, options);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(error.message);
    }
  }
}