
//===================
// Import
//===================
import { config } from "../../config.js";
import { getValueAtPath } from "../../utils/utils.js";


//===================
// Class
//===================
export class MatchFinder {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }



  async find(httpEvent) {
    const data = {
      httpEvent: httpEvent.value,
      results: [],
      success: false,
    }

    const { request, ignore } = httpEvent.value;
    if (ignore) { return data; } // self-generated HTTP events

    const properties = request.analysis.toEvaluate;
    const results = await this.getPreIndexedMatches(properties);
    const couples = await this.processResults(results);

    data.results = couples;
    data.success = couples?.length;
    return data;
  }



  // Finds matches on preindexed nodes. These can origin from different snapshots
  // The fn parallelizes DB requests
  async getPreIndexedMatches(properties) {
    if (!properties?.some(p => p.value)) { return []; }

    const results = await Promise.all(
      properties.map(async (property) => {
        const matches = await this.stateManager.getPreIndexed(property.value);
        if (!matches?.length) { return []; }

        return Promise.all(
          matches.map(async (match) => {
            const node = await this.stateManager.getNodeByID(match.graphIndex, match.nodeId);

            // orphans components are not valid matches
            if (!node?.componentId) { return null; }

            const relations = await this.stateManager.getRelationsByID(match.graphIndex, match.nodeId);

            return { ...match, node, relations, target: property };
          })
        );
      })
    );

    return results.flat(2).filter(Boolean);
  }



  // For each matching node, build sub-arrays with candidates and DOM references
  // [[ {reference: {...}}, {candidates: [{...},{...}] ]]
  async processResults(results) {
    if (!results.length) { return []; }
    const couples = [];

    for (const result of results) {
      // get alternative instances of matching component
      const componentIndex = await this.stateManager.getComponentIndexByID(result.graphIndex);
      const nodeIds = componentIndex[result.node.componentId];
      if (!nodeIds.length) { continue; }

      const candidates = [];
      const domPromises = [];

      if (!result.node.DOM) {
        result.node.DOM = await this.stateManager.getAncestorDOM(result.graphIndex, result.nodeId);
      }

      for (const candidateId of nodeIds) {
        if (candidateId === result.nodeId) { continue; }

        const candidateNode = await this.stateManager.getNodeByID(result.graphIndex, candidateId);
        const candidateMatch = getValueAtPath(candidateNode, result.path);

        if ([null, undefined, ''].includes(candidateMatch)) { continue; }

        if (!candidateNode.DOM) {
          domPromises.push(
            this.stateManager
              .getAncestorDOM(result.graphIndex, candidateNode.id)
              .then(dom => { candidateNode.DOM = dom; })
          );
        }

        const candidateTarget = structuredClone(result.target);
        candidateTarget.value = candidateMatch;

        candidates.push({
          node: candidateNode,
          graphIndex: result.graphIndex,
          path: result.path,
          target: candidateTarget,
          relations: await this.stateManager.getRelationsByID(result.graphIndex, candidateNode.id),
        });
      }

      await Promise.all(domPromises);

      if (candidates.length) {
        couples.push({ reference: result, candidates })
      }
    }

    return couples;
  }
}