//===================
// Import
//===================
import {MatchFinder} from '../modules/analysis/matchFinder.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
// getValueAtPath() is the core of candidate matching: given a reference identifier found on one
// component instance, it extracts the corresponding value from a sibling instance so the two can
// be swapped in a forged request. The surrounding find()/processResults() flow is IndexedDB-backed
// and belongs in integration tests; here we also cover the one early-return that needs no state.
describe('MatchFinder', function () {
  // getValueAtPath/find do not touch stateManager in the paths tested below
  const finder = new MatchFinder(/* stateManager */ null);

  describe('getValueAtPath', function () {
    it('reads a nested value by path', function () {
      const obj = {a: {b: 'x'}};
      assert.equal(
        finder.getValueAtPath({obj, path: ['a', 'b'], originalVal: 'y'}),
        'x'
      );
    });

    it('returns undefined when the candidate value equals the reference (no swap possible)', function () {
      const obj = {a: {b: 'same'}};
      assert.equal(
        finder.getValueAtPath({obj, path: ['a', 'b'], originalVal: 'same'}),
        undefined
      );
    });

    it('returns undefined when the path does not exist', function () {
      const obj = {a: {}};
      assert.equal(
        finder.getValueAtPath({obj, path: ['a', 'b', 'c'], originalVal: 'y'}),
        undefined
      );
    });

    it('returns undefined when an intermediate node is not an object', function () {
      const obj = {a: 5};
      assert.equal(
        finder.getValueAtPath({obj, path: ['a', 'b'], originalVal: 'y'}),
        undefined
      );
    });

    describe('tokenized (array originalVal) matching', function () {
      it('extracts the single differing token from a path-like string', function () {
        const obj = {href: 'foo/bar'};
        // reference was tokenized as ['foo']; the candidate string differs only by 'bar'
        assert.equal(
          finder.getValueAtPath({obj, path: ['href'], originalVal: ['foo']}),
          'bar'
        );
      });

      it('returns undefined when nothing differs from the reference tokens', function () {
        const obj = {href: 'foo'};
        assert.equal(
          finder.getValueAtPath({obj, path: ['href'], originalVal: ['foo']}),
          undefined
        );
      });

      it('returns undefined when more than one token differs (ambiguous)', function () {
        const obj = {href: 'foo/bar/baz'};
        assert.equal(
          finder.getValueAtPath({obj, path: ['href'], originalVal: ['foo']}),
          undefined
        );
      });
    });
  });

  describe('find', function () {
    it('ignores self-generated HTTP events and reports no results', async function () {
      const httpEvent = {
        value: {ignore: 1, request: {analysis: {toEvaluate: []}}},
      };
      const data = await finder.find(httpEvent);

      assert.equal(data.success, false);
      assert.deepEqual(data.results, []);
      assert.equal(data.httpEvent, httpEvent.value);
    });
  });
});
