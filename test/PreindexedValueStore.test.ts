import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PreindexedValueStore } from '../src/db/PreindexedValueStore';
import { ReactStateStore, type RapidorGraph } from '../src/db/ReactStateStore';

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'crawler-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

const SITE = 's.test';

/** A fresh db with both stores and one react_states row for SITE, holding `graph`, already reindexed. */
function setup(name: string, graphArg: RapidorGraph = graph): { store: PreindexedValueStore; states: ReactStateStore; stateId: number } {
  const db = new Database(join(root, name));
  const states = new ReactStateStore({ db, clearOnStart: false });
  const store = new PreindexedValueStore({ db, clearOnStart: false });
  const stateId = states.record({ site: SITE, url: `https://${SITE}/x`, graph: graphArg })!;
  store.reindex({ stateId, graph: graphArg });
  return { store, states, stateId };
}

const graph: RapidorGraph = {
  fingerprint: 'f',
  nodes: {
    'node-1': { id: 'node-1', componentId: 1, props: { id: 'free-id', title: 'ok' } },
    'node-2': { id: 'node-2', componentId: 1, props: { id: 'premium-id' } },
  },
};

describe('PreindexedValueStore', () => {
  it('reindex() populates rows findable by exact token value (scoped to the site)', () => {
    const { store, stateId } = setup('a.db');

    assert.deepEqual(store.findByValue({ value: 'free-id', site: SITE }), [{ stateId, nodeId: 'node-1', path: ['props', 'id'], depth: 2 }]);
    assert.deepEqual(store.findByValue({ value: 'premium-id', site: SITE }), [{ stateId, nodeId: 'node-2', path: ['props', 'id'], depth: 2 }]);
    assert.equal(store.findByValue({ value: 'no-such-value', site: SITE }).length, 0);
    assert.equal(store.count(), 3); // free-id, premium-id, 'ok' (title)
  });

  it('findByValue / countByValue are SCOPED to the site (no cross-site contamination)', () => {
    // The real bug: celpipsimulator's `/blog` segment matched babbel's footer `blog` link because the DB
    // holds both sites and the lookup was unscoped. Two sites, the SAME value, must not leak into each other.
    const db = new Database(join(root, 'scope.db'));
    const states = new ReactStateStore({ db, clearOnStart: false });
    const store = new PreindexedValueStore({ db, clearOnStart: false });
    const a = states.record({ site: 'a.test', url: 'https://a.test/x', graph })!;
    states.record({ site: 'b.test', url: 'https://b.test/x', graph });
    store.reindex({ stateId: a, graph });
    store.reindex({ stateId: states.record({ site: 'b.test', url: 'https://b.test/x', graph })!, graph });

    assert.deepEqual(store.findByValue({ value: 'free-id', site: 'a.test' }).map((m) => m.stateId), [a]);
    assert.equal(store.countByValue({ value: 'free-id', site: 'a.test' }), 1);          // not 2
    assert.equal(store.findByValue({ value: 'free-id', site: 'c.test' }).length, 0);     // a site with no rows
  });

  it('reindex() on the same stateId replaces its rows instead of accumulating', () => {
    const { store, states, stateId } = setup('b.db');
    store.reindex({ stateId, graph: { fingerprint: 'g', nodes: { 'node-1': { id: 'node-1', props: { id: 'only-id' } } } } });
    void states;

    assert.deepEqual(store.findByValue({ value: 'free-id', site: SITE }), []);
    assert.deepEqual(store.findByValue({ value: 'only-id', site: SITE }), [{ stateId, nodeId: 'node-1', path: ['props', 'id'], depth: 2 }]);
  });

  it('rows from different states of the same site coexist', () => {
    const { store, states, stateId } = setup('c.db');
    const state2 = states.record({ site: SITE, url: `https://${SITE}/y`, graph: { fingerprint: 'g', nodes: { 'node-9': { id: 'node-9', props: { id: 'free-id' } } } } })!;
    store.reindex({ stateId: state2, graph: { fingerprint: 'g', nodes: { 'node-9': { id: 'node-9', props: { id: 'free-id' } } } } });

    const matches = store.findByValue({ value: 'free-id', site: SITE });
    assert.deepEqual(matches.map((m) => m.stateId).sort((x, y) => x - y), [stateId, state2].sort((x, y) => x - y));
  });

  it('clearOnStart wipes rows left by a previous run', () => {
    const path = join(root, 'd.db');
    const db = new Database(path);
    new PreindexedValueStore({ db, clearOnStart: false }).reindex({ stateId: 1, graph });
    assert.equal(new PreindexedValueStore({ db, clearOnStart: false }).count(), 3);

    assert.equal(new PreindexedValueStore({ db, clearOnStart: true }).count(), 0);
  });

  it('clearSite removes only the rows whose state belongs to that domain', () => {
    const db = new Database(join(root, 'e.db'));
    const states = new ReactStateStore({ db, clearOnStart: false });
    const preindex = new PreindexedValueStore({ db, clearOnStart: false });

    const stateA = states.record({ site: 'a.test', url: 'https://a.test/x', graph })!;
    const stateB = states.record({ site: 'b.test', url: 'https://b.test/x', graph })!;
    preindex.reindex({ stateId: stateA, graph });
    preindex.reindex({ stateId: stateB, graph });

    preindex.clearSite({ site: 'a.test' });

    assert.deepEqual(preindex.findByValue({ value: 'free-id', site: 'a.test' }).map((m) => m.stateId), []);       // cleared
    assert.deepEqual(preindex.findByValue({ value: 'free-id', site: 'b.test' }).map((m) => m.stateId), [stateB]); // untouched
  });
});
