
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
    const matches = await this.getPreIndexedMatches(properties);
    const couples = await this.processResults(matches);

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
            node.graphIndex = match.graphIndex;

            return { ...match, node, relations, target: property };
          })
        );
      })
    );

    return results.flat(2).filter(Boolean);
  }



  // For each matching node, build sub-arrays with candidates and DOM references
  // [[ {reference: {...}}, {candidates: [{...},{...}] ]]
  async processResults(references) {
    if (!references.length) { return []; }
    const couples = [];

    for (const ref of references) {
      // Get alternative instances of matching component
      const componentIndex = await this.stateManager.getComponentIndexByID(ref.graphIndex);
      const instancesIds = componentIndex[ref.node.componentId];
      if (!instancesIds.length) { continue; }

      // [TODO] process here the DOMs and append a boolean that will be used in evaluation
      // > ref.node.DOM.isPremium = false (the tester or an AI agent clicked successfully so it must be free)
      // > candidateNode.DOM.isPremium = (?)
      //   consider all the avaiable set of DOM classes (eg if instancesIds.length = 10 -> 10 sets of DOM classes)
      //   we assume that all the premium elements are identical to each other
      //   we assume that the free elements may have some differences between each other
      //   - first, group all the identical set of CSS classes. This is likely the set of premium elements
      //   - if the candidateNode.DOM has the same set of CSS classes, is premium, else is free

      ref.node.DOM = ref.node.DOM || await this.stateManager.getAncestorDOM(ref.graphIndex, ref.nodeId);
      ref.node.instancesIds = instancesIds.filter(i => i != ref.node.id);

      const candidates = [];
      const domPromises = [];

      for (const id of instancesIds) {
        if (id === ref.nodeId) { continue; }

        const candidateNode = await this.stateManager.getNodeByID(ref.graphIndex, id);
        const candidateMatch = getValueAtPath(candidateNode, ref.path);

        if ([null, undefined, ''].includes(candidateMatch)) { continue; }

        if (!candidateNode.DOM) {
          domPromises.push(
            this.stateManager
              .getAncestorDOM(ref.graphIndex, candidateNode.id)
              .then(dom => { candidateNode.DOM = dom; })
          );
        }

        candidateNode.graphIndex = ref.graphIndex;
        candidateNode.instancesIds = instancesIds.filter(i => i != candidateNode.id);

        const candidateTarget = structuredClone(ref.target);
        candidateTarget.value = candidateMatch;

        candidates.push({
          node: candidateNode,
          graphIndex: ref.graphIndex,
          path: ref.path,
          target: candidateTarget,
          relations: await this.stateManager.getRelationsByID(ref.graphIndex, candidateNode.id),
        });
      }

      await Promise.all(domPromises);

      if (candidates.length) {
        couples.push({ reference: ref, candidates })
      }
    }

    return couples;
  }
}