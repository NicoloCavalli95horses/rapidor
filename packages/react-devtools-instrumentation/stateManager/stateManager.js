//===================
// Import
//===================
import { eventBus } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log, sendPostMessage } from "../utils.js";



//===================
// Functions
//===================
export class StateManager {
  constructor(rendererInterface) {
    this.renderer = rendererInterface;
  }

  #requestID = 0;


  init() {
    eventBus
      .pipe(filter(event => event.type === "STATE_UPDATE"))
      .subscribe(event => {
        // event -> {type, payload, meta}

        // [TODO]
        // - save to DB
        // - (?)
       });
  }


  // The following must use the event RENDERER
  saveComponentState(e) {
    const domEl = e.target;
    const id = this.renderer.getElementIDForHostInstance(domEl);
    if (!id) { return; }

    // Parent component
    const owners = this.renderer.getOwnersList(id);

    if (!owners || !owners.length) { return; }

    const componentID = owners[0].id;
    const path = null; // path to traverse InspectedElement (null = root)
    const forceFullData = true;
    const component = this.renderer.inspectElement(this.#requestID, componentID, path, forceFullData);
    const props = component?.value?.props?.data;

    log(`[COMPONENT]`, props);
    // sendPostMessage({ type: 'STATE_HISTORY_EVENT', data: { component, props } });

    this.#requestID++;
  }
}
