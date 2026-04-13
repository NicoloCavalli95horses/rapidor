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
    graph.nodes[id] = {
      id,
      ...graph.nodes[id],
      ...data
    };
  }



  /**
   * 
   * @param graph a graph object 
   * @param fromId id of first node (parent || reference node)
   * @param toId id of second node (child || sibling)
   * @param type type of relation (child, render) 
   * @param siblingIdx index of sibling (first sibling has 0) 
   */
  addRelation({ graph, fromId, toId, type, siblingMeta }) {
    // Init nodes
    if (!graph.nodes[fromId]) { graph.nodes[fromId] = {}; }
    if (toId && !graph.nodes[toId]) { graph.nodes[toId] = {}; }
    if (!graph.relations[fromId]) { graph.relations[fromId] = {}; }
    if (toId && !graph.relations[toId]) { graph.relations[toId] = {}; }

    if (type === "child" && toId) {
      if (!graph.relations[fromId].child) {
        graph.relations[fromId].child = toId;
      }
      if (!graph.relations[toId].parent) {
        graph.relations[toId].parent = fromId;
        graph.nodes[toId].parent = fromId; // used in assigning DOM info (see stateManager.getAncestorDOM)
      }
    }

    if (type === "sibling") {
      if (toId && !graph.relations[fromId].nextSibling) {
        graph.relations[fromId].nextSibling = toId;
      }
      if (toId && !graph.relations[toId].prevSibling) {
        graph.relations[toId].prevSibling = fromId;
      }
      graph.relations[fromId].siblingMeta = siblingMeta;
    }
  }



  // Direct access to node: 0(1) complexity
  getNode({ graph, id }) {
    if (graph && id) {
      return graph.nodes.hasOwnProperty(id) ? graph.nodes[id] : undefined;
    };
  }
}