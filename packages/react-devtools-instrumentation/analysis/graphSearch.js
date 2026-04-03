//===================
// Import
//===================
import { config } from "../config.js";
import { getValueAtPath } from "../utils.js";


//===================
// Class
//===================
export class GraphSearch {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }



  async find(data) {
    const { snapshot, key, http, properties } = data;
    const { nodes, relations, componentIndex, navigationInfo: stateNavInfo } = snapshot;
    const results = this.getMatches({ nodes, componentIndex, relations, key, properties });
    const matchingSets = await this.processResults({ results, componentIndex, nodes, relations });
    const success = matchingSets.length;
    return { success, http, results: matchingSets };
  }



  // For each matching node, build sub-arrays with candidates and DOM references
  // [[ {referenceNode: {...}}, {candidateNodes: [{...},{...}] ]]
  async processResults({ results, componentIndex, nodes, relations }) {
    if (!results.length) { return []; }
    const couples = [];

    for (const result of results) {
      const instanceId = result.node.componentId;
      const nodeIds = componentIndex[instanceId];
      const candidateNodes = [];
      const domPromises = [];

      if (!result.node.DOM) {
        result.node.DOM = await this.stateManager.getAncestorDOM(result.rowId, result.node.id);
      }

      if (!nodeIds.length) { continue; }

      for (const candidateId of nodeIds) {
        if (candidateId === result.node.id) { continue; }

        const candidateNode = nodes[candidateId];
        const candidateMatch = getValueAtPath(candidateNode, result.path);

        if ([null, undefined, ''].includes(candidateMatch)) { continue; }

        if (!candidateNode.DOM) {
          domPromises.push(
            this.stateManager
              .getAncestorDOM(result.rowId, candidateNode.id)
              .then(dom => { candidateNode.DOM = dom; })
          );
        }

        const candidateTarget = structuredClone(result.target);
        candidateTarget.value = candidateMatch;

        candidateNodes.push({
          node: candidateNode,
          rowId: result.rowId,
          path: result.path,
          target: candidateTarget,
          relations: relations[candidateNode.id]
        });
      }

      await Promise.all(domPromises);

      if (candidateNodes.length) {
        couples.push({ referenceNode: result, candidateNodes })
      }
    }

    return couples;
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
          depth: config.maxExplorationDepth,
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

      for (const target of remainingTargets) {
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
        for (const k in value) {
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