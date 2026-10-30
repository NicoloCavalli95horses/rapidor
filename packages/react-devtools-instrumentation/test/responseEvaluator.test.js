//===================
// Import
//===================
import { ResponseEvaluator } from "../modules/analysis/responseEvaluator.js";
import assert from "node:assert";



//===================
// Test suite
//===================
// These cover the pure, side-effect-free scoring logic that decides whether two responses/nodes
// look "the same resource, different owner" (the heart of the IDOR heuristic). assessAuthZ() and
// handleEvent() are intentionally left out here: they depend on the bridge (window.postMessage)
// and the rxjs event bus, which belong in integration tests.
describe("ResponseEvaluator", function () {
  const evaluator = new ResponseEvaluator();


  describe("checkIntSimilarity", function () {
    it("treats two zeros as similar", function () {
      assert.equal(evaluator.checkIntSimilarity(0, 0), true);
    });


    it("is not similar when only one side is zero", function () {
      assert.equal(evaluator.checkIntSimilarity(0, 5), false);
      assert.equal(evaluator.checkIntSimilarity(5, 0), false);
    });


    it("is similar when the ratio stays within the threshold band", function () {
      // default threshold is 0.45; ratio 0.5 is inside [0.45, 1/0.45]
      assert.equal(evaluator.checkIntSimilarity(100, 50), true);
      assert.equal(evaluator.checkIntSimilarity(50, 100), true);
    });


    it("is not similar when the ratio falls outside the band", function () {
      assert.equal(evaluator.checkIntSimilarity(100, 30), false);
    });


    it("rejects non-finite inputs", function () {
      assert.equal(evaluator.checkIntSimilarity(Infinity, 100), false);
      assert.equal(evaluator.checkIntSimilarity(100, NaN), false);
    });
  });


  describe("compareObj (differential analysis)", function () {
    it("reports no differences for deeply equal objects", function () {
      const diffs = evaluator.compareObj({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } });
      assert.deepEqual(diffs, []);
    });


    it("reports a changed primitive with its path", function () {
      const diffs = evaluator.compareObj({ id: 1 }, { id: 2 });
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0].key, 'id');
      assert.equal(diffs[0].pathStr, 'id');
      assert.equal(diffs[0].reference, 1);
      assert.equal(diffs[0].current, 2);
    });


    it("reports a nested changed value with a dotted path", function () {
      const diffs = evaluator.compareObj({ user: { id: 1 } }, { user: { id: 2 } });
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0].pathStr, 'user.id');
    });


    it("reports a type mismatch (string vs number)", function () {
      const diffs = evaluator.compareObj({ id: 1 }, { id: '1' });
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0].key, 'id');
    });


    it("does not recurse infinitely on cyclic references", function () {
      const a = { self: null };
      a.self = a;
      const b = { self: null };
      b.self = b;
      assert.doesNotThrow(() => evaluator.compareObj(a, b));
    });
  });


  describe("extractKeyPaths (body shape)", function () {
    it("collects only top-level keys at depth 1", function () {
      const paths = evaluator.extractKeyPaths({ obj: { a: 1, b: { c: 2 } }, depth: 1 });
      assert.deepEqual(paths.sort(), ['a', 'b']);
    });


    it("collects nested keys as dotted paths at greater depth", function () {
      const paths = evaluator.extractKeyPaths({ obj: { a: 1, b: { c: 2 } }, depth: 2 });
      assert.deepEqual(paths.sort(), ['a', 'b', 'b.c']);
    });


    it("does not descend into arrays", function () {
      const paths = evaluator.extractKeyPaths({ obj: { list: [{ x: 1 }] }, depth: 5 });
      assert.deepEqual(paths, ['list']);
    });


    it("returns an empty array for an empty object", function () {
      assert.deepEqual(evaluator.extractKeyPaths({ obj: {} }), []);
    });
  });


  describe("areFieldsEqual", function () {
    it("is true when status/type/rawType/headers all match", function () {
      const r = { status: 200, type: 'cors', rawType: 'basic', headers: 'h' };
      const { areFieldsEqual } = evaluator.areFieldsEqual({ ...r }, { ...r });
      assert.equal(areFieldsEqual, true);
    });


    it("is false when any compared field differs", function () {
      const ref = { status: 200, type: 'cors', rawType: 'basic', headers: 'h' };
      const cur = { ...ref, status: 403 };
      const { areFieldsEqual } = evaluator.areFieldsEqual(ref, cur);
      assert.equal(areFieldsEqual, false);
    });
  });


  describe("getBodyLengthSimilarity", function () {
    it("compares the content-length header with the similarity band", function () {
      const r = evaluator.getBodyLengthSimilarity({ 'content-length': '100' }, { 'content-length': '90' });
      assert.equal(r.refBodyLength, 100);
      assert.equal(r.currBodyLength, 90);
      assert.equal(r.isBodyLengthSimilar, true);
    });


    it("treats a missing content-length as 0", function () {
      const r = evaluator.getBodyLengthSimilarity({}, {});
      assert.equal(r.refBodyLength, 0);
      assert.equal(r.isBodyLengthSimilar, true); // 0 vs 0
    });
  });


  describe("getServerResponseSimilarity", function () {
    it("flags two near-identical server responses as similar", function () {
      const ref = { status: 200, type: 'cors', rawType: 'basic', headers: 'h', 'content-length': '100', body: { id: 1, name: 'a' } };
      const cur = { status: 200, type: 'cors', rawType: 'basic', headers: 'h', 'content-length': '98', body: { id: 2, name: 'b' } };
      const r = evaluator.getServerResponseSimilarity(ref, cur);
      assert.equal(r.areSimilar, true);
    });


    it("is not similar when the status differs (eg. 200 vs 403)", function () {
      const ref = { status: 200, type: 'cors', rawType: 'basic', headers: 'h', 'content-length': '100', body: { id: 1 } };
      const cur = { status: 403, type: 'cors', rawType: 'basic', headers: 'h', 'content-length': '100', body: { id: 1 } };
      const r = evaluator.getServerResponseSimilarity(ref, cur);
      assert.equal(r.areSimilar, false);
    });
  });


  describe("getReportId (deduplication)", function () {
    it("returns a stable SHA-256 hex id the first time, and null on a repeat", async function () {
      const fresh = new ResponseEvaluator();
      const current = {
        analysis: { target: { value: 'id2' } },
        node: { id: 'nodeA' },
        request: { method: 'GET', url: 'https://e.com/api/item/id2' },
      };

      const first = await fresh.getReportId(current);
      assert.equal(typeof first, 'string');
      assert.equal(first.length, 64); // 32 bytes as hex

      const second = await fresh.getReportId(current);
      assert.equal(second, null);
    });


    it("produces different ids for different candidates", async function () {
      const fresh = new ResponseEvaluator();
      const base = { analysis: { target: { value: 'id2' } }, node: { id: 'nodeA' }, request: { method: 'GET', url: 'https://e.com/a' } };
      const other = { analysis: { target: { value: 'id3' } }, node: { id: 'nodeB' }, request: { method: 'GET', url: 'https://e.com/b' } };

      const idA = await fresh.getReportId(base);
      const idB = await fresh.getReportId(other);
      assert.notEqual(idA, idB);
    });
  });
});
