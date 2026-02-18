//===================
// Import
//===================
import { log, sendPostMessage } from "./utils";


//===================
// Functions
//===================
export class StateManager {
  constructor(rendererInterface) {
    this.renderer = rendererInterface;
  }

  #requestID = 0;

  // traverseFiber(fiber) {
  //   if (!fiber) return null;
  //   console.log({fiber})

  //   const node = {
  //     name: this.getDisplayName(fiber),
  //     props: fiber.memoizedProps,
  //     state: fiber.memoizedState,
  //     children: []
  //   };
  //   console.log({node})

  //   let child = fiber.child;
  //   while (child) {
  //     node.children.push(this.traverseFiber(child));
  //     child = child.sibling;
  //   }

  //   return node;
  // }

  // getDisplayName(fiber) {
  //   return (
  //     fiber.type?.displayName ||
  //     fiber.type?.name ||
  //     'Anonymous'
  //   );
  // }

  saveGlobalState() {
    // const roots = this.getFiberRoots();
    // console.log(roots);
    // console.log({roots})
    // const snapshot = [];

    // for (const root of roots) {
    //   const tree = this.traverseFiber(root?.current);
    //   snapshot.push(tree);
    // }

    // return snapshot;
  }


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
    sendPostMessage({ type: 'STATE_HISTORY_EVENT', data: { component, props } });

    this.#requestID++;
  }
}