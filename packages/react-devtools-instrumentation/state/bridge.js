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
  constructor(navigationTracker) {
    this.nodeMap = new WeakMap();
    this.nodeId = 0;
    this.navigationTracker = navigationTracker;

    this.componentIndex = new Map(); // componentId -> Set<nodeId>
    this.componentTypes = new WeakMap(); // componentType -> componentId
    this.componentId = 0;
  }


  #hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  // Connect to React specific APIs
  init() {
    this.navigationTracker.init();

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

    const debouncedAnalysis = debounce((root) => {
      // [TODO] prune new graph from same page considering only differences to prev graph
      if (this.navigationTracker.canProcessPage()) {
        const graph = self.getStateGraph(root.current);
        emit({ type: 'STATE_UPDATE', payload: graph });
      } else {
        log({ module: 'bridge', msg: 'state snapshot already taken, skipping' });
      }
    }, config.debounceTimeMs);

    this.#hook.onCommitFiberRoot = function (rendererID, root, ...rest) {
      if (root) { debouncedAnalysis(root); }
      return original?.call(this, rendererID, root, ...rest);
    };

    log({ module: 'bridge', msg: 'listening to fiber commits changes' });
  }



  getStateGraph(fiber) {
    const g = new Graph();
    const graph = g.createGraph();
    const self = this;
    const visitedProps = new WeakSet();
    this.resetIds();

    function visit({ node, parentId = null, visitedProps, siblingIdx }) {
      if (!node) { return; }

      const id = self.getNodeId(node);
      const domElement = (node.stateNode?.containerInfo instanceof HTMLElement) ? node.stateNode.containerInfo
        : (node.stateNode instanceof HTMLElement) ? node.stateNode
          : undefined;

      // id of specific React component, used to identify istances
      const componentId = self.getComponentTypeId(node.elementType ?? node.type);
      self.updateComponentIndex(componentId, id);

      // data needs to be serialized (we rule out functions, Node, Document, Window, DOM objects)
      const serializableData = {
        id,
        name: self.filterReactComponentName(node.type),
        key: node.key,
        props: self.getSerializableValues(node.memoizedProps, visitedProps),
        DOM: self.getDOMInfo(domElement),
        tag: node.tag,
        componentId
      };

      g.addNode({ graph, id, data: serializableData });

      if (parentId) {
        g.addRelation({ graph, fromId: parentId, toId: id, type: "child", siblingIdx });
      }

      // collect children once
      const children = [];
      let child = node.child;
      let childIdx = 0;

      while (child) {
        children.push({ node: child, siblingIdx: childIdx });
        child = child.sibling;
        childIdx++;
      }

      // add sibling relations
      for (let i = 0; i < children.length; i++) {
        for (let j = i + 1; j < children.length; j++) {
          const id1 = self.getNodeId(children[i].node);
          const id2 = self.getNodeId(children[j].node);

          g.addRelation({ graph, fromId: id1, toId: id2, type: "sibling" });
          g.addRelation({ graph, fromId: id2, toId: id1, type: "sibling" });
        }
      }

      // visit children
      for (const { node, siblingIdx } of children) {
        visit({ node, parentId: id, visitedProps, siblingIdx });
      }
    }

    visit({ node: fiber, parentId: null, visitedProps, siblingIdx: 0 });

    // add list of istances to graph
    const componentIndex = {};
    for (const [componentId, nodeIds] of this.componentIndex) {
      componentIndex[componentId] = Array.from(nodeIds);
    }
    graph.componentIndex = componentIndex;

    return graph;
  }



  // update the index of components
  updateComponentIndex(componentId, nodeId) {
    if (componentId != null) {
      if (!this.componentIndex.has(componentId)) {
        this.componentIndex.set(componentId, new Set());
      }
      this.componentIndex.get(componentId).add(nodeId);
    }
  }



  // returns an id that is mapped to the component type
  // this is required to find istances of the same component other than its siblings
  getComponentTypeId(type) {
    if (typeof type !== "function") { return; }

    if (!this.componentTypes.has(type)) {
      this.componentId++;
      this.componentTypes.set(type, this.componentId);
    }
    return this.componentTypes.get(type);
  }



  getNodeId(node) {
    let id = this.nodeMap.get(node);

    if (!id) {
      id = `node-${this.nodeId++}`;
      this.nodeMap.set(node, id);
    }

    return id;
  }



  resetIds() {
    this.nodeMap = new WeakMap();
    this.nodeId = 0;
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
  getSerializableValues(props, visited = new WeakSet(), parentKey = null) {
    if (props === null || typeof props !== "object") { return props; }
    if (visited.has(props)) { return; }

    visited.add(props);

    const obj = Array.isArray(props) ? [] : {};

    for (const key of Reflect.ownKeys(props)) {
      if (typeof key === "symbol") { continue; }
      const value = props[key];

      if (!isSerializableValue(value)) { continue; }

      // random key values inside location breaks snapshot equality
      if (key === "key" && parentKey === "location") {
        continue;
      }

      if (typeof value === "object" && value !== null) {
        obj[key] = this.getSerializableValues(value, visited, key);
      } else {
        obj[key] = value;
      }
    }

    return obj;
  }
}
