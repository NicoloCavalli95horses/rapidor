import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { SessionAuthStore } from '../src/db/SessionAuthStore';

test('SessionAuthStore: round-trips an override, overwrites per site, and clears', () => {
  const store = new SessionAuthStore({ db: new Database(':memory:') });
  assert.equal(store.get({ site: 'x.test' }), undefined);

  store.set({ site: 'x.test', override: { stripCookie: true, freshHeaders: { authorization: 'Bearer a' } } });
  assert.deepEqual(store.get({ site: 'x.test' }), { stripCookie: true, freshHeaders: { authorization: 'Bearer a' } });

  // one row per site: a second set overwrites
  store.set({ site: 'x.test', override: { stripCookie: false, freshHeaders: {} } });
  assert.deepEqual(store.get({ site: 'x.test' }), { stripCookie: false, freshHeaders: {} });

  store.clear({ site: 'x.test' });
  assert.equal(store.get({ site: 'x.test' }), undefined);
});
