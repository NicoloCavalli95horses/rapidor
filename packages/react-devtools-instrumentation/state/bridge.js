//===================
// Import
//===================
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';
import { emit, events, eventBus } from '../eventBus.js';
import { debounce, log, isSerializableValue } from '../utils.js';
import { Graph } from './graph.js';
import { config } from '../config.js';
import { initialize } from '../../react-devtools-inline/src/backend.js';
import { PreIndexing } from './preindexing.js';


//===================
// Class
//===================
export class Bridge {
  constructor() {
    this.nodeMap = new WeakMap();
    this.nodeId = 0;
    this.preindexing = new PreIndexing();

    this.componentIndex = new Map(); // componentId -> Set<nodeId>
    this.componentTypes = new WeakMap(); // componentType -> componentId
    this.componentId = 0;

    this.graphIndex = 0; // order of snapshots in DB
  }


  // Connect to React specific APIs
  init() {
    eventBus.subscribe(e => {
      if (e.type === events.DB_SUCCESS && e.payload === events.STATE_UPDATE) {
        this.preindexing.emit(); // if graph was saved successfully, save the preindexed data
        this.graphIndex++; // update graph index only in case of success
      }
    });

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

    // if someone attempts to wrap this function, it will receive
    // the wrapped version and not the original one
    Object.defineProperty(hook, 'onCommitFiberRoot', {
      configurable: true,
      get() {
        return original;
      },
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

    emit({ type: events.STATE_UPDATE, payload });
  }



  // [entry point] gets and returns the graph
  async getStateGraph(fiber) {
    const g = new Graph();
    const graph = g.createGraph();
    this.resetIds();
    this.visitFiber({ node: fiber, parentId: null, graph, g });

    graph.componentIndex = this.buildComponentIndex(); // index of componentId: [node-1, node-2, ...]
    graph.fingerprint = await this.getFingerprint(graph); // used to compare graphs
    graph.graphIndex = this.graphIndex;

    return graph;
  }



  // [main visit handler] prune React fiber object and save relations on projected graph
  // > Parent/Child: The parent is updated to the closest "kept" node above it in the hierarchy (A:B:C -> B invalid -> A parent of B)
  // > Sibling: The loop only consider the kept nodes, so only valid siblings are connected to each other, while the invalid siblings are skipped (A:B:C -> B invalid -> A sibling of B)
  // No need to keep information about the filtered nodes: the keptChildren list takes care of reconstructing the list of remaining siblings
  visitFiber({ node, parentId, graph, g }) {
    if (!node) { return null; }

    const context = this.processNode(node);
    let currentParentId = parentId;

    if (context.keep) {
      // add node
      g.addNode({ graph, id: context.id, data: context.data });

      // process primitive values for preindexing
      this.preindexing.prepareData({
        graphIndex: this.graphIndex,
        nodeId: context.id,
        key: context.data.key,
        props: context.data.props
      });

      if (parentId) {
        // link to parent
        g.addRelation({ graph, fromId: parentId, toId: context.id, type: "child" });
      }

      currentParentId = context.id; // updated only if the node is kept
    }

    const keptChildren = this.visitChildren({ node, parentId: currentParentId, graph, g });

    // link siblings
    for (let idx = 0; idx < keptChildren.length; idx++) {
      const child = keptChildren[idx];
      const next = keptChildren[idx + 1];

      g.addRelation({
        graph,
        fromId: child.id,
        toId: next?.id ?? null,
        type: "sibling",
        siblingMeta: {
          relativeIdx: idx,
          fiberIdx: child.fiberIdx,
        }
      });
    }

    return context.keep ? { keptId: context.id } : null;
  }



  // [node processing] decide whether to keep a node, assign componentId (id of istance), serialize props, returns data
  processNode(node) {
    const domElement = (node.stateNode?.containerInfo instanceof HTMLElement) ? node.stateNode.containerInfo
      : (node.stateNode instanceof HTMLElement) ? node.stateNode
        : undefined;

    const keep = this.shouldKeepNode(node.tag, domElement);
    if (!keep) { return { keep: false }; }

    const id = this.getNodeId(node);
    const componentId = this.getComponentTypeId(node.elementType ?? node.type);
    this.updateComponentIndex(componentId, id);

    return {
      keep: true,
      id,
      data: {
        id,
        componentId,
        key: node.key,
        tag: node.tag,
        DOM: this.getDOMInfo(domElement),
        name: this.filterReactComponentName(node.type),
        props: this.getSerializableValues({ obj: node.memoizedProps }),
      }
    };
  }



  visitChildren({ node, parentId, graph, g }) {
    const keptChildren = [];

    let child = node.child;
    let fiberIdx = 0; // original index of sibling (0 -> first of sibling)

    while (child) {
      const result = this.visitFiber({ node: child, parentId, graph, g });

      if (result?.keptId) {
        keptChildren.push({ id: result.keptId, fiberIdx });
      }

      child = child.sibling;
      fiberIdx++;
    }

    return keptChildren;
  }



  // Returns a map of the component instances {1: ['node-1','node-2'], 2: ['node-3'], ...}
  buildComponentIndex() {
    const componentIndex = {};

    for (const [componentId, nodeIds] of this.componentIndex) {
      componentIndex[componentId] = Array.from(nodeIds);
    }

    return componentIndex;
  }



  // Return true if the node is valid
  shouldKeepNode(tag, domEl) {
    return config.tagsWhitelist.includes(tag) || domEl;
  }



  // feature-based (shape-based) fingerprint: create an id considering the relations shape
  async getFingerprint(graph) {
    const edgeLabels = Object.values(graph.relations).map(n => `${n.parent}:${n.child}:${n.sibling}:${n.siblingIdx}`).sort();
    const signature = JSON.stringify(edgeLabels);
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

      const current = {
        classes: [...node.classList],
        DOMchildren: []
      };

      // node.children is a DOM apis (HTMLCollection)
      // children order matches the order with which they are displayed
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



  // Traverse props object at a given depth and return only serializable values
  getSerializableValues({ obj, path, parentKey, depth = 0, maxDepth = config.maxExplorationDepth } = {}) {
    if (!path) { path = new Set(); } // current path in recursive exploration
    if (obj === null || typeof obj !== "object") { return obj; }
    if (path.has(obj)) { return "[circular]"; } // example: const obj = {}; obj.self = obj;
    if (depth >= maxDepth) { return "[max-depth]"; } // does not stop the algorithm but block the current exploration if too deep

    path.add(obj);

    const result = Array.isArray(obj) ? [] : {};
    const keys = Object.keys(obj).slice(0, config.maxExplorationKeys);

    for (const key of keys) {
      if (typeof key === "symbol") { continue; }
      const value = obj[key];

      if (!isSerializableValue(value)) {
        result[key] = `[non-serializable:${value?.constructor?.name}]`;
        continue;
      }

      // random key values inside location breaks snapshot equality
      if (key === "key" && parentKey === "location") { continue; }

      const isExplorable = (typeof value === "object" && value !== null);

      result[key] = isExplorable
        ? this.getSerializableValues({ obj: value, path, parentKey: key, depth: depth + 1, maxDepth })
        : result[key] = value;
    }

    // The following line prevents false positives in different branches:
    // const shared = { value: 42 };
    // const obj = {a: shared,b: shared}; (this is not [circular], it is just a reuse)
    path.delete(obj);

    return result;
  }
}
