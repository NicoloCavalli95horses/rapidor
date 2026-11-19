import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AuthzClassifier, assessAuthZ } from '../src/analysis/authzClassifier';
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
