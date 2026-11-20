import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEntryPointFresh } from '../src/analysis/authFreshness';
import type { ReactStateStore } from '../src/db/ReactStateStore';
import { useBrowser } from './helpers/browser';

const browser = useBrowser();

// A ReactStateStore that only answers the one query the gate makes: the seed fingerprints for the entry URL.
const fakeStore = (fingerprints: string[]) => ({ fingerprintsForUrl: () => fingerprints } as unknown as ReactStateStore);

// A page whose injected extension API reports the given live fingerprint (a non-empty graph, so the poll accepts it).
const pageWithFingerprint = (fp: string) => browser.withHtml(
  `<script>window.__RAPIDOR__getLatestState = () => ({ fingerprint: ${JSON.stringify(fp)}, nodes: { a: { id: 'a' } } });</script>`,
);

test('gate: FRESH when the live entry-point fingerprint matches a captured one', async () => {
  const page = await pageWithFingerprint('FP_AUTHED');
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED', 'FP_MODAL']), site: 'x', entryUrl: 'u', maxWaitMs: 200 });
  assert.equal(r.fresh, true);
  assert.equal(r.liveFingerprint, 'FP_AUTHED');
});

test('gate: EXPIRED when the live fingerprint matches none (login redirect -> different tree)', async () => {
  const page = await pageWithFingerprint('FP_LOGIN');
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED']), site: 'x', entryUrl: 'u', maxWaitMs: 200 });
  assert.equal(r.fresh, false);
  assert.match(r.reason, /differs/);
});

test('gate: conservative FRESH when the extension is absent (cannot gate -> proceed)', async () => {
  const page = await browser.withHtml('<p>no extension here</p>');
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED']), site: 'x', entryUrl: 'u', maxWaitMs: 200 });
  assert.equal(r.fresh, true);
  assert.match(r.reason, /extension not present/);
});

test('gate: conservative FRESH when no seed fingerprint was captured for the entry URL', async () => {
  const page = await pageWithFingerprint('FP_AUTHED');
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore([]), site: 'x', entryUrl: 'u', maxWaitMs: 200 });
  assert.equal(r.fresh, true);
  assert.equal(r.seedCount, 0);
});
