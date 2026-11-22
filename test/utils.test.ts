import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlEmbedsValue, shuffled, isExternalAppLink, linkScheme } from '../src/utils/utils';

test('urlEmbedsValue finds a value embedded inside a query param path (the incoherence signal)', () => {
  // ejoy's incoherent candidate: courseId 37 swapped to 32 in the path, but still present in ?path=
  const u = 'https://ejoy-english.com/app/courses/32/314/1030?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1030%2Fc75f.json';
  assert.equal(urlEmbedsValue(u, '37'), true);   // 37 lingers inside the decoded ?path=
  assert.equal(urlEmbedsValue(u, '1030'), true);
  assert.equal(urlEmbedsValue(u, '32'), true);   // the new value is in the path
});

test('urlEmbedsValue is boundary-aware (no substring / hash false matches) and clean on coherent urls', () => {
  // 37 must NOT match inside 370, 1037, or a hex hash
  assert.equal(urlEmbedsValue('https://x.test/a/370/b', '37'), false);
  assert.equal(urlEmbedsValue('https://x.test/a/c75f7750fc1d/b', '37'), false);
  // a coherent course swap with no lingering old value
  assert.equal(urlEmbedsValue('https://ejoy-english.com/app/courses/32', '37'), false);
});

test('shuffled returns a permutation without mutating the input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const snapshot = input.slice();
  const out = shuffled(input);
  assert.deepEqual(input, snapshot);                         // input untouched
  assert.equal(out.length, input.length);
  assert.deepEqual([...out].sort((a, b) => a - b), snapshot); // same multiset
  // over several shuffles of a 10-element array, at least one must reorder (P(all identical) ~ 0)
  const anyReordered = Array.from({ length: 20 }, () => shuffled(input)).some((s) => s.some((v, i) => v !== input[i]));
  assert.ok(anyReordered);
});

test('shuffled handles empty and single-element arrays', () => {
  assert.deepEqual(shuffled([]), []);
  assert.deepEqual(shuffled([42]), [42]);
});

test('linkScheme returns the scheme only for absolute URLs with one', () => {
  assert.equal(linkScheme('mailto:a@b.com'), 'mailto');
  assert.equal(linkScheme('TEL:+39'), 'tel');
  assert.equal(linkScheme('  webcal://x '), 'webcal');
  assert.equal(linkScheme('https://x/y'), 'https');
  assert.equal(linkScheme('/path'), null);          // relative
  assert.equal(linkScheme('#anchor'), null);
  assert.equal(linkScheme('?q=1'), null);
  assert.equal(linkScheme('//host/path'), null);    // protocol-relative
});

test('isExternalAppLink flags external-app schemes and leaves in-browser links alone', () => {
  for (const href of ['mailto:a@b.com', 'tel:+39', 'sms:+39', 'webcal://x/c.ics',
    'zoommtg://zoom.us/join', 'customapp://do']) {
    assert.ok(isExternalAppLink({ href }), `${href} should be external`);
  }
  for (const href of ['/x', '#a', 'https://x/y', 'http://x', 'javascript:void(0)', undefined, null, '']) {
    assert.equal(isExternalAppLink({ href }), false, `${href} should stay in-browser`);
  }
  // the allowlist is overridable
  assert.ok(isExternalAppLink({ href: 'https://x', allowedSchemes: ['http'] }));
});
