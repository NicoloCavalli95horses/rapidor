//===================
// Import
//===================
import {PreIndexing} from '../modules/state/preindexing.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
// The preindexing heuristics decide which component props are worth indexing as potential
// identifiers. Over-matching floods the index; under-matching misses the IDOR. These tests pin
// the key-matching and value-eligibility rules, the tokenizer, and the prop tree walk.
describe('PreIndexing', function () {
  describe('splitWords', function () {
    const pre = new PreIndexing();

    it('splits camelCase into separate lowercase words', function () {
      assert.deepEqual(pre.splitWords('userId'), ['user', 'id']);
    });

    it('splits on non-alphanumeric separators', function () {
      assert.deepEqual(pre.splitWords('user_account-name'), [
        'user',
        'account',
        'name',
      ]);
    });
  });

  describe('isKeyMatch', function () {
    const pre = new PreIndexing();

    it('matches an exact configured key', function () {
      assert.equal(pre.isKeyMatch('id'), true);
    });

    it('matches via camelCase word membership (userId -> user, id)', function () {
      assert.equal(pre.isKeyMatch('userId'), true);
    });

    it('matches a prefix (identifier starts with id)', function () {
      assert.equal(pre.isKeyMatch('identifier'), true);
    });

    it('does not match an unrelated key', function () {
      assert.equal(pre.isKeyMatch('background'), false);
    });

    it('returns false for an empty/falsy key', function () {
      assert.equal(pre.isKeyMatch(''), false);
      assert.equal(pre.isKeyMatch(undefined), false);
    });
  });

  describe('isInteresting', function () {
    const pre = new PreIndexing();

    it('keeps a short identifier-like string under a matching key', function () {
      assert.equal(pre.isInteresting('id', 'abc123'), true);
    });

    it('keeps a finite number under a matching key', function () {
      assert.equal(pre.isInteresting('id', 42), true);
    });

    it('rejects a value under a non-matching key', function () {
      assert.equal(pre.isInteresting('background', 'abc123'), false);
    });

    it('rejects null/undefined values', function () {
      assert.equal(pre.isInteresting('id', null), false);
      assert.equal(pre.isInteresting('id', undefined), false);
    });

    it('rejects strings with whitespace or square brackets (not an identifier)', function () {
      assert.equal(pre.isInteresting('id', 'John Smith'), false);
      assert.equal(pre.isInteresting('id', '[1,2,3]'), false);
    });

    it('rejects a single-character string', function () {
      assert.equal(pre.isInteresting('id', 'a'), false);
    });

    it('rejects a non-finite number', function () {
      assert.ok(!pre.isInteresting('id', Infinity));
    });
  });

  describe('tokenize', function () {
    const pre = new PreIndexing();

    it('splits a path/URL-like string on / . and ?', function () {
      assert.deepEqual(pre.tokenize('api/item.json?x'), [
        'api',
        'item',
        'json',
        'x',
      ]);
    });

    it('drops empty tokens', function () {
      assert.deepEqual(pre.tokenize('//a//b'), ['a', 'b']);
    });

    it('returns an empty array for a non-string', function () {
      assert.deepEqual(pre.tokenize(123), []);
    });
  });

  describe('iterate (prop tree walk)', function () {
    const pre = new PreIndexing();

    it('visits every leaf with its full path', function () {
      const leaves = [];
      pre.iterate({a: 1, b: {c: 2}, d: [3, 4]}, ({key, value, path}) =>
        leaves.push({key, value, path})
      );

      const values = leaves.map(l => l.value).sort();
      assert.deepEqual(values, [1, 2, 3, 4]);

      const nested = leaves.find(l => l.value === 2);
      assert.deepEqual(nested.path, ['props', 'b', 'c']);
    });

    it('stops descending past maxDepth', function () {
      const leaves = [];
      // props -> a -> b -> c -> d is 5 levels; default maxDepth is 4
      pre.iterate({a: {b: {c: {d: 1}}}}, ({value}) => leaves.push(value));
      assert.equal(leaves.length, 0);
    });
  });

  describe('prepareData', function () {
    it('indexes both the interesting key name and the interesting prop value', function () {
      const pre = new PreIndexing();
      pre.prepareData({
        graphIndex: 0,
        nodeId: 'n1',
        key: 'userId',
        props: {id: 'abc123', label: 'ignored'},
      });

      // one entry for the key 'userId', one for the prop id value
      assert.equal(pre.data.length, 2);

      const keyEntry = pre.data.find(
        d => d.path.length === 1 && d.path[0] === 'key'
      );
      assert.equal(keyEntry.value, 'userId');
      assert.equal(keyEntry.depth, 0);

      const valueEntry = pre.data.find(d => d.path.includes('id'));
      assert.deepEqual(valueEntry.value, ['abc123']); // values are always stored tokenized (array)
      assert.deepEqual(valueEntry.path, ['props', 'id']);
    });

    it('indexes nothing when neither the key nor any prop is interesting', function () {
      const pre = new PreIndexing();
      // key is undefined (no React key) and no prop name matches the configured identifier list
      pre.prepareData({
        graphIndex: 0,
        nodeId: 'n1',
        key: undefined,
        props: {style: 'red', className: 'box'},
      });
      assert.equal(pre.data.length, 0);
    });
  });
});
