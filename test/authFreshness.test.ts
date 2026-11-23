import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEntryPointFresh } from '../src/analysis/authFreshness';
import type { ReactStateStore } from '../src/db/ReactStateStore';
import { useBrowser } from './helpers/browser';

const browser = useBrowser();

// A ReactStateStore answering only the gate's two queries: seed fingerprints and seed graph sizes for the entry URL.
const fakeStore = (fingerprints: string[], nodeCounts: number[] = [100]) =>
  ({ fingerprintsForUrl: () => fingerprints, nodeCountsForUrl: () => nodeCounts } as unknown as ReactStateStore);

// A page whose injected extension API reports the given live fingerprint over a graph of `nodes` nodes.
const pageWith = ({ fp, nodes = 100, extraHtml = '' }: { fp: string; nodes?: number; extraHtml?: string }) => browser.withHtml(
  `${extraHtml}<script>const nodes = {}; for (let i = 0; i < ${nodes}; i++) nodes['n' + i] = { id: 'n' + i };
   window.__RAPIDOR__getLatestState = () => ({ fingerprint: ${JSON.stringify(fp)}, nodes });</script>`,
);

test('gate: FRESH when the live entry-point fingerprint matches a captured one', async () => {
  const page = await pageWith({ fp: 'FP_AUTHED' });
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED', 'FP_MODAL']), site: 'x', entryUrl: page.url(), maxWaitMs: 200 });
  assert.equal(r.fresh, true);
  assert.equal(r.liveFingerprint, 'FP_AUTHED');
});

// duolingo /learn: 220 captures, 220 distinct fingerprints while logged in — no exact match is NOT expiry
test('gate: FRESH on a new structural variant that stays on the entry route with a comparable tree', async () => {
  const page = await pageWith({ fp: 'FP_NEW_VARIANT', nodes: 90 });
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_A', 'FP_B'], [100, 140]), site: 'x', entryUrl: page.url(), maxWaitMs: 200 });
  assert.equal(r.fresh, true);
  assert.match(r.reason, /new structural variant/);
});

test('gate: EXPIRED when the app redirected away from the entry route (login redirect)', async () => {
  const page = await pageWith({ fp: 'FP_LANDING' });
  const entryUrl = 'https://app.test/dashboard';   // the entry route; the page actually sits elsewhere (about:blank)
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED']), site: 'x', entryUrl, maxWaitMs: 200 });
  assert.equal(r.fresh, false);
  assert.match(r.reason, /redirected away/);
});

test('gate: EXPIRED when the entry point renders a password field (login form in place)', async () => {
  const page = await pageWith({ fp: 'FP_LOGIN', extraHtml: '<input type="password">' });
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED']), site: 'x', entryUrl: page.url(), maxWaitMs: 200 });
  assert.equal(r.fresh, false);
  assert.match(r.reason, /password/);
});

test('gate: EXPIRED when the live tree is far smaller than every captured state', async () => {
  const page = await pageWith({ fp: 'FP_TINY', nodes: 20 });
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED'], [100, 200]), site: 'x', entryUrl: page.url(), maxWaitMs: 200 });
  assert.equal(r.fresh, false);
  assert.match(r.reason, /React nodes/);
});

test('gate: conservative FRESH when the extension is absent (cannot gate -> proceed)', async () => {
  const page = await browser.withHtml('<p>no extension here</p>');
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore(['FP_AUTHED']), site: 'x', entryUrl: page.url(), maxWaitMs: 200 });
  assert.equal(r.fresh, true);
  assert.match(r.reason, /extension not present/);
});

test('gate: conservative FRESH when no seed fingerprint was captured for the entry URL', async () => {
  const page = await pageWith({ fp: 'FP_AUTHED' });
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore([]), site: 'x', entryUrl: page.url(), maxWaitMs: 200 });
  assert.equal(r.fresh, true);
  assert.equal(r.seedCount, 0);
});
