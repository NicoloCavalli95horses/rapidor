import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AuthzClassificationStore } from '../src/db/AuthzClassificationStore';

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'crawler-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

function newStore(name: string, clearOnStart = false): AuthzClassificationStore {
  return new AuthzClassificationStore({ db: new Database(join(root, name)), clearOnStart });
}

describe('AuthzClassificationStore', () => {
  it('persists entitlement polarities in their own table, wiped by the same clearOnStart', () => {
    const path = join(root, 'polarity.db');
    const db = new Database(path);
    const store = new AuthzClassificationStore({ db, clearOnStart: false });
    assert.equal(store.getPolarity('1:lock'), undefined);
    store.setPolarity('1:lock', { polarity: 0.8, relevance: 0.81 });
    assert.deepEqual(new AuthzClassificationStore({ db, clearOnStart: false }).getPolarity('1:lock'), { polarity: 0.8, relevance: 0.81 });
    assert.equal(new AuthzClassificationStore({ db, clearOnStart: true }).getPolarity('1:lock'), undefined);
  });

  it('is empty for an unseen key, then returns what was set', () => {
    const store = newStore('a.db');
    assert.equal(store.get('premium'), undefined);

    store.set('premium', { score: 0.5, isAuthZRelevant: true });
    assert.deepEqual(store.get('premium'), { score: 0.5, isAuthZRelevant: true });
    assert.equal(store.count(), 1);
  });

  it('set() on an existing key overwrites it', () => {
    const store = newStore('b.db');
    store.set('role', { score: 0.1, isAuthZRelevant: false });
    store.set('role', { score: 0.9, isAuthZRelevant: true });
    assert.deepEqual(store.get('role'), { score: 0.9, isAuthZRelevant: true });
    assert.equal(store.count(), 1);
  });

  it('clearOnStart is false by default: classifications survive across "runs" (same file, new instance)', () => {
    const path = join(root, 'c.db');
    const db = new Database(path);
    new AuthzClassificationStore({ db, clearOnStart: false }).set('owner', { score: 0.6, isAuthZRelevant: true });

    const reopened = new AuthzClassificationStore({ db, clearOnStart: false });
    assert.deepEqual(reopened.get('owner'), { score: 0.6, isAuthZRelevant: true });
  });

  it('only wipes when clearOnStart is explicitly true', () => {
    const path = join(root, 'd.db');
    const db = new Database(path);
    new AuthzClassificationStore({ db, clearOnStart: false }).set('owner', { score: 0.6, isAuthZRelevant: true });

    assert.equal(new AuthzClassificationStore({ db, clearOnStart: true }).count(), 0);
  });
});
