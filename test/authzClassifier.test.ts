import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AuthzClassifier, assessAuthZ, assessDirection } from '../src/analysis/authzClassifier';
import { AuthzClassificationStore } from '../src/db/AuthzClassificationStore';
import { compareObj } from '../src/analysis/responseEvaluate';

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'crawler-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

let n = 0;
function newClassifier(): AuthzClassifier {
  const store = new AuthzClassificationStore({ db: new Database(join(root, `${n++}.db`)), clearOnStart: false });
  return new AuthzClassifier(store);
}

// Loads a real embedding model (cached under node_modules/@huggingface/transformers/.cache after
// the first run); slower than the rest of the suite, same tradeoff RAPIDOR's own offscreen
// classifier already accepted.
// No model needed: NON_AUTHZ_TERMS short-circuits before the cache/model, even over a high cached score.
describe('AuthzClassifier: non-authz terms', () => {
  it('never classifies a term containing the word "privacy" as authz-relevant', async () => {
    const classifier = newClassifier();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('privacy', { score: 1, isAuthZRelevant: true });
    for (const term of ['privacy', 'Privacy', 'Privacy settings', 'settings-privacy', 'privacyPolicy']) {
      assert.equal((await classifier.classify(term)).isAuthZRelevant, false, term);
    }
  });
});

describe('AuthzClassifier', { timeout: 120_000 }, () => {
  it('classifies an authorization-relevant key above the threshold', async () => {
    const result = await newClassifier().classify('premium');
    assert.equal(result.isAuthZRelevant, true);
  });

  it('does not classify a neutral key as authorization-relevant', async () => {
    const result = await newClassifier().classify('title');
    assert.equal(result.isAuthZRelevant, false);
  });

  it('caches repeated classifications (same score object identity-equal content on reuse)', async () => {
    const classifier = newClassifier();
    const first = await classifier.classify('role');
    const second = await classifier.classify('role');
    assert.deepEqual(first, second);
  });

  it('persists classifications so a fresh classifier backed by the same store skips recomputing', async () => {
    const db = new Database(join(root, 'shared.db'));
    const first = await new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false })).classify('owner');
    // A fresh classifier backed by the same store returns the persisted result (read back through the
    // public API, not the raw store key, which carries an internal CLASSIFIER_VERSION prefix).
    const again = await new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false })).classify('owner');
    assert.deepEqual(again, first);
  });

  it('assessAuthZ flags a premium/free prop diff as authz-relevant; a cosmetic diff is not', async () => {
    const classifier = newClassifier();

    const premiumDiff = compareObj({ id: 'a', premium: false }, { id: 'b', premium: true });
    const premiumAssessment = await assessAuthZ({ differences: premiumDiff, classifier });
    assert.equal(premiumAssessment.isAuthzRelevant, true);
    assert.ok(premiumAssessment.sensitiveKeys.includes('premium'));

    const cosmeticDiff = compareObj({ title: 'apple' }, { title: 'banana' });
    const cosmeticAssessment = await assessAuthZ({ differences: cosmeticDiff, classifier });
    assert.equal(cosmeticAssessment.isAuthzRelevant, false);
  });

  it('ignores an entitlement-named key whose value is an asset URL, but keeps a string-enum value', async () => {
    const classifier = newClassifier();

    // busuu's course-pack FP: the key reads like an entitlement ("paywall") but its value is a cover
    // image URL — content, not an access flag. Must NOT be authz-relevant.
    const assetDiff = compareObj(
      { course_pack_paywall_1000: 'https://cdn.busuu.com/course-overview/images/fr/complete/medium/fr_complete.jpg' },
      { course_pack_paywall_1000: 'https://cdn.busuu.com/course-overview/images/ja/complete/medium/ja_complete.jpg' },
    );
    const assetAssessment = await assessAuthZ({ differences: assetDiff, classifier });
    assert.equal(assetAssessment.isAuthzRelevant, false);

    // A real string-enum access flag still counts even though the value is a string, not a boolean.
    const tierDiff = compareObj({ tier: 'free' }, { tier: 'premium' });
    const tierAssessment = await assessAuthZ({ differences: tierDiff, classifier });
    assert.equal(tierAssessment.isAuthzRelevant, true);
    assert.ok(tierAssessment.sensitiveKeys.includes('premium'));
  });
});

// No model needed: the NLI polarity cache is pre-seeded with the signs bart-large-mnli gives these terms.
describe('assessDirection', () => {
  const seeded = (): AuthzClassifier => {
    const classifier = newClassifier();
    const polarity = (classifier as unknown as { polarityModel: { cache: Map<string, unknown> } }).polarityModel.cache;
    polarity.set('is free', { polarity: -1, relevance: 1 });
    polarity.set('available', { polarity: -0.91, relevance: 0.92 });
    polarity.set('lock', { polarity: 0.8, relevance: 0.81 });
    polarity.set('provider', { polarity: 0.1, relevance: 0.6 });
    polarity.set('openai', { polarity: -0.2, relevance: 0.3 });
    polarity.set('gcp', { polarity: 1, relevance: 1 });
    polarity.set('tier', { polarity: 0.5, relevance: 0.9 });
    polarity.set('free', { polarity: -1, relevance: 1 });
    polarity.set('premium', { polarity: 1, relevance: 1 });
    return classifier;
  };

  it('a free sibling of a paid reference is LESS restricted (getpronounce shimmer -> daniel)', async () => {
    const differences = compareObj(
      { isFree: false, available: false, provider: 'openai', name: 'Emma' },
      { isFree: true, available: true, provider: 'gcp', name: 'Daniel' },
    );
    const result = await assessDirection({ authz: { differences, sensitiveKeys: ['isFree', 'available', 'provider', 'gcp'] }, classifier: seeded() });
    assert.equal(result.lessRestricted, true, result.evidence.join(' '));
  });

  it('a paid sibling of a free reference is MORE restricted (kept): flag, missing flag and string enum', async () => {
    const classifier = seeded();
    for (const [ref, cand, keys] of [
      [{ lock: false }, { lock: true }, ['lock']],                 // ejoy
      [{ isFree: true }, { isFree: undefined }, ['isFree']],       // pimsleur: the paid sibling lacks the flag
      [{ tier: 'free' }, { tier: 'premium' }, ['tier', 'premium']],
    ] as const) {
      const result = await assessDirection({ authz: { differences: compareObj(ref, cand), sensitiveKeys: [...keys] }, classifier });
      assert.equal(result.lessRestricted, false, JSON.stringify(ref));
      assert.ok(result.delta > 0, JSON.stringify(ref));
    }
  });

  it('casts no vote without evidence: non-sensitive diffs and falsy->falsy flags keep the candidate', async () => {
    const classifier = seeded();
    // isFree is in the diff but not a sensitive key -> ignored; available null -> 0 is no switch (lingualeo)
    const differences = compareObj({ isFree: false, available: null }, { isFree: true, available: 0 });
    const result = await assessDirection({ authz: { differences, sensitiveKeys: ['available'] }, classifier });
    assert.deepEqual([result.delta, result.lessRestricted], [0, false]);
  });
});

// Loads the real NLI model (Xenova/bart-large-mnli, ~400 MB on the first run): the sign must follow the
// term's MEANING, which the MiniLM similarity could not separate (locked vs unlocked).
describe('AuthzClassifier.polarity (real NLI model)', () => {
  it('restricting terms are positive, granting terms negative, neutral terms barely relevant', async () => {
    const classifier = newClassifier();
    for (const term of ['lock', 'isLocked', 'premium', 'paywall', 'requiresSubscription']) assert.ok((await classifier.polarity(term)).polarity > 0.5, term);
    for (const term of ['free', 'isFree', 'unlocked', 'isLessonUnlocked', 'available']) assert.ok((await classifier.polarity(term)).polarity < -0.5, term);
    for (const term of ['id', 'title', 'voiceId', 'featured']) assert.ok((await classifier.polarity(term)).relevance < 0.5, term);
  });
});
