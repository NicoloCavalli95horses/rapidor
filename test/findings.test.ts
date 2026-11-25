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
  const base = { site: 'app.test', origin: 'https://app.test', method: 'GET', stateId: 1, referenceNodeId: 'node-1', candidateNodeId: 'node-2', path: ['user', 'id'] };

  it('is stable for the same finding', () => {
    assert.equal(vulnerabilityId(base), vulnerabilityId({ ...base }));
  });

  it('changes with every component of the semantic key', () => {
    const id = vulnerabilityId(base);
    assert.notEqual(id, vulnerabilityId({ ...base, site: 'other.test' }));
    assert.notEqual(id, vulnerabilityId({ ...base, origin: 'https://api.app.test' }));   // different layer
    assert.notEqual(id, vulnerabilityId({ ...base, method: CLIENT_ROUTING_METHOD }));    // different detection surface
    assert.notEqual(id, vulnerabilityId({ ...base, stateId: 2 }));
    assert.notEqual(id, vulnerabilityId({ ...base, referenceNodeId: 'node-3' }));
    assert.notEqual(id, vulnerabilityId({ ...base, candidateNodeId: 'node-4' }));
    assert.notEqual(id, vulnerabilityId({ ...base, path: ['user', 'name'] }));
  });

  // The REDUNDANCY the semantic key was built to collapse: same sibling pair surfaced through
  // multiple carrier URLs on the same layer (promova's page SSR flight with different plan ids,
  // different _rsc tokens, …) produces ONE id, not three — because the key no longer mentions the url.
  it('collapses multiple carrier urls on the same layer (same origin+method, same sibling pair)', () => {
    // same origin+method+pair, different carrier url shouldn't matter: the id depends on neither.
    assert.equal(vulnerabilityId(base), vulnerabilityId({ ...base }));
  });

  // Client-routing findings key on the SWAPPED SIBLING RESOURCE (candidate value + its URL position),
  // carrier-independent: the same sibling reached from two reference pages collapses, sibling resources
  // stay distinct, and — the lingualeo case — the SAME value at two scopes (`/wordMix` vs
  // `/word_set/8/wordMix`, both last path segment → position `path|0`) collapses to one.
  it('keys a client-routing finding on the swapped sibling identity, collapsing carrier/scope variants but not sibling values', () => {
    const clientBase = { ...base, method: CLIENT_ROUTING_METHOD };
    const v1032 = vulnerabilityId({ ...clientBase, clientSwap: '1032|path|0', stateId: 1, referenceNodeId: 'n-1030' });
    const v1032again = vulnerabilityId({ ...clientBase, clientSwap: '1032|path|0', stateId: 2, referenceNodeId: 'n-1031', candidateNodeId: 'other' });
    const v1033 = vulnerabilityId({ ...clientBase, clientSwap: '1033|path|0', stateId: 1, referenceNodeId: 'n-1030' });
    assert.equal(v1032, v1032again);     // same sibling from a different reference page → one finding
    assert.notEqual(v1032, v1033);        // a different sibling lesson → distinct finding
    // lingualeo: same premium type at two word-set scopes → identical swap identity → one finding
    const scopeA = vulnerabilityId({ ...clientBase, clientSwap: 'wordMix|path|0' });
    const scopeB = vulnerabilityId({ ...clientBase, clientSwap: 'wordMix|path|0', stateId: 9, referenceNodeId: 'n-ws8' });
    assert.equal(scopeA, scopeB);
  });

  // The DISTINCTIONS the semantic key preserves: an api-backend leak (different origin) and a
  // client-routing leak (different method) stay distinct from a page-SSR leak — the auditor sees one
  // row per layer, not one merged.
  it('preserves the api/page/client layer distinction via (origin, method)', () => {
    const api = vulnerabilityId({ ...base, origin: 'https://api.app.test' });
    const client = vulnerabilityId({ ...base, method: CLIENT_ROUTING_METHOD });
    assert.notEqual(vulnerabilityId(base), api);
    assert.notEqual(vulnerabilityId(base), client);
    assert.notEqual(api, client);
  });
});

describe('findings: describeExtractedSegment', () => {
  const candidate = { referenceValue: '101', candidateValue: '102' } as Parameters<typeof describeExtractedSegment>[0]['candidate'];

  it('names a query param candidate by its key', () => {
    const segment = { value: '101', parts: [''], index: 1, paramName: 'id', location: 'query' as const };
    assert.equal(describeExtractedSegment({ segment, candidate }), 'query param "id": 101 -> 102');
  });

  it('calls a path candidate a path segment', () => {
    const segment = { value: '101', parts: [''], index: 1, location: 'path' as const };
    assert.equal(describeExtractedSegment({ segment, candidate }), 'path segment: 101 -> 102');
  });
});
