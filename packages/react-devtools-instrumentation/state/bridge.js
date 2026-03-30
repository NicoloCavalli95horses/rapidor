//===================
// Import
//===================
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';
import { emit } from '../eventBus.js';
import { debounce, log, isSerializableValue } from '../utils.js';
import { Graph } from './graph.js';
import { config } from '../config.js';
import { initialize } from '../../react-devtools-inline/src/backend.js';


//===================
// Class
//===================
export class Bridge {
  constructor(stateManager) {
    this.nodeMap = new WeakMap();
    this.nodeId = 0;
    this.stateManager = stateManager;

    this.componentIndex = new Map(); // componentId -> Set<nodeId>
    this.componentTypes = new WeakMap(); // componentType -> componentId
    this.componentId = 0;
  }


  // Connect to React specific APIs
  init() {
    this.listenToFiberCommits();
  }



  // Returns snapshots of the current state of the component tree
  // The state is updated automatically by React
  listenToFiberCommits() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) { return; }
    const self = this;
    let original = hook.onCommitFiberRoot; // save original reference
    original = wrap(original);

    // [TODO] debouncing does not work on large web apps when the updates never stop
    // Implement throttling making sure not to store two times the same graph
    const debouncedProcess = debounce(async (fiber) => {
      await self.handleStateGraph(fiber);
    }, config.debounceTimeMs);

    function wrap(fn) {
      return function (rendererID, root, ...args) {
        if (root && root?.current) { debouncedProcess(root.current); }
        return fn?.apply(this, [rendererID, root, ...args]);
      };
    }

    Object.defineProperty(hook, 'onCommitFiberRoot', {
      configurable: true,
      get() {
        return original;
      },
      // if someone attempts to wrap this function, it will receive
      // the wrapped version and not the original one
      set(fn) {
        original = wrap(fn);
      }
    });

    log({ module: 'bridge', msg: 'listening to fiber commits changes' });
  }



  async handleStateGraph(fiber) {
    console.time('gettingGraph');
    const payload = await this.getStateGraph(fiber);
    console.timeEnd('gettingGraph');
    emit({ type: 'STATE_UPDATE', payload });
  }



  async getStateGraph(fiber) {
    const g = new Graph();
    const graph = g.createGraph();
    const self = this;
    this.resetIds();

    function visit({ node, parentId = null, siblingIdx }) {
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
        props: self.getSerializableValues(node.memoizedProps),
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
        visit({ node, parentId: id, siblingIdx });
      }
    }

    visit({ node: fiber, parentId: null, siblingIdx: 0 });

    // add list of istances to graph
    const componentIndex = {};
    for (const [componentId, nodeIds] of this.componentIndex) {
      componentIndex[componentId] = Array.from(nodeIds);
    }
    graph.componentIndex = componentIndex;

    // calculate graph fingerprint
    graph.fingerprint = await this.getFingerprint(graph);

    return graph;
  }



  // feature-based (shape-based) fingerprint: we create a graph id considering its shape
  // in this way we can efficiently compare two graphs
  async getFingerprint(graph) {
    const nodeLabels = Object.values(graph.nodes).map(n => `${n.id}:${n.componentId}:${n.tag}`).sort();
    const edgeLabels = Object.values(graph.relations).map(n => `${n.parent}:${n.child}:${n.sibling}:${n.siblingIdx}`).sort();
    const signature = JSON.stringify({ nodeLabels, edgeLabels });
    return await this.digestMessage(signature);
  }



  async digestMessage(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }



  // update the index of components
  updateComponentIndex(componentId, nodeId) {
    if (!Number.isInteger(componentId)) { return; }
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Set());
    }
    this.componentIndex.get(componentId).add(nodeId);
  }



  // returns an id that is mapped to the component type
  // this is required to find istances of the same component other than its siblings
  getComponentTypeId(type) {
    if (type == null) { return; }
    let componentFn = undefined;

    if (typeof type === "object" && type.$$typeof) {
      const tag = type.$$typeof;

      if (tag === Symbol.for("react.memo")) {
        componentFn = type.type; // function
      } else if (tag === Symbol.for("react.forward_ref")) {
        componentFn = type.render; // function
      } else if (tag === Symbol.for("react.provider") || tag === Symbol.for("react.consumer")) {
        componentFn = type._context; // object
      } else if (tag === Symbol.for("react.context")) {
        componentFn = type; // object
      }
    }

    const valid = ["function"].includes(typeof type) || componentFn;
    if (!valid) { return; }

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
    this.componentIndex = new Map();
    this.componentTypes = new WeakMap();
    this.componentId = 0;
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
  getSerializableValues(obj, path, parentKey = null) {
    if (!path) { path = new Set(); }
    if (obj === null || typeof obj !== "object") { return obj; }
    if (path.has(obj)) { return "[circular]"; }

    path.add(obj);

    const result = Array.isArray(obj) ? [] : {};

    for (const key of Reflect.ownKeys(obj)) {
      if (typeof key === "symbol") { continue; }
      const value = obj[key];
      if (!isSerializableValue(value)) { continue; }

      // random key values inside location breaks snapshot equality
      if (key === "key" && parentKey === "location") { continue; }

      if (typeof value === "object" && value !== null) {
        result[key] = this.getSerializableValues(value, path, key);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
