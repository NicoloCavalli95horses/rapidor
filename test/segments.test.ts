import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractSegments, spliceSegment, candidateUrlFor } from '../src/analysis/segments';

describe('extractSegments', () => {
  it('extracts every path segment as a candidate', () => {
    const candidates = extractSegments({ url: 'https://a.test/api/users/42' });
    assert.deepEqual(candidates, [
      { parts: ['https://a.test/', '/users/42'], value: 'api', index: 1, query: '' },
      { parts: ['https://a.test/api/', '/42'], value: 'users', index: 1, query: '' },
      { parts: ['https://a.test/api/users/', ''], value: '42', index: 1, query: '' },
    ]);
  });

  it('keeps an id segment at the start of a long path', () => {
    const values = extractSegments({ url: 'https://a.test/users/42/profile/settings/privacy/notifications/email' }).map((c) => c.value);
    assert.deepEqual(values, ['users', '42', 'profile', 'settings', 'privacy', 'notifications', 'email']);
  });

  it('returns no path candidates for the root path', () => {
    assert.deepEqual(extractSegments({ url: 'https://a.test/' }), []);
  });

  it('extracts query params as separate candidates, excluding true/false and the path value', () => {
    const candidates = extractSegments({ url: 'https://a.test/api/items?id=42&active=true' });
    assert.deepEqual(candidates, [
      { parts: ['https://a.test/', '/items'], value: 'api', index: 1, query: '?id=42&active=true' },
      { parts: ['https://a.test/api/', ''], value: 'items', index: 1, query: '?id=42&active=true' },
      { parts: ['https://a.test/api/items?id='], value: '42', index: 1, paramName: 'id' },
    ]);
  });

  it('keeps the file extension on the suffix side when the segment has one', () => {
    const candidate = extractSegments({ url: 'https://a.test/files/report.pdf' }).at(-1);
    assert.deepEqual(candidate, { parts: ['https://a.test/files/', '.pdf'], value: 'report', index: 1, query: '' });
  });
});

describe('spliceSegment', () => {
  it('inserts the value between prefix/suffix and re-attaches the query string', () => {
    const url = spliceSegment({ parts: ['https://a.test/users/', '/profile'], index: 1, value: '99', query: '?x=1' });
    assert.equal(url, 'https://a.test/users/99/profile?x=1');
  });

  it('appends the value for a single-part query candidate (no query re-attachment)', () => {
    const url = spliceSegment({ parts: ['https://a.test/items?id='], index: 1, value: '99' });
    assert.equal(url, 'https://a.test/items?id=99');
  });
});

describe('candidateUrlFor', () => {
  /** The one segment of `url` that `extractSegments` proposed for `value`. */
  function segmentFor({ url, value }: { url: string; value: string }) {
    const segment = extractSegments({ url }).find((s) => s.value === value);
    assert.ok(segment, `expected a candidate segment for ${value}`);
    return segment;
  }

  it('keeps the OTHER query params when swapping one (the busuu include_voice regression)', () => {
    const url = 'https://api.busuu.com/notifications?include_voice=1&limit=5';
    const segment = segmentFor({ url, value: '5' });

    // spliceSegment alone rebuilds the URL from the candidate's single part and loses include_voice
    assert.equal(
      spliceSegment({ parts: segment.parts, index: segment.index, value: '12538', query: segment.query }),
      'https://api.busuu.com/notifications?limit=12538',
    );
    // candidateUrlFor sets the param on the real URL instead
    const forged = new URL(candidateUrlFor({ url, segment, value: '12538' }));
    assert.equal(forged.searchParams.get('limit'), '12538');
    assert.equal(forged.searchParams.get('include_voice'), '1', 'the untouched param must survive');
  });

  it('swaps a path segment and keeps the whole query string', () => {
    const url = 'https://a.test/api/users/42?id=7&active=true';
    const segment = segmentFor({ url, value: 'users' });

    assert.equal(candidateUrlFor({ url, segment, value: 'accounts' }), 'https://a.test/api/accounts/42?id=7&active=true');
  });

  it('falls back to the positional splice when the URL cannot be parsed', () => {
    const segment = { parts: ['not-a-url?id='], value: '1', index: 1, paramName: 'id' };
    assert.equal(candidateUrlFor({ url: 'not-a-url', segment, value: '2' }), 'not-a-url?id=2');
  });
});
