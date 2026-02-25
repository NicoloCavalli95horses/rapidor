//===================
// Import
//===================
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';
import { emit } from '../eventBus.js';
import { log, sendPostMessage } from '../utils.js';
import { Graph } from './graph.js';



//===================
// Class
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
      log('[DEBUG] React fiber: ', root.current);
      const currentGraph = self.getStateGraph(root.current);

      emit({ type: 'STATE_UPDATE', payload: currentGraph });
      return original?.call(this, rendererID, root, ...rest);
    };

    log('[INFO] listening to component tree changes');
  }


  // 1) Intermediate representation
  // - the bridge should not be responsible of creating the graph, because we want to generalize the process to Angular, Vue, etc
  // - At the same time, what we get from the React fiber is specific to React, and generating the graph require understanding the data schema provided by the framework
  // - [TODO] We need an intermediate representation that close the gap between framework-specific data and framework-agnostic component graph

  // 2) Storing DOM data
  // - DOM data is already extracted here, because we cannot save DOM objects to a DB, they are not serializable
  // - the mapping is currently weak, ie we trust too much the framework 
  // - [TODO] find a way to map component props to closest DOM element in a reliable way
  // - this mapping is critical and will be used to solve oracle problem
  getStateGraph(fiber) {
    const g = new Graph();
    const graph = g.createGraph();
    const fiberToId = new WeakMap();
    let idCounter = 0;
    const self = this;

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

        const visitedProps = new WeakSet();
        const domElement = (node.stateNode?.containerInfo instanceof HTMLElement) ? node.stateNode.containerInfo
          : (node.stateNode instanceof HTMLElement) ? node.stateNode
            : undefined;

        // This data will be saved to IndexedDB which use a 'structured clone' algorithm
        // Every value needs to be serialized (ie. no function, Node, Document, Window, DOM objects, Event, ...)
        const serializableData = {
          id,
          name: self.filterReactComponentName(node.type),
          key: node.key,
          props: self.filterReactProps(node.memoizedProps, visitedProps),
          domState: self.getDOMInfo(domElement),
          tag: node.tag,
        };

        // Better add all the nodes to create a clean graph
        // In the data retrieval phase, we will filter unrelevant nodes with this.isUserComponent(node.tag)
        g.addNode({ graph, id, data: serializableData });
      }

      if (parentId) {
        // Add relation if parentID exists
        g.addRelation({ graph, fromId: parentId, toId: id, type: "child" });
      }

      visit(node.child, id);
      visit(node.sibling, parentId);
    }

    visit(fiber);
    return graph;
  }

  getDOMInfo(el) {
    function visit(node) {
      if (!node) { return; };

      const rect = node.getBoundingClientRect();

      const current = {
        tag: node.tagName?.toLowercase(),
        id: node.id,
        classes: [...node.classList],
        width: rect.width,
        height: rect.height,
        inlineStyle: Object.fromEntries(Object.entries(node.style).filter(([_, value]) => value !== '')),
        children: []
      };

      for (const child of node.children) {
        const childData = visit(child);
        if (childData) {
          current.children.push(childData);
        };
      }

      return current;
    }

    return visit(el);
  }

  filterReactComponentName(type) {
    if (typeof type === 'function') { return; }

    if (typeof type?.displayName === "string") {
      return type.displayName;
    }
    if (typeof type?.name === "string") {
      return type.name;
    }
  }

  filterReactProps(props, visited = new WeakSet()) {
    if (props === null || typeof props !== "object") {
      return props;
    }

    if (visited.has(props)) {
      return;
    }
    visited.add(props);

    const obj = Array.isArray(props) ? [] : {};

    for (const key of Reflect.ownKeys(props)) {
      const value = props[key];

      if (!this.isSerializableValue(value)) {
        continue;
      }

      if (typeof value === "object" && value !== null) {
        obj[key] = this.filterReactProps(value, visited);
      } else {
        obj[key] = value;
      }
    }

    return obj;
  }

  isSerializableValue(value) {
    if (value === null) { return true };

    const t = typeof value;

    if (["function", "symbol", "undefined"].includes(t)) {
      return false;
    }

    if (typeof Node !== "undefined" && value instanceof Node) {
      return false;
    }

    if (value instanceof WeakMap || value instanceof WeakSet) {
      return false;
    }

    return true;
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
