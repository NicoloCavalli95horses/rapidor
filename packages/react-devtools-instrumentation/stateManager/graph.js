//===================
// Import
//===================



//===================
// Class
//===================
export class Graph {
  constructor() { }

  // We use a 'typified relations' to improve search speed
  // ie. instead of a raw list { "A": ["B","C"] } we have { "A": {...} }
  createGraph() {
    return {
      nodes: {
        // Examples:
        // "id1": { id: "id1", props: {...}, meta: {...} },
        // "id2": { id: "id2", props: {...}, meta: {...} },
        // "id3": { id: "id3", props: {...}, meta: {...} }
      },
      relations: {
        // Examples:
        // "id1": { child: ["id3", "id4"], render: [domEl_1, domEl_2] }
        // "id2": { child: ["id5", "id6"], render: [domEl_3, domEl_4] }
      }
    }
  }

  addNode({ graph, id, data = {} }) {
    graph.nodes[id] = { id, ...data };
  }

  /**
   * 
   * @param graph a graph object 
   * @param fromId id of first node
   * @param toId id of second node
   * @param type type of relation (child, render) 
   */
  addRelation({ graph, fromId, toId, type }) {
    if (!graph.relations[fromId]) {
      graph.relations[fromId] = {};
    }

    if (!graph.relations[fromId][type]) {
      graph.relations[fromId][type] = new Set();
    }

    graph.relations[fromId][type].add(toId);

    // add parent node to ease data retrieval
    if (type == "child") {
      if (graph.nodes[toId]) {
        // we assume that a node can have just 1 parent. Otherwise we can do:
        // graph.nodes[toId].parents = new Set();
        // graph.nodes[toId].parents.add(fromId);
        graph.nodes[toId].parent = fromId;
      } else {
        console.error(`Node ${toId} does not exist`);
      }
    }
    if (type === "render") {
      // [TODO]
    }
  }

  // Direct access to node: 0(1) complexity
  getNode({ graph, id }) {
    if (graph && id) {
      return graph.nodes.hasOwnProperty(id) ? graph.nodes[id] : undefined;
    };
  }

  // siblings: nodes that have the same parent as the given node
  // O(k) complexity (k = number of children)
  getSiblings({ graph, id }) {
    const node = graph.nodes[id];
    if (!node || !node.parent) {
      return [];
    };

    const siblingsSet = graph.relations[node.parent]?.child;
    if (!siblingsSet) {
      return [];
    };

    return Array.from(siblingsSet)
      .filter(siblingId => siblingId !== id)
      .map(siblingId => graph.nodes[siblingId])
      .filter(Boolean);
  }
}