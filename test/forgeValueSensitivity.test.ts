import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForgeValueSensitivity, forgeTemplateKey, singleSwapPosition } from '../src/analysis/forgeValueSensitivity';
import { extractSegments } from '../src/analysis/segments';

const REF = 'https://api.getpronounce.com/pronounce?text=Hi&voice=shimmer&provider=openai';

describe('forgeTemplateKey', () => {
  it('keys on the request + the swapped position, not on the value', () => {
    const voice = extractSegments({ url: REF }).find((s) => s.paramName === 'voice')!;
    const text = extractSegments({ url: REF }).find((s) => s.paramName === 'text')!;
    assert.equal(forgeTemplateKey({ method: 'get', url: REF, segment: voice }), forgeTemplateKey({ method: 'GET', url: REF, segment: voice }));
    assert.notEqual(forgeTemplateKey({ method: 'GET', url: REF, segment: voice }), forgeTemplateKey({ method: 'GET', url: REF, segment: text }));
  });
});

describe('ForgeValueSensitivity', () => {
  it('flags a slot where two different values returned the identical response (server fallback)', () => {
    // getpronounce: voice=evelyn and voice=joseph on provider=openai both return the default echo audio
    const t = new ForgeValueSensitivity();
    t.observe({ template: 'T', forgedKey: 'echo-audio', value: 'evelyn' });
    assert.equal(t.isValueInsensitive({ template: 'T', forgedKey: 'echo-audio' }), false);
    t.observe({ template: 'T', forgedKey: 'echo-audio', value: 'joseph' });
    assert.equal(t.isValueInsensitive({ template: 'T', forgedKey: 'echo-audio' }), true);
  });

  it('keeps a value whose response is unique, and does not count the same value twice', () => {
    const t = new ForgeValueSensitivity();
    t.observe({ template: 'T', forgedKey: 'shimmer-audio', value: 'shimmer' });
    t.observe({ template: 'T', forgedKey: 'shimmer-audio', value: 'shimmer' });   // same swap from two nodes
    t.observe({ template: 'T', forgedKey: 'echo-audio', value: 'evelyn' });
    t.observe({ template: 'T', forgedKey: 'echo-audio', value: 'joseph' });
    assert.equal(t.isValueInsensitive({ template: 'T', forgedKey: 'shimmer-audio' }), false);
  });

  it('does not mix slots, and never drops without a body key', () => {
    const t = new ForgeValueSensitivity();
    t.observe({ template: 'A', forgedKey: 'k', value: 'x' });
    t.observe({ template: 'B', forgedKey: 'k', value: 'y' });   // same body, different request: a dedup matter, not fallback
    assert.equal(t.isValueInsensitive({ template: 'A', forgedKey: 'k' }), false);
    t.observe({ template: 'A', forgedKey: undefined, value: 'z' });
    assert.equal(t.isValueInsensitive({ template: 'A', forgedKey: undefined }), false);
  });

  it('drains deferred findings in arrival order and resets', () => {
    const t = new ForgeValueSensitivity();
    const noop = { recordHttp: () => {}, onValueInsensitive: async () => {} };
    t.defer({ template: 'T', forgedKey: 'a', context: '1', ...noop });
    t.defer({ template: 'T', forgedKey: 'b', context: '2', ...noop });
    assert.deepEqual(t.drain().map((f) => f.context), ['1', '2']);
    assert.equal(t.drain().length, 0);
    t.observe({ template: 'T', forgedKey: 'k', value: 'x' });
    t.observe({ template: 'T', forgedKey: 'k', value: 'y' });
    t.reset();
    assert.equal(t.isValueInsensitive({ template: 'T', forgedKey: 'k' }), false);
  });
});

describe('singleSwapPosition', () => {
  it('finds the one differing query param', () => {
    assert.equal(singleSwapPosition({ a: REF, b: REF.replace('voice=shimmer', 'voice=evelyn') }), 'query:voice');
  });
  it('finds the one differing path segment', () => {
    assert.equal(singleSwapPosition({ a: 'https://x.com/api/lesson/42?a=1', b: 'https://x.com/api/lesson/43?a=1' }), 'path:3');
  });
  it('returns null for two differences, a different origin, or a different query beside a path swap', () => {
    assert.equal(singleSwapPosition({ a: REF, b: REF.replace('voice=shimmer', 'voice=evelyn').replace('provider=openai', 'provider=gcp') }), null);
    assert.equal(singleSwapPosition({ a: 'https://x.com/a/1', b: 'https://y.com/a/2' }), null);
    assert.equal(singleSwapPosition({ a: 'https://x.com/a/1?p=1', b: 'https://x.com/a/2?p=2' }), null);
    assert.equal(singleSwapPosition({ a: REF, b: REF + '&extra=1' }), null);
  });
});
