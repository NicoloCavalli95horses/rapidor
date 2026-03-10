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
        // "id1": { id: "id1", props: {...}, tag: '', ... },
        // "id2": { id: "id2", props: {...}, tag: '', ... },
        // "id3": { id: "id3", props: {...}, tag: '', ... }
      },
      relations: {
        // Examples:
        // "id1": { child: ["id3", "id4"], sibling: [], parent: "" }
        // "id2": { child: ["id5", "id6"], sibling: [], parent: "" }
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
   * @param siblingIdx index of sibling (first sibling has 0) 
   */
  addRelation({ graph, fromId, toId, type, siblingIdx }) {
    if (!graph.relations[fromId]) {
      graph.relations[fromId] = {};
    }

    if (!graph.relations[fromId][type]) {
      graph.relations[fromId][type] = new Set();
    }

    graph.relations[fromId][type].add(toId);

    if (!graph.relations[toId]) {
      graph.relations[toId] = {};
    }

    // add parent relation on node too, to ease data retrieval
    // we assume that a node can have just 1 parent
    if (type == "child" && graph.nodes[toId]) {
      graph.nodes[toId].parent = fromId;
      graph.relations[toId].parent = fromId;
      graph.relations[toId].siblingIdx = siblingIdx;
    }
  }



  // Direct access to node: 0(1) complexity
  getNode({ graph, id }) {
    if (graph && id) {
      return graph.nodes.hasOwnProperty(id) ? graph.nodes[id] : undefined;
    };
  }
}