//===================
// Import
//===================
import { Graph } from "../modules/state/graph.js";
import assert from "node:assert";



//===================
// Test suite
//===================
// The Graph is the in-memory component tree every snapshot is built on. These tests pin the node
// merge semantics and the typed (child/sibling) relation wiring, both read back during matching.
describe("Graph", function () {
  const graph = new Graph();


  it("createGraph returns empty nodes and relations maps", function () {
    const g = graph.createGraph();
    assert.deepEqual(g, { nodes: {}, relations: {} });
  });


  describe("addNode", function () {
    it("creates a node carrying its id and data", function () {
      const g = graph.createGraph();
      graph.addNode({ graph: g, id: 'id1', data: { tag: 'x' } });
      assert.deepEqual(g.nodes.id1, { id: 'id1', tag: 'x' });
    });


    it("merges new data into an existing node without dropping prior fields", function () {
      const g = graph.createGraph();
      graph.addNode({ graph: g, id: 'id1', data: { tag: 'x' } });
      graph.addNode({ graph: g, id: 'id1', data: { props: { a: 1 } } });
      assert.deepEqual(g.nodes.id1, { id: 'id1', tag: 'x', props: { a: 1 } });
    });
  });


  describe("addRelation", function () {
    it("wires a child relation both ways (child + parent)", function () {
      const g = graph.createGraph();
      graph.addRelation({ graph: g, fromId: 'p', toId: 'c', type: 'child' });

      assert.equal(g.relations.p.child, 'c');
      assert.equal(g.relations.c.parent, 'p');
      assert.equal(g.nodes.c.parent, 'p');
    });


    it("does not overwrite an existing first child", function () {
      const g = graph.createGraph();
      graph.addRelation({ graph: g, fromId: 'p', toId: 'c1', type: 'child' });
      graph.addRelation({ graph: g, fromId: 'p', toId: 'c2', type: 'child' });
      assert.equal(g.relations.p.child, 'c1');
    });


    it("wires a sibling relation both ways and stores sibling metadata", function () {
      const g = graph.createGraph();
      graph.addRelation({ graph: g, fromId: 'a', toId: 'b', type: 'sibling', siblingMeta: { idx: 0 } });

      assert.equal(g.relations.a.nextSibling, 'b');
      assert.equal(g.relations.b.prevSibling, 'a');
      assert.deepEqual(g.relations.a.siblingMeta, { idx: 0 });
    });
  });


  describe("getNode", function () {
    it("returns the stored node by id", function () {
      const g = graph.createGraph();
      graph.addNode({ graph: g, id: 'id1', data: { tag: 'x' } });
      assert.deepEqual(graph.getNode({ graph: g, id: 'id1' }), { id: 'id1', tag: 'x' });
    });


    it("returns undefined for an unknown id", function () {
      const g = graph.createGraph();
      assert.equal(graph.getNode({ graph: g, id: 'nope' }), undefined);
    });
  });
});
