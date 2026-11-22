import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_ROUTING_METHOD, vulnerabilityId, normalizeUrl, describeExtractedSegment } from '../src/analysis/findings';

describe('findings: normalizeUrl (the history-filter canonical form)', () => {
  it('sorts query params by key so param ORDER never makes two equal URLs differ', () => {
    assert.equal(
      normalizeUrl('https://app.test/x?b=2&a=1'),
      normalizeUrl('https://app.test/x?a=1&b=2'),
    );
  });

  it('decodes the path and the values, so %20 and a literal space compare equal', () => {
    assert.equal(
      normalizeUrl('https://app.test/a%20b?q=c%20d'),
      normalizeUrl('https://app.test/a b?q=c d'),
    );
  });

  it('strips a trailing slash but keeps the root as /', () => {
    assert.equal(normalizeUrl('https://app.test/users/'), normalizeUrl('https://app.test/users'));
    assert.equal(normalizeUrl('https://app.test/'), 'https://app.test/');
  });

  it('keeps genuinely different URLs apart (different path, or one differing param VALUE)', () => {
    assert.notEqual(normalizeUrl('https://app.test/users/1'), normalizeUrl('https://app.test/users/2'));
    assert.notEqual(normalizeUrl('https://app.test/x?id=1'), normalizeUrl('https://app.test/x?id=2'));
  });

  it('returns malformed input unchanged instead of throwing', () => {
    assert.equal(normalizeUrl('not a url'), 'not a url');
  });

  it('strips volatile cache-busting params (_rsc) so RSC duplicates of one request canonicalize equal', () => {
    // Next.js tags each navigation with a fresh `_rsc` token; two captures of the same request differ
    // only by it and must collapse to one (history filter + finding dedup), while real params stay.
    assert.equal(normalizeUrl('https://app.test/p/79?_rsc=abc'), normalizeUrl('https://app.test/p/79?_rsc=zzz'));
    assert.equal(normalizeUrl('https://app.test/p/79?_rsc=abc'), 'https://app.test/p/79');
    assert.equal(normalizeUrl('https://app.test/x?id=5&_rsc=abc'), 'https://app.test/x?id=5');
  });

  it('strips any param whose VALUE is an epoch timestamp, whatever its name (robust cache-buster filter)', () => {
    // A fresh timestamp per request made the same endpoint look like thousands of distinct URLs
    // (duolingo's `_`/`ts`), inflating the history filter and candidate generation. Detection is by
    // value shape, not name, so it also catches cache-busters a name list would miss (promova's `tft`).
    assert.equal(normalizeUrl('https://app.test/cfg?_=1795251407'), normalizeUrl('https://app.test/cfg?_=1795251999'));
    assert.equal(normalizeUrl('https://app.test/cfg?tft=1795251407832'), 'https://app.test/cfg');        // 13-digit ms, odd name
    assert.equal(normalizeUrl('https://app.test/25/web.json?user=9&ts=1795251407&foo=bar'),
      'https://app.test/25/web.json?foo=bar&user=9');                                                     // ts stripped, real params kept
  });

  it('keeps a short integer value that is NOT a timestamp (a real id/flag), however the param is named', () => {
    // `_=1` has a cache-buster NAME but a non-epoch value: it is kept, because only timestamp-shaped
    // values are volatile. A 10/13-digit id outside the recent-epoch window is kept too.
    assert.equal(normalizeUrl('https://app.test/x?_=1&id=5'), 'https://app.test/x?_=1&id=5');
    assert.equal(normalizeUrl('https://app.test/x?id=9999999999999'), 'https://app.test/x?id=9999999999999'); // 13 digits, out of ms epoch range
  });

  it('keeps an identifier param whose value happens to look like an epoch (the KEY disambiguates)', () => {
    // A real id can coincide with the epoch window; its name proves it is a resource, so it is kept —
    // unlike an anonymous cache-buster carrying the same shape.
    for (const name of ['id', 'userId', 'user_id', 'accountId', 'uuid', 'refId', 'session_token']) {
      assert.equal(normalizeUrl(`https://app.test/x?${name}=1795251407832`),
        `https://app.test/x?${name}=1795251407832`, `${name} must be kept`);
    }
    // same timestamp-shaped value under a cache-buster name IS stripped
    assert.equal(normalizeUrl('https://app.test/x?_=1795251407832'), 'https://app.test/x');
  });
});

describe('findings: vulnerabilityId', () => {
  const base = { candidateValue: '102', nodeId: 'node-2', method: 'GET', url: 'https://app.test/users/102' };

  it('is stable for the same finding', () => {
    assert.equal(vulnerabilityId(base), vulnerabilityId({ ...base }));
  });

  it('changes when any component of the finding changes', () => {
    const id = vulnerabilityId(base);
    assert.notEqual(id, vulnerabilityId({ ...base, candidateValue: '103' }));
    assert.notEqual(id, vulnerabilityId({ ...base, nodeId: 'node-3' }));
    assert.notEqual(id, vulnerabilityId({ ...base, method: CLIENT_ROUTING_METHOD }));
    assert.notEqual(id, vulnerabilityId({ ...base, url: 'https://app.test/users/103' }));
  });
});

describe('findings: describeExtractedSegment', () => {
  const candidate = { referenceValue: '101', candidateValue: '102' } as Parameters<typeof describeExtractedSegment>[0]['candidate'];

  it('names a query param candidate by its key', () => {
    const segment = { value: '101', parts: [''], index: 1, paramName: 'id' };
    assert.equal(describeExtractedSegment({ segment, candidate }), 'query param "id": 101 -> 102');
  });

  it('calls a path candidate a path segment', () => {
    const segment = { value: '101', parts: [''], index: 1 };
    assert.equal(describeExtractedSegment({ segment, candidate }), 'path segment: 101 -> 102');
  });
});
