//===================
// Import
//===================
import { ResponseEvaluator } from "../modules/analysis/responseEvaluator.js";
import { initClientToBridge } from "../utils/clientToBridge.js";
import { createFakeWindow, attachFakeBridge } from "./helpers/fakeWindow.js";
import assert from "node:assert";



//===================
// Test suite
//===================
// assessAuthZ() diffs reference vs candidate props and asks the bridge to classify the changed keys.
// Here the bridge is faked: it marks any key in SENSITIVE as authorization-relevant. This exercises
// the full round-trip (compareObj -> payload filtering -> sendToBridge -> isPremium verdict).
describe("ResponseEvaluator.assessAuthZ (bridge integration)", function () {
  const SENSITIVE = new Set(["isPremium", "role"]);
  let evaluator;

  beforeEach(function () {
    global.window = createFakeWindow();
    initClientToBridge(); // registers the listener that resolves sendToBridge() promises
    attachFakeBridge({
      win: global.window,
      classify: (msg) => ({
        results: (msg.payload || []).map((key) => ({ key, isAuthZRelevant: SENSITIVE.has(key) })),
      }),
    });
    evaluator = new ResponseEvaluator();
  });

  afterEach(function () {
    delete global.window;
  });


  it("flags premium when a sensitive key changes between reference and candidate", async function () {
    const { isPremium, differences } = await evaluator.assessAuthZ(
      { isPremium: false, name: "item" },
      { isPremium: true, name: "item" }
    );

    assert.equal(isPremium, true);
    assert.equal(differences.length, 1);
    assert.equal(differences[0].key, "isPremium");
  });


  it("does not flag premium when the changed keys are not sensitive", async function () {
    const { isPremium, differences } = await evaluator.assessAuthZ(
      { color: "red" },
      { color: "blue" }
    );

    assert.equal(isPremium, false);
    assert.equal(differences.length, 1); // a difference exists, it just isn't authZ-relevant
  });


  it("does not flag premium when there are no prop differences", async function () {
    const { isPremium, differences } = await evaluator.assessAuthZ(
      { id: "a", qty: 1 },
      { id: "a", qty: 1 }
    );

    assert.equal(isPremium, false);
    assert.deepEqual(differences, []);
  });


  it("detects a sensitive key nested inside the props tree", async function () {
    const { isPremium } = await evaluator.assessAuthZ(
      { meta: { role: "user" } },
      { meta: { role: "admin" } }
    );

    assert.equal(isPremium, true);
  });
});
