import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkIntSimilarity, getServerResponseSimilarity, compareObj, isIdenticalResponse } from '../src/analysis/responseEvaluate';

describe('checkIntSimilarity', () => {
  it('true when both are zero, false when only one is', () => {
    assert.equal(checkIntSimilarity(0, 0), true);
    assert.equal(checkIntSimilarity(0, 5), false);
    assert.equal(checkIntSimilarity(5, 0), false);
  });

  it('true within the 0.45-2.22 ratio band, false outside it', () => {
    assert.equal(checkIntSimilarity(100, 100), true);
    assert.equal(checkIntSimilarity(100, 50), true);   // ratio 0.5
    assert.equal(checkIntSimilarity(100, 40), false);  // ratio 0.4
    assert.equal(checkIntSimilarity(100, 300), false); // ratio 3
  });
});

describe('getServerResponseSimilarity', () => {
  const reference = { status: 200, headers: {}, body: '{"data":"lorem ipsum"}', contentType: 'application/json' };

  it('is similar when status/content-type match and body length/shape are close', () => {
    const candidate = { status: 200, headers: {}, body: '{"data":"premium lorem ipsum"}', contentType: 'application/json' };
    const result = getServerResponseSimilarity(reference, candidate);
    assert.equal(result.areSimilar, true);
    assert.equal(result.fields.areEqual, true);
    assert.equal(result.bodyShape.refKeys, 1);
    assert.equal(result.bodyShape.candKeys, 1);
  });

  it('is not similar when the status differs', () => {
    const candidate = { status: 404, headers: {}, body: '{"error":"not found"}', contentType: 'application/json' };
    assert.equal(getServerResponseSimilarity(reference, candidate).areSimilar, false);
  });

  it('is not similar when the body shape differs a lot', () => {
    const candidate = { status: 200, headers: {}, body: '{"a":1,"b":2,"c":3,"d":4}', contentType: 'application/json' };
    assert.equal(getServerResponseSimilarity(reference, candidate).areSimilar, false);
  });

  it('falls back to the content-length header when the body text is unavailable (e.g. a cancelled stream)', () => {
    const ref = { status: 200, headers: { 'content-length': '20' }, body: '', contentType: 'application/json' };
    const closeCandidate = { status: 200, headers: {}, body: '{"data":"premium!!!"}', contentType: 'application/json' };
    assert.equal(getServerResponseSimilarity(ref, closeCandidate).bodyLength.isSimilar, true);

    const farCandidate = { status: 200, headers: {}, body: '{"a":"this is a much much much longer response body"}', contentType: 'application/json' };
    assert.equal(getServerResponseSimilarity(ref, farCandidate).bodyLength.isSimilar, false);
  });

  it('treats a missing body (no text, no content-length) as inconclusive for length/shape, not a mismatch', () => {
    const ref = { status: 200, headers: {}, body: '', contentType: 'application/json' };
    const candidate = { status: 200, headers: {}, body: '{"data":"anything"}', contentType: 'application/json' };
    const result = getServerResponseSimilarity(ref, candidate);
    assert.equal(result.bodyLength.isSimilar, true);
    assert.equal(result.bodyShape.isSimilar, true);
    assert.equal(result.areSimilar, true); // fields also match: status+contentType equal
  });

  it('treats two non-JSON bodies (e.g. HTML/RSC payloads) as shapeless but still checks length', () => {
    const ref = { status: 200, headers: {}, body: '<html>short</html>', contentType: 'text/html' };
    const candidate = { status: 200, headers: {}, body: '<html>short!</html>', contentType: 'text/html' };
    const result = getServerResponseSimilarity(ref, candidate);
    assert.equal(result.bodyShape.isSimilar, true); // both parse to 0 keys -> trivially similar
    assert.equal(result.areSimilar, true);
  });
});

describe('compareObj', () => {
  it('diffs primitive leaves and reports path/key', () => {
    const diffs = compareObj({ id: 'a', nested: { premium: false } }, { id: 'b', nested: { premium: true } });
    assert.deepEqual(diffs.map((d) => [d.pathStr, d.reference, d.current]).sort(), [
      ['id', 'a', 'b'],
      ['nested.premium', false, true],
    ]);
  });

  it('is empty for deeply equal objects', () => {
    assert.deepEqual(compareObj({ a: { b: 1 } }, { a: { b: 1 } }), []);
  });

  it('treats a type change (e.g. object -> primitive) as a single leaf diff', () => {
    const diffs = compareObj({ a: { b: 1 } }, { a: 'now-a-string' });
    assert.deepEqual(diffs, [{ path: ['a'], reference: { b: 1 }, current: 'now-a-string', key: 'a', pathStr: 'a' }]);
  });
});

describe('isIdenticalResponse (server ignored the swapped value)', () => {
  const res = (body: string, status = 200) => ({ status, headers: {}, body, contentType: 'application/json' });

  it('is true for byte-identical bodies', () => {
    assert.equal(isIdenticalResponse({ reference: res('{"a":1}'), candidate: res('{"a":1}') }), true);
  });

  it('is true for deep-equal JSON regardless of key order and whitespace', () => {
    assert.equal(isIdenticalResponse({ reference: res('{"a":1,"b":[1,2]}'), candidate: res('{ "b": [1, 2], "a": 1 }') }), true);
  });

  it('is false when a single value differs', () => {
    assert.equal(isIdenticalResponse({ reference: res('{"owner":"alice"}'), candidate: res('{"owner":"bob"}') }), false);
  });

  it('is false when the status differs', () => {
    assert.equal(isIdenticalResponse({ reference: res('{}'), candidate: res('{}', 404) }), false);
  });

  it('is false when either body is missing (cannot prove identity)', () => {
    assert.equal(isIdenticalResponse({ reference: res(''), candidate: res('') }), false);
  });
});
