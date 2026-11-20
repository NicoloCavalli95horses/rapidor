import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteCorrelatedQuery } from '../src/analysis/correlatedQuery';

// ejoy: each lesson's React node carries its own content path (hash included), even paid ones.
const lesson = (id: number, hash: string, lock: boolean) => ({
  lesson: { id, lock, name: `Lesson ${id}`, path: `cp/course/live/37/lessons/${id}/${hash}.json` },
});

test('rewrites ?path= to the SIBLING lesson\'s own capability path (the leaked-hash IDOR)', () => {
  const url = 'https://ejoy-english.com/app/courses/37/314/1032?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1030%2Fc75f.json';
  const out = rewriteCorrelatedQuery({
    url,
    referenceValue: '1030',                       // the swapped-out lesson id, still carried by ?path=
    referenceProps: lesson(1030, 'c75f', false),
    candidateProps: lesson(1032, 'be93', true),   // paid sibling, its own path/hash leaked in state
  });
  // the query now points at lesson 1032's own content, making the url coherent and the IDOR reachable
  assert.equal(new URL(out).searchParams.get('path'), 'cp/course/live/37/lessons/1032/be93.json');
});

test('no rewrite when the query carries no copy of the swapped value (courseId case stays incoherent)', () => {
  // courseId 37 -> 32: ?path= carries a LESSON path, not found on the course node -> left as-is
  const url = 'https://ejoy-english.com/app/courses/32/314/1030?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1030%2Fc75f.json';
  const courseNode = { course: { id: 37, name: 'Business English' } };
  const out = rewriteCorrelatedQuery({ url, referenceValue: '37', referenceProps: courseNode, candidateProps: { course: { id: 32, name: 'Travel' } } });
  assert.equal(out, url);   // unchanged -> the coherence check then strips the query
});

test('no rewrite and no throw on a url without a query / on malformed input', () => {
  assert.equal(rewriteCorrelatedQuery({ url: 'https://x.test/a/b', referenceValue: '1', referenceProps: {}, candidateProps: {} }), 'https://x.test/a/b');
  assert.equal(rewriteCorrelatedQuery({ url: 'not a url', referenceValue: '1', referenceProps: {}, candidateProps: {} }), 'not a url');
});
