import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PreindexedValueStore } from '../src/db/PreindexedValueStore';
import { ReactStateStore, type RapidorGraph } from '../src/db/ReactStateStore';
import { CandidateGenerator } from '../src/analysis/candidateGenerator';

// CandidateGenerator is the pure (no browser, no network) half of the analysis, so these run in
// milliseconds against real SQLite stores — the point of extracting it out of AnalysisPipeline, whose
// own suite needs a real Chromium.

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'candgen-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

const SITE = 'app.test';

/** Two instances of the same component differing only at `path`: exactly what matchFinder pairs up. */
function graphWith({ a, b, key = 'id' }: { a: string; b: string; key?: string }): RapidorGraph {
  return {
    fingerprint: `f-${a}-${b}`,
    nodes: {
      'node-1': { id: 'node-1', componentId: 1, props: { [key]: a } },
      'node-2': { id: 'node-2', componentId: 1, props: { [key]: b } },
    },
    componentIndex: { '1': ['node-1', 'node-2'] },
  };
}

let n = 0;
function newGenerator({ graph, url, maxSegmentMatches = 300, segmentBlacklist = [] as string[] }: {
  graph: RapidorGraph; url: string; maxSegmentMatches?: number; segmentBlacklist?: string[];
}) {
  const db = new Database(join(root, `${n++}.db`));
  const preindexStore = new PreindexedValueStore({ db, clearOnStart: true });
  const reactStateStore = new ReactStateStore({ db, clearOnStart: true });
  const stateId = reactStateStore.record({ site: SITE, url, graph });
  assert.ok(stateId !== undefined, 'the fixture state should be recorded');
  preindexStore.reindex({ stateId, graph });
  return new CandidateGenerator({ preindexStore, reactStateStore, maxSegmentMatches, segmentBlacklist });
}

describe('CandidateGenerator', () => {
  it('proposes the sibling value for a URL segment that is in the preindex', () => {
    const url = `https://${SITE}/users/101/profile`;
    const gen = newGenerator({ graph: graphWith({ a: '101', b: '102' }), url });

    const { items } = gen.findUrlCandidates({ url });

    assert.deepEqual(items.map((i) => i.candidate.candidateValue), ['102']);
    assert.equal(items[0].segment.value, '101');
  });

  it('never mutates a blacklisted segment (app-shell prefix, not an identifier)', () => {
    const url = `https://${SITE}/app/101`;
    const gen = newGenerator({ graph: graphWith({ a: 'app', b: 'speak', key: 'name' }), url, segmentBlacklist: ['app'] });

    const { items } = gen.findUrlCandidates({ url });

    // `app` is in the preindex and would otherwise be swapped for its sibling `speak`.
    assert.deepEqual(items, []);
  });

  it('never swaps a segment INTO a blacklisted value (the blacklist is bidirectional)', () => {
    const url = `https://${SITE}/speak/101`;
    const gen = newGenerator({ graph: graphWith({ a: 'speak', b: 'app', key: 'name' }), url, segmentBlacklist: ['app'] });

    const { items } = gen.findUrlCandidates({ url });

    // the source segment `speak` is allowed, but its only replacement value is blacklisted
    assert.deepEqual(items, []);
  });

  it('skips a segment whose value appears in more preindexed nodes than maxSegmentMatches', () => {
    const url = `https://${SITE}/users/101/profile`;
    const gen = newGenerator({ graph: graphWith({ a: '101', b: '102' }), url, maxSegmentMatches: 0 });

    const { items, matches } = gen.findUrlCandidates({ url });

    assert.deepEqual(items, []);
    assert.equal(matches, 0, 'an over-cap segment is dropped before any match is fetched');
  });

  it('reset() drops the per-run graph cache without changing what is proposed', () => {
    const url = `https://${SITE}/users/101/profile`;
    const gen = newGenerator({ graph: graphWith({ a: '101', b: '102' }), url });

    const before = gen.findUrlCandidates({ url }).items.map((i) => i.candidate.candidateValue);
    gen.reset();
    const after = gen.findUrlCandidates({ url }).items.map((i) => i.candidate.candidateValue);

    assert.deepEqual(after, before);
    assert.deepEqual(after, ['102']);
  });

  it('warns for a crawled URL that has no captured React state', () => {
    const url = `https://${SITE}/users/101/profile`;
    const gen = newGenerator({ graph: graphWith({ a: '101', b: '102' }), url });

    // pure logging: the contract is that it never throws and never rejects the run
    assert.doesNotThrow(() => gen.warnOnMissingReactStateCoverage({
      site: SITE,
      crawledStates: [{ url }, { url: `https://${SITE}/uncaptured` }],
      pageUrls: [url],
    }));
  });
});
