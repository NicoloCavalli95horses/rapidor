// This runs as background script (web worker)
// Does not have access to the same IndexedDB instance as the main thread

//===================
// Import
//===================
import { config } from "../../../react-devtools-instrumentation/config.js";
import { events } from "../../../react-devtools-instrumentation/eventBus.js";



//===================
// Class
//===================
export class WebWorker {
  constructor() {
  }



  async init() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type != events.START_ANALYSIS) { return; }
      const payload = this.run(msg.payload);
      sendResponse({ done: true, payload });
    });
  }



  run(event) {
    const { snapshot, key, http, properties } = event;
    const { nodes, relations, componentIndex, navigationInfo: stateNavInfo } = snapshot;
    const results = this.getMatches({ nodes, componentIndex, relations, key, properties });
    const success = results.length;
    return { success, http, results: { results, componentIndex, nodes, relations } };
  }



  // Returns array of matching nodes [ {node},{node} ]
  // DFS (deep-first search) executed once per set of properties
  getMatches({ nodes, componentIndex, relations, key, properties }) {
    const targets = properties.length ? properties.filter(p => p.value) : [];
    if (!targets.length) { return []; }
    if (!properties.length) { return []; }

    const results = [];
    const ids = new Set();

    for (const nodeIds of Object.values(componentIndex)) {
      if (nodeIds.length <= 1) { continue; } // single instance of component, no possible alternative data

      for (const nodeId of nodeIds) {
        if (ids.has(nodeId)) { continue; }

        const node = nodes[nodeId];
        if (!config.tagsWhitelist.includes(node.tag)) { continue; } // [TODO] check other tags

        const matches = this.getMatchingNode({
          value: node,
          targets,
          keysWhitelist: ['props', 'key'],
          depth: config.graphExplorationDepth,
        });

        if (matches?.length) {
          matches.forEach(match => {
            results.push({ node, rowId: key, ...match, relations: relations[nodeId] });
          });
          ids.add(nodeId);
        }
      }
    }

    return results;
  }



  getMatchingNode({ value, targets, keysWhitelist = [], depth }) {
    const visited = new WeakSet();
    const remainingTargets = new Set(targets);
    const matches = [];

    function visit({ value, path, continueSearch = false }) {
      if (depth && path.length > depth) { return; } // limit graph exploration 
      if (visited.has(value)) { return; }

      for (const target of Array.from(remainingTargets)) {
        if (value == target.value) { // loose equality, we must match '123' == 123
          matches.push({ path: [...path], target });
          remainingTargets.delete(target);
        }
      }

      if (!value || typeof value !== "object") { return; }
      visited.add(value); // must be an object      
      if (!remainingTargets.size) { return; } // quit if every property is found

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          visit({ value: value[i], path: [...path, i], continueSearch });
          if (!remainingTargets.size) { return; }
        }
      } else {
        for (const k of Object.keys(value)) {
          const isWhitelisted = keysWhitelist.includes(k);
          if (!continueSearch && !isWhitelisted) { continue; }

          // explore only allowed properties recursively (props may be another object)
          visit({ value: value[k], path: [...path, k], continueSearch: continueSearch || isWhitelisted });
          if (!remainingTargets.size) { return; }
        }
      }
    }

    visit({ value, path: [], continueSearch: false });

    return matches;
  }
}

