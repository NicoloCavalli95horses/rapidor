//===================
// Import
//===================
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';
import { emit } from '../eventBus.js';
import { log, sendPostMessage } from '../utils.js';
import { Graph } from './graph.js';

//===================
// Consts
//===================



//===================
// Functions
//===================
export class Bridge {
  constructor() {
  }
  #hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  init() {
    this.listenToFiberCommits();
    this.connectToRenderer();
  }



  // Returns the rendererInterface object with functions to inspect specific components
  connectToRenderer() {
    this.#hook?.on('renderer', ({ renderer, reactBuildType, rendererID }) => {
      // `rendererInterface` exposes devtools utilities to get info about single components
      const rendererInterface = attach(this.#hook, rendererID, renderer, window);
      emit({ type: 'RENDERER', payload: rendererInterface });
      log('[INFO] Renderer attached');
    });
  }


  // Returns snapshots of the current state of the component tree
  // The state is updated automatically by React
  listenToFiberCommits() {
    const original = this.#hook?.onCommitFiberRoot;

    // The component tree is updated at every `onCommitFiberRoot` event. This may be asynch to user interactions (!)
    // We intercept the event and get the GUI state
    const self = this;
    this.#hook.onCommitFiberRoot = function (rendererID, root, ...rest) {
      const currentGraph = self.getStateGraph(root.current);
      emit({ type: 'STATE_UPDATE', payload: currentGraph });
      return original?.call(this, rendererID, root, ...rest);
    };

    log('[INFO] listening to component tree changes');
  }


  // [TODO]
  // - minimize the data we get
  // - find a way to map props to closest DOM element (we have both props and DOM els but in different objects)
  // - this mapping will be used in metamorphic relations to solve oracle problem
  getStateGraph(fiber) {
    const g = new Graph();
    const graph = g.createGraph();
    const fiberToId = new WeakMap();
    let idCounter = 0;

    function getNextId() {
      return `node-${idCounter++}`;
    }

    function visit(node, parentId = null) {
      if (!node) { return };

      let id = fiberToId.get(node);

      // Create node if does not exist
      if (!id) {
        id = getNextId();
        fiberToId.set(node, id);

        const data = {
          id,
          name: node.type?.name || node.type,
          key: node.key,
          props: node.memoizedProps,
          dom: node.stateNode?.containerInfo instanceof HTMLElement ? node.stateNode.containerInfo
            : node.stateNode instanceof HTMLElement ? node.stateNode
              : undefined,
          tag: node.tag,
        };

        // Better add all the nodes to create a clean graph
        // In the data retrieval phase, we will filter unrelevant nodes with this.isUserComponent(node.tag)
        g.addNode({ graph, id, data });
      }

      // Add relation if parentID exists
      if (parentId) {
        g.addRelation({ graph, fromId: parentId, toId: id, type: "child" });
      }

      visit(node.child, id);
      visit(node.sibling, parentId);
    }

    visit(fiber);
    return graph;
  }

  // Tags are defined in ReactWorkTags.js
  // Useful tags are found empirically
  isUserComponent(tag) {
    return (
      // tag === 0 // FunctionComponent
      // || tag === 1 // ClassComponent
      tag === 5 // HostComponent
      // tag === 11 // ForwardRef
      // tag === 13 // SuspenseComponent
      // || tag === 14 // MemoComponent
      // || tag === 15 // SimpleMemoComponent
      // || tag === 16 // LazyComponent
      // || tag === 17 // IncompleteClassComponent
      // || tag === 19 // SuspenseListComponent
      // || tag === 21 // ScopeComponent
      // || tag === 22 // OffscreenComponent
      // || tag === 23 // LegacyHiddenComponent
      // || tag === 24 // CacheComponent
      // || tag === 25 // TracingMarkerComponent
      // || tag === 28 // IncompleteFunctionComponent
      // || tag === 30 // ViewTransitionComponent
      // || tag === 31 // ActivityComponent
    );
  }
}
