import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { Page } from 'playwright';
import { RunMetadataStore, type RunMetadataRow } from '../src/db/RunMetadataStore';
import { RunMetadataHooks, runConfigSnapshot } from '../src/browser/RunMetadataHooks';
import { config, type CrawlConfig } from '../src/config';

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'runmeta-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

let n = 0;
const newStore = () => new RunMetadataStore({ db: new Database(join(root, `${n++}.db`)), clearOnStart: false });
const page = {} as Page;

const row = (site: string, stopReason: RunMetadataRow['stopReason'] = 'completed'): RunMetadataRow => ({
  site, startUrl: `https://${site}/`, startedAt: '2026-11-24T10:00:00.000Z', endedAt: '2026-11-24T10:45:00.000Z',
  explorationMs: 2_700_000, stopReason, config: '{}',
});

describe('RunMetadataStore', () => {
  it('keeps one row per site: a re-crawl replaces it, clearSite removes only that site', () => {
    const store = newStore();
    store.record(row('a.test'));
    store.record(row('b.test'));
    store.record(row('a.test', 'max-duration'));
    assert.equal(store.get({ site: 'a.test' })?.stopReason, 'max-duration');
    store.clearSite({ site: 'a.test' });
    assert.equal(store.get({ site: 'a.test' }), undefined);
    assert.equal(store.get({ site: 'b.test' })?.site, 'b.test');
  });
});

describe('runConfigSnapshot', () => {
  it('is the effective config minus the local profile path and the site list', () => {
    const cfg: CrawlConfig = { ...config, userDataDir: '/home/someone/profile', startUrl: 'https://x/', startUrls: ['https://y/'] };
    const snap = JSON.parse(runConfigSnapshot(cfg));
    assert.equal(snap.maxDepth, cfg.maxDepth);
    assert.deepEqual(snap.ignoreClickablesWithin, cfg.ignoreClickablesWithin);
    assert.equal(snap.analysis.maxSegmentMatches, cfg.analysis.maxSegmentMatches);
    for (const k of ['userDataDir', 'startUrl', 'startUrls']) assert.equal(k in snap, false, k);
  });
});

describe('RunMetadataHooks', () => {
  it('writes the row at onEnd with timing, stop reason and config (no code revision: anonymous review)', async () => {
    const store = newStore();
    const hooks = new RunMetadataHooks(store, { site: 'app.test', startUrl: 'https://app.test/', config });
    await hooks.onStart();
    await hooks.onEnd(page, 1234, 'max-states');
    const got = store.get({ site: 'app.test' })!;
    assert.equal(got.explorationMs, 1234);
    assert.equal(got.stopReason, 'max-states');
    assert.equal(got.startUrl, 'https://app.test/');
    assert.ok(Date.parse(got.endedAt) >= Date.parse(got.startedAt));
    assert.equal(JSON.parse(got.config).maxDepth, config.maxDepth);
  });

  it('never throws when the store fails (the analysis must still run)', async () => {
    const broken = { record: () => { throw new Error('disk full'); } } as unknown as RunMetadataStore;
    const hooks = new RunMetadataHooks(broken, { site: 'app.test', startUrl: 'https://app.test/', config });
    await assert.doesNotReject(hooks.onEnd(page, 1, 'completed'));
  });
});
