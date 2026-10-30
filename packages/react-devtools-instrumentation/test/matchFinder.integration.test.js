//===================
// Import
//===================
import { MatchFinder } from "../modules/analysis/matchFinder.js";
import assert from "node:assert";



//===================
// Fake stateManager
//===================
// Builds a stateManager stub backed by plain in-memory maps. getNodeByID returns a fresh clone on
// every call, since MatchFinder mutates the returned node (graphIndex, instancesIds).
function createFakeStateManager({ preIndexed = {}, nodes = {}, componentIndex = {}, relations = {} } = {}) {
  return {
    async getPreIndexed(value) { return preIndexed[value] ? preIndexed[value].map(m => ({ ...m })) : []; },
    async getNodeByID(_graphIndex, id) { return nodes[id] ? structuredClone(nodes[id]) : undefined; },
    async getRelationsByID(_graphIndex, id) { return relations[id] ?? {}; },
    async getComponentIndexByID(_graphIndex) { return componentIndex; },
  };
}


function httpEventWith({ toEvaluate, ignore = 0 }) {
  return { value: { ignore, request: { analysis: { toEvaluate } } } };
}



//===================
// Test suite
//===================
// End-to-end matching flow: a reference identifier found on one component instance is resolved to a
// different value on a sibling instance of the same component, producing a (reference, candidates) couple.
describe("MatchFinder.find (integration with a mocked stateManager)", function () {

  it("pairs a reference node with a sibling candidate carrying a different value", async function () {
    const stateManager = createFakeStateManager({
      preIndexed: { abc123: [{ graphIndex: 0, nodeId: "ref1", value: "abc123", path: ["props", "id"] }] },
      nodes: {
        ref1: { id: "ref1", componentId: "CompA", props: { id: "abc123" } },
        inst2: { id: "inst2", componentId: "CompA", props: { id: "xyz789" } },
      },
      componentIndex: { CompA: ["ref1", "inst2"] },
      relations: { ref1: { parent: "root" }, inst2: { parent: "root" } },
    });

    const finder = new MatchFinder(stateManager);
    const data = await finder.find(httpEventWith({ toEvaluate: [{ value: "abc123" }] }));

    assert.ok(data.success);
    assert.equal(data.results.length, 1);

    const couple = data.results[0];
    assert.equal(couple.reference.node.id, "ref1");
    assert.equal(couple.candidates.length, 1);
    assert.equal(couple.candidates[0].node.id, "inst2");
    // the candidate carries the alternative value to be swapped into the forged request
    assert.equal(couple.candidates[0].target.value, "xyz789");
    assert.deepEqual(couple.candidates[0].path, ["props", "id"]);
  });


  it("reports no results when there is no preindexed match", async function () {
    const stateManager = createFakeStateManager({ preIndexed: {} });
    const finder = new MatchFinder(stateManager);

    const data = await finder.find(httpEventWith({ toEvaluate: [{ value: "nomatch" }] }));
    assert.ok(!data.success);
    assert.deepEqual(data.results, []);
  });


  it("discards orphan matches (node without a componentId)", async function () {
    const stateManager = createFakeStateManager({
      preIndexed: { orphanVal: [{ graphIndex: 0, nodeId: "orphan1", value: "orphanVal", path: ["props", "id"] }] },
      nodes: { orphan1: { id: "orphan1", props: { id: "orphanVal" } } }, // no componentId
    });

    const finder = new MatchFinder(stateManager);
    const data = await finder.find(httpEventWith({ toEvaluate: [{ value: "orphanVal" }] }));
    assert.ok(!data.success);
    assert.deepEqual(data.results, []);
  });


  it("drops a couple when the only sibling shares the reference value (no swap)", async function () {
    const stateManager = createFakeStateManager({
      preIndexed: { dup: [{ graphIndex: 0, nodeId: "ref1", value: "dup", path: ["props", "id"] }] },
      nodes: {
        ref1: { id: "ref1", componentId: "CompA", props: { id: "dup" } },
        inst2: { id: "inst2", componentId: "CompA", props: { id: "dup" } }, // same value -> not a candidate
      },
      componentIndex: { CompA: ["ref1", "inst2"] },
    });

    const finder = new MatchFinder(stateManager);
    const data = await finder.find(httpEventWith({ toEvaluate: [{ value: "dup" }] }));
    assert.ok(!data.success);
    assert.deepEqual(data.results, []);
  });


  it("short-circuits self-generated (ignored) HTTP events without touching stateManager", async function () {
    let touched = false;
    const stateManager = { getPreIndexed() { touched = true; return []; } };

    const finder = new MatchFinder(stateManager);
    const data = await finder.find(httpEventWith({ toEvaluate: [{ value: "abc123" }], ignore: 1 }));

    assert.equal(touched, false);
    assert.ok(!data.success);
    assert.deepEqual(data.results, []);
  });
});
