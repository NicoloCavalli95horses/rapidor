//===================
// Import
//===================
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';
import { emit } from '../eventBus.js';
import { debounce, log, sendPostMessage, isSerializableValue } from '../utils.js';
import { Graph } from './graph.js';
import { config } from '../config.js';



//===================
// Class
//===================
export class Bridge {
  constructor() {
  }

  #hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  // Connect to React specific APIs
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
      log({ module: 'bridge', msg: 'Renderer attached' });
    });
  }



  // Returns snapshots of the current state of the component tree
  // The state is updated automatically by React
  listenToFiberCommits() {
    const original = this.#hook?.onCommitFiberRoot;
    const self = this;

    // The component tree is updated very often
    // We listen to changes via `onCommitFiberRoot` event and save a snapshot only after 2000ms of idleness
    const debouncedAnalysis = debounce((root) => {
      const graph = self.getStateGraph(root.current);
      emit({ type: 'STATE_UPDATE', payload: graph });
    }, config.debounceTimeMs);

    this.#hook.onCommitFiberRoot = function (rendererID, root, ...rest) {
      debouncedAnalysis(root);
      return original?.call(this, rendererID, root, ...rest);
    };

    log({ module: 'bridge', msg: 'listening to fiber commits changes' });
  }



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
      if (!node) { return; }

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
          DOM: self.getDOMInfo(domElement),
          tag: node.tag,
        };

        if (config.allowedNodeTag.includes(node.tag)) {
          g.addNode({ graph, id, data: serializableData });
        }
       
        if (parentId) {
          g.addRelation({ graph, fromId: parentId, toId: id, type: "child" });
        }
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
        tag: node.tagName?.toLowerCase(),
        id: node.id,
        classes: [...node.classList],
        width: rect.width,
        height: rect.height,
        inlineStyle: Object.fromEntries(Object.entries(node.style).filter(([_, value]) => value !== '')),
        DOMchildren: []
      };
      
      // `node.children` is not a property we have from React
      // DOM Children are derived using DOM apis (HTMLCOllection)
      for (const child of node.children) {
        const childData = visit(child);
        if (childData) {
          current.DOMchildren.push(childData);
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



  // traverse props object and return only serializable values
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

      if (!isSerializableValue(value)) {
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
}
