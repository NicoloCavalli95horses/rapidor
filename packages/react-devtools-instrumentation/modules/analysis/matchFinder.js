
//===================
// Import
//===================
import { config } from "../../config.js";
import { log } from "../../utils/utils.js";


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

    data.success = couples?.length;
    data.results = couples;

    if (data.success) {
      log({ module: "match finder", msg: couples, verboseOnly: true });
    }

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



  // For each matching node, build sub-arrays with candidates
  // [[ {reference: {...}}, {candidates: [{...},{...}] ]]
  async processResults(references) {
    if (!references.length) { return []; }
    const couples = [];

    for (const ref of references) {
      // Get alternative instances of matching component
      const componentIndex = await this.stateManager.getComponentIndexByID(ref.graphIndex);
      const instancesIds = componentIndex[ref.node.componentId];
      const candidates = [];

      if (!instancesIds.length) { continue; }

      ref.node.instancesIds = instancesIds.filter(i => i != ref.node.id);

      for (const id of instancesIds) {
        if (id === ref.nodeId) { continue; }

        const candidateNode = await this.stateManager.getNodeByID(ref.graphIndex, id);
        const candidateMatch = this.getValueAtPath({ obj: candidateNode, path: ref.path, originalVal: ref.value });
        if (!candidateMatch) { continue; }

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

      if (candidates.length) {
        couples.push({ reference: ref, candidates })
      }
    }

    return couples;
  }



  // obj: the object to explore
  // path: the path with which to explore the object
  // originalVal: the original value  
  getValueAtPath({ obj, path = [], originalVal }) {
    let current = obj;

    for (const key of path) {
      if (current == null || typeof current !== 'object' || !Object.hasOwn(current, key)) { return; }
      current = current[key];
    }

    
    if (Array.isArray(originalVal) && typeof current === 'string') {
      current = current.split(/[/.?]/).map(v => v.trim()).filter(Boolean);
      const refSet = new Set(originalVal);
      current = current.filter(x => !refSet.has(x));
      return current.length === 1 ? current[0] : undefined;
    }

    return (current && current != originalVal) ? current : undefined;
  }
}