import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PreindexedValueStore } from '../src/db/PreindexedValueStore';
import { ReactStateStore, type RapidorGraph } from '../src/db/ReactStateStore';
import { CandidateGenerator, tokenizeParamName, paramNameBlacklisted, isLocaleParam, isTrackingParam, sameIdShape } from '../src/analysis/candidateGenerator';

describe('sameIdShape (an identifier slot keeps its type)', () => {
  it("treats a React number 1 and a string '1' alike (both numeric, compared as strings)", () => {
    assert.equal(sameIdShape({ original: '1', replacement: String(1) }), true);
    assert.equal(sameIdShape({ original: '73', replacement: String(76) }), true);
  });

  it('rejects numeric <-> non-numeric swaps (duolingo relative_domains=1 -> privacy, promova 73 -> profile)', () => {
    assert.equal(sameIdShape({ original: '1', replacement: 'privacy' }), false);
    assert.equal(sameIdShape({ original: '73', replacement: 'profile' }), false);
    assert.equal(sameIdShape({ original: 'account', replacement: '42' }), false);
  });

  it('keeps word <-> word swaps (slugs, prefixed ids) and ignores surrounding whitespace', () => {
    assert.equal(sameIdShape({ original: 'deriva-genetica', replacement: 'albrecht-durer' }), true);
    assert.equal(sameIdShape({ original: 'objective_a1b2', replacement: 'objective_c3d4' }), true);
    assert.equal(sameIdShape({ original: ' 12 ', replacement: '13' }), true);
  });
});

describe('paramNameBlacklisted (tokenized)', () => {
  const blacklist = ['limit', 'offset', 'page', 'size', 'max', 'min', 'order'];
  it('tokenizes across camelCase / snake / kebab / digit boundaries', () => {
    assert.deepEqual(tokenizeParamName('maxLevel'), ['max', 'level']);
    assert.deepEqual(tokenizeParamName('max_level'), ['max', 'level']);
    assert.deepEqual(tokenizeParamName('pageSize2'), ['page', 'size', '2']);
  });
  it('drops a param whose name equals OR contains a blacklisted token', () => {
    assert.equal(paramNameBlacklisted({ name: 'limit', blacklist }), true);      // exact
    assert.equal(paramNameBlacklisted({ name: 'maxLevel', blacklist }), true);   // token "max"
    assert.equal(paramNameBlacklisted({ name: 'minScore', blacklist }), true);   // token "min"
    assert.equal(paramNameBlacklisted({ name: 'pageSize', blacklist }), true);   // token "page"/"size"
  });
  it('keeps a param with no blacklisted token (a real reference)', () => {
    assert.equal(paramNameBlacklisted({ name: 'id', blacklist }), false);
    assert.equal(paramNameBlacklisted({ name: 'lessonId', blacklist }), false);
    assert.equal(paramNameBlacklisted({ name: 'courseId', blacklist }), false);
  });
});

describe('isLocaleParam (locale / UI-language selectors)', () => {
  it('matches the locale family (representation, not owner — Mondly mother_language)', () => {
    for (const name of ['locale', 'lang', 'lng', 'language', 'mother_language', 'ui_language',
      'interface_language', 'mother_tongue', 'appLanguage', 'langcode']) {
      assert.equal(isLocaleParam({ name }), true, name);
    }
  });
  it('KEEPS learning-target / resource params mutable (language apps — a real TP must survive)', () => {
    for (const name of ['target_language', 'learning_language', 'source_language',
      'course_language', 'to_language', 'language_id', 'languageId', 'lang_level']) {
      assert.equal(isLocaleParam({ name }), false, name);
    }
  });
});

describe('isTrackingParam (marketing / attribution params)', () => {
  it('matches the tracking family (provenance, not owner — lingualeo refclmark FP)', () => {
    for (const name of ['refclmark', 'utm_source', 'utm_medium', 'utm_campaign', 'campaignId',
      'campaign_id', 'gclid', 'fbclid', 'msclkid', 'yclid', 'mc_eid']) {
      assert.equal(isTrackingParam({ name }), true, name);
    }
  });
  it('KEEPS resource params that merely contain a tracking word mutable (a real TP must survive)', () => {
    for (const name of ['id', 'price_id', 'objectiveId', 'refId', 'campaign_name',
      'target_language', 'preference_id']) {
      assert.equal(isTrackingParam({ name }), false, name);
    }
  });
});

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
function newGenerator({ graph, url, maxSegmentMatches = 300, segmentBlacklist = [] as string[], paramBlacklist = [] as string[] }: {
  graph: RapidorGraph; url: string; maxSegmentMatches?: number; segmentBlacklist?: string[]; paramBlacklist?: string[];
}) {
  const db = new Database(join(root, `${n++}.db`));
  const preindexStore = new PreindexedValueStore({ db, clearOnStart: true });
  const reactStateStore = new ReactStateStore({ db, clearOnStart: true });
  const stateId = reactStateStore.record({ site: SITE, url, graph });
  assert.ok(stateId !== undefined, 'the fixture state should be recorded');
  preindexStore.reindex({ stateId, graph });
  return new CandidateGenerator({ preindexStore, reactStateStore, maxSegmentMatches, segmentBlacklist, paramBlacklist });
}

describe('CandidateGenerator', () => {
  it('proposes the sibling value for a URL segment that is in the preindex', () => {
    const url = `https://${SITE}/users/101/profile`;
    const gen = newGenerator({ graph: graphWith({ a: '101', b: '102' }), url });

    const { items } = gen.findUrlCandidates({ url, site: SITE });

    assert.deepEqual(items.map((i) => i.candidate.candidateValue), ['102']);
    assert.equal(items[0].segment.value, '101');
  });

  it('never mutates a blacklisted segment (app-shell prefix, not an identifier)', () => {
    const url = `https://${SITE}/app/101`;
    const gen = newGenerator({ graph: graphWith({ a: 'app', b: 'speak', key: 'name' }), url, segmentBlacklist: ['app'] });

    const { items } = gen.findUrlCandidates({ url, site: SITE });

    // `app` is in the preindex and would otherwise be swapped for its sibling `speak`.
    assert.deepEqual(items, []);
  });

  it('never swaps a segment INTO a blacklisted value (the blacklist is bidirectional)', () => {
    const url = `https://${SITE}/speak/101`;
    const gen = newGenerator({ graph: graphWith({ a: 'speak', b: 'app', key: 'name' }), url, segmentBlacklist: ['app'] });

    const { items } = gen.findUrlCandidates({ url, site: SITE });

    // the source segment `speak` is allowed, but its only replacement value is blacklisted
    assert.deepEqual(items, []);
  });

  it('never mutates a blacklisted QUERY PARAM (a pagination control, not an object reference)', () => {
    // busuu's case: ?limit=<n> looked the bare value up in the preindex and forged unrelated ids.
    const url = `https://${SITE}/notifications?include_voice=1&limit=50`;
    const graph = graphWith({ a: '50', b: '12538' });

    // the candidate exists and IS proposed without the blacklist — so the assertion below is meaningful
    assert.deepEqual(
      newGenerator({ graph, url }).findUrlCandidates({ url, site: SITE }).items.map((i) => i.candidate.candidateValue),
      ['12538'],
    );
    assert.deepEqual(newGenerator({ graph, url, paramBlacklist: ['limit'] }).findUrlCandidates({ url, site: SITE }).items, []);
  });

  it('gates the query param by NAME only — a path segment of the same name is still mutated', () => {
    const url = `https://${SITE}/limit/50`;
    const gen = newGenerator({ graph: graphWith({ a: '50', b: '60' }), url, paramBlacklist: ['limit'] });

    const { items } = gen.findUrlCandidates({ url, site: SITE });

    assert.deepEqual(items.map((i) => i.candidate.candidateValue), ['60']);
  });

  it('skips a segment whose value appears in more preindexed nodes than maxSegmentMatches', () => {
    const url = `https://${SITE}/users/101/profile`;
    const gen = newGenerator({ graph: graphWith({ a: '101', b: '102' }), url, maxSegmentMatches: 0 });

    const { items, matches } = gen.findUrlCandidates({ url, site: SITE });

    assert.deepEqual(items, []);
    assert.equal(matches, 0, 'an over-cap segment is dropped before any match is fetched');
  });

  it('reset() drops the per-run graph cache without changing what is proposed', () => {
    const url = `https://${SITE}/users/101/profile`;
    const gen = newGenerator({ graph: graphWith({ a: '101', b: '102' }), url });

    const before = gen.findUrlCandidates({ url, site: SITE }).items.map((i) => i.candidate.candidateValue);
    gen.reset();
    const after = gen.findUrlCandidates({ url, site: SITE }).items.map((i) => i.candidate.candidateValue);

    assert.deepEqual(after, before);
    assert.deepEqual(after, ['102']);
  });

  it('swaps only the URL segment whose token the siblings differ at (positional match)', () => {
    // mangolanguages: lesson links /fr/485/1/1/<n> on a page /fr/485/1/1; `485` must not become a lesson number
    const graph: RapidorGraph = {
      fingerprint: 'f-mango',
      nodes: {
        'node-1': { id: 'node-1', componentId: 1, props: { url: '/pathway/fr/485/1/1/1' } },
        'node-2': { id: 'node-2', componentId: 1, props: { url: '/pathway/fr/485/1/1/4' } },
      },
      componentIndex: { '1': ['node-1', 'node-2'] },
    };
    const url = `https://${SITE}/pathway/fr/485/1/1`;
    const gen = newGenerator({ graph, url });

    const { items } = gen.findUrlCandidates({ url, site: SITE });

    assert.ok(items.every((i) => i.segment.value === '1'), 'only the `1` segments are swapped, never 485');
    assert.deepEqual(items.map((i) => i.segment.indexFromRight).sort(), [0, 1]);
    assert.ok(items.every((i) => i.candidate.candidateValue === '4'));
  });

  it('reuses a value\'s expansion for a repeated segment, with the same counters as before', () => {
    const graph: RapidorGraph = {
      fingerprint: 'f-rep',
      nodes: {
        'node-1': { id: 'node-1', componentId: 1, props: { id: 1 } },   // numbers: 1-char strings are not indexed
        'node-2': { id: 'node-2', componentId: 1, props: { id: 2 } },
      },
      componentIndex: { '1': ['node-1', 'node-2'] },
    };
    const url = `https://${SITE}/lesson/1/7/1`;
    const gen = newGenerator({ graph, url });

    const first = gen.findUrlCandidates({ url, site: SITE });
    const again = gen.findUrlCandidates({ url, site: SITE });

    // both `1` segments get their own item (distinct swap positions), from one shared expansion
    assert.deepEqual(first.items.map((i) => i.segment.indexFromRight).sort(), [0, 2]);
    assert.equal(first.matches, 2);   // one preindex row, counted once per `1` segment
    assert.deepEqual({ ...again, items: again.items.length }, { ...first, items: first.items.length });
  });

  it('proposes the same candidates when the graph LRU evicts (bounded cache), re-parsing evicted graphs', () => {
    const db = new Database(join(root, `${n++}.db`));
    const preindexStore = new PreindexedValueStore({ db, clearOnStart: true });
    const reactStateStore = new ReactStateStore({ db, clearOnStart: true });
    const values = ['101', '201', '301'];
    for (const v of values) {
      // per-state siblings (v, v+1) plus a component shared by every state (900, 901)
      const graph: RapidorGraph = {
        fingerprint: `f-${v}`,
        nodes: {
          a: { id: 'a', componentId: 1, props: { id: v } }, b: { id: 'b', componentId: 1, props: { id: String(Number(v) + 1) } },
          c: { id: 'c', componentId: 2, props: { id: '900' } }, d: { id: 'd', componentId: 2, props: { id: '901' } },
        },
        componentIndex: { '1': ['a', 'b'], '2': ['c', 'd'] },
      };
      const stateId = reactStateStore.record({ site: SITE, url: `https://${SITE}/users/${v}/profile`, graph })!;
      preindexStore.reindex({ stateId, graph });
    }
    const urls = [...values.map((v) => `https://${SITE}/users/${v}/profile`), `https://${SITE}/items/900`];
    const deps = { preindexStore, reactStateStore, maxSegmentMatches: 300, segmentBlacklist: [], paramBlacklist: [] };
    const run = (gen: CandidateGenerator) => urls.map((url) => gen.findUrlCandidates({ url, site: SITE }).items.map((i) => i.candidate.candidateValue));
    const unbounded = new CandidateGenerator(deps);
    const tiny = new CandidateGenerator({ ...deps, graphCacheMaxBytes: 1 });   // keeps only the latest graph

    assert.deepEqual(run(tiny), run(unbounded));
    assert.deepEqual(run(unbounded).at(-1), ['901', '901', '901']);
    assert.equal(unbounded.graphLoadCount, 3);   // each state parsed once
    assert.equal(tiny.graphLoadCount, 6);        // `900` revisits all 3 states, each evicted by the next one
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
