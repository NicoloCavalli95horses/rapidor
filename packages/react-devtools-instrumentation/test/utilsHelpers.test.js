//===================
// Import
//===================
import {
  copyObjKeys, isPlainObject, isSerializableValue, hasOwnKeys, isCloneable, payloadSize
} from "../utils/utils.js";
import assert from "node:assert";



//===================
// Test suite
//===================
// Pure helpers used throughout state capture and serialization. These guard the boundaries that
// decide what gets cloned into snapshots and persisted to IndexedDB.
describe("utils (pure helpers)", function () {

  describe("copyObjKeys", function () {
    it("copies only the requested, own keys", function () {
      const out = copyObjKeys({ a: 1, b: 2, c: 3 }, ['a', 'c']);
      assert.deepEqual(out, { a: 1, c: 3 });
    });


    it("skips keys that are absent", function () {
      const out = copyObjKeys({ a: 1 }, ['a', 'missing']);
      assert.deepEqual(out, { a: 1 });
    });


    it("returns an empty object with defaults", function () {
      assert.deepEqual(copyObjKeys(), {});
    });
  });


  describe("isPlainObject", function () {
    it("is true for object literals and null-prototype objects", function () {
      assert.equal(isPlainObject({}), true);
      assert.equal(isPlainObject(Object.create(null)), true);
    });


    it("is false for arrays, null, and class instances", function () {
      assert.equal(isPlainObject([]), false);
      assert.equal(isPlainObject(null), false);
      assert.equal(isPlainObject(new Date()), false);
    });
  });


  describe("isSerializableValue", function () {
    it("accepts JSON primitives, arrays and plain objects", function () {
      assert.equal(isSerializableValue(null), true);
      assert.equal(isSerializableValue('x'), true);
      assert.equal(isSerializableValue(true), true);
      assert.equal(isSerializableValue(42), true);
      assert.equal(isSerializableValue([1, 2]), true);
      assert.equal(isSerializableValue({ a: 1 }), true);
    });


    it("rejects non-finite numbers and non-plain objects", function () {
      assert.equal(isSerializableValue(Infinity), false);
      assert.equal(isSerializableValue(NaN), false);
      assert.equal(isSerializableValue(new Date()), false);
      assert.equal(isSerializableValue(() => {}), false);
    });
  });


  describe("hasOwnKeys", function () {
    it("is true only for a non-empty plain object", function () {
      assert.equal(hasOwnKeys({ a: 1 }), true);
    });


    it("is false for empty objects, arrays, and null", function () {
      assert.equal(hasOwnKeys({}), false);
      assert.equal(hasOwnKeys([1, 2]), false);
      assert.equal(hasOwnKeys(null), false);
    });
  });


  describe("isCloneable", function () {
    it("is true for structured-cloneable data", function () {
      assert.equal(isCloneable({ a: [1, 2], b: 'x' }), true);
    });


    it("is false for values that cannot be structured-cloned (eg. functions)", function () {
      assert.equal(isCloneable(() => {}), false);
    });
  });


  describe("payloadSize", function () {
    it("reports byte/kb/mb sizes of the JSON encoding", function () {
      const size = payloadSize({ a: 'hello' });
      assert.equal(size.bytes, new TextEncoder().encode(JSON.stringify({ a: 'hello' })).length);
      assert.equal(typeof size.kb, 'string');
      assert.equal(typeof size.mb, 'string');
    });
  });
});
