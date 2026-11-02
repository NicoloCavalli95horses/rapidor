//===================
// Import
//===================
import { StateManager } from '../modules/state/stateManager.js';
import { IDBManager } from '../modules/state/indexedDB.js';
import { eventBus, events } from '../utils/eventBus.js';
import { metrics, metricKeys } from '../utils/utils.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
// handleUpdate() is the single state/HTTP save path. It must not double-count or announce a save
// when a concurrent tab already stored the same fingerprint (saveState resolves null on a
// unique-constraint duplicate). A real IndexedDB is not available under Node, so the db layer is
// faked to return the save outcomes handleUpdate has to react to.
describe('StateManager.handleUpdate (duplicate handling)', function () {
  function makeManager({ isStored = false, saveResult }) {
    const sm = new StateManager();
    sm.db = {
      isDataStored: async () => isStored,
      saveState: async () => saveResult,   // {key} on save, null on unique-constraint duplicate
    };
    return sm;
  }

  const stateEvent = () => ({ type: events.STATE_UPDATE, payload: { fingerprint: 'fp-1', nodes: {} } });

  function collectDbSuccess(fn) {
    const seen = [];
    const sub = eventBus.subscribe((e) => { if (e.type === events.DB_SUCCESS) seen.push(e); });
    return fn().finally(() => sub.unsubscribe()).then(() => seen);
  }

  it('saves a new state: DB_SUCCESS emitted, counted as saved', async function () {
    const sm = makeManager({ isStored: false, saveResult: { key: 7, storeName: 'state' } });
    const saved0 = metrics[metricKeys.STATES_SAVED] ?? 0;

    let result;
    const dbSuccess = await collectDbSuccess(async () => {
      result = await sm.handleUpdate(stateEvent(), IDBManager.STORES.STATE);
    });

    assert.deepEqual(result, { key: 7, storeName: 'state' });
    assert.equal(dbSuccess.length, 1);
    assert.equal((metrics[metricKeys.STATES_SAVED] ?? 0) - saved0, 1);
  });

  it('treats a unique-constraint duplicate (null) as skipped: no DB_SUCCESS, counted as skipped', async function () {
    const sm = makeManager({ isStored: false, saveResult: null });   // another tab won the race
    const skipped0 = metrics[metricKeys.STATES_SKIPPED_DUPLICATE] ?? 0;
    const saved0 = metrics[metricKeys.STATES_SAVED] ?? 0;

    let result;
    const dbSuccess = await collectDbSuccess(async () => {
      result = await sm.handleUpdate(stateEvent(), IDBManager.STORES.STATE);
    });

    assert.equal(result, null);
    assert.equal(dbSuccess.length, 0, 'no DB_SUCCESS for a duplicate');
    assert.equal((metrics[metricKeys.STATES_SKIPPED_DUPLICATE] ?? 0) - skipped0, 1);
    assert.equal((metrics[metricKeys.STATES_SAVED] ?? 0) - saved0, 0);
  });

  it('skips immediately when the fingerprint is already stored (no save attempted)', async function () {
    let saveCalled = false;
    const sm = makeManager({ isStored: true });
    sm.db.saveState = async () => { saveCalled = true; return { key: 1 }; };

    const result = await sm.handleUpdate(stateEvent(), IDBManager.STORES.STATE);

    assert.equal(result, false);
    assert.equal(saveCalled, false);
  });
});
