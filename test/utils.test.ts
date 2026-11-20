import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripUrlQuery } from '../src/utils/utils';

test('stripUrlQuery removes the whole query (the client-routing path fallback input)', () => {
  // ejoy's incoherent candidate: new lesson id in the path, stale ?path=.../<oldId>/<hash>.json kept
  assert.equal(
    stripUrlQuery('https://ejoy-english.com/app/courses/37/314/1031?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1030%2Fabc.json'),
    'https://ejoy-english.com/app/courses/37/314/1031',
  );
  assert.equal(stripUrlQuery('https://x.test/a/b?x=1&y=2'), 'https://x.test/a/b');
});

test('stripUrlQuery is a no-op without a query, and on malformed input', () => {
  assert.equal(stripUrlQuery('https://x.test/a/b'), 'https://x.test/a/b');
  assert.equal(stripUrlQuery('not a url'), 'not a url');
});
