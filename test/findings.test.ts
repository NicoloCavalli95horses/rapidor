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
