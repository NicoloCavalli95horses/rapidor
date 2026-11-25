import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { authzGateVerdict } from '../src/analysis/httpGuards';
import { AuthzClassifier } from '../src/analysis/authzClassifier';
import { AuthzClassificationStore } from '../src/db/AuthzClassificationStore';

/** A classifier whose verdicts are pre-seeded (normalized terms), so the embedding model never loads. */
function classifierWith({ relevant, irrelevant }: { relevant: string[]; irrelevant: string[] }): AuthzClassifier {
  const classifier = new AuthzClassifier(new AuthzClassificationStore({ db: new Database(':memory:'), clearOnStart: true }));
  const cache = (classifier as unknown as { cache: Map<string, unknown> }).cache;
  for (const t of relevant) cache.set(t, { score: 1, isAuthZRelevant: true });
  for (const t of irrelevant) cache.set(t, { score: 0, isAuthZRelevant: false });
  return classifier;
}

describe('authzGateVerdict — value-only signal vs equal entitlement key', () => {
  it('rejects a verdict resting only on a value when an entitlement key is equal on both sides (promova free_talk)', async () => {
    const classifier = classifierWith({ relevant: ['free talk', 'free'], irrelevant: ['conversation', 'id', 'tags'] });
    const verdict = await authzGateVerdict({
      referenceProps: { id: 999, free: false, tags: ['free_talk'] },
      candidateProps: { id: 5, free: false, tags: ['conversation'] },
      swapPath: ['props', 'id'], classifier,
    });
    assert.ok(verdict.reject?.includes('free=false'), String(verdict.reject));
  });

  it('keeps a key-name hit even when another entitlement key is equal (ejoy: lock changes, unit lock does not)', async () => {
    const classifier = classifierWith({ relevant: ['lock', 'unit lock'], irrelevant: ['id'] });
    const verdict = await authzGateVerdict({
      referenceProps: { id: 1030, lock: false, unitLock: false },
      candidateProps: { id: 1032, lock: true, unitLock: false },
      swapPath: ['props', 'id'], classifier,
    });
    assert.equal(verdict.reject, undefined);
    assert.deepEqual(verdict.authz?.nameKeys, ['lock']);
  });

  it('keeps a value-only verdict when no entitlement key contradicts it (string enum)', async () => {
    const classifier = classifierWith({ relevant: ['premium'], irrelevant: ['basic', 'tier', 'id'] });
    const verdict = await authzGateVerdict({
      referenceProps: { id: 1, tier: 'basic' },
      candidateProps: { id: 2, tier: 'premium' },
      swapPath: ['props', 'id'], classifier,
    });
    assert.equal(verdict.reject, undefined);
  });
});
