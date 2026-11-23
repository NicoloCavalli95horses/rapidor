import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEntryPointFresh } from '../src/analysis/authFreshness';
import type { ReactStateStore } from '../src/db/ReactStateStore';
import { useBrowser, APP_ORIGIN } from './helpers/browser';

const browser = useBrowser();

// A ReactStateStore answering only the gate's two queries: seed fingerprints and seed graph sizes for the entry URL.
const fakeStore = (fingerprints: string[], nodeCounts: number[] = [100]) =>
  ({ fingerprintsForUrl: () => fingerprints, nodeCountsForUrl: () => nodeCounts } as unknown as ReactStateStore);

// Injects the extension API reporting `fp` over a graph of `nodes` nodes (plus any `extraHtml`).
const extScript = ({ fp, nodes = 100, extraHtml = '' }: { fp: string; nodes?: number; extraHtml?: string }) =>
  `${extraHtml}<script>const nodes = {}; for (let i = 0; i < ${nodes}; i++) nodes['n' + i] = { id: 'n' + i };
   window.__RAPIDOR__getLatestState = () => ({ fingerprint: ${JSON.stringify(fp)}, nodes });</script>`;

// A page on about:blank (origin matches an about:blank entryUrl — used for the same-origin cases).
const pageWith = (opts: { fp: string; nodes?: number; extraHtml?: string }) => browser.withHtml(extScript(opts));

// A page SERVED on APP_ORIGIN, so page.url() is a real same-origin URL — for the same-origin redirect case.
const servedPage = (path: string, opts: { fp: string; nodes?: number; extraHtml?: string }) =>
  browser.open({ [path]: extScript(opts) }, path);

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

// ejoy: the entry URL has no seed fingerprint, and a cold load bounces to sso.ejoyspace.com/?continue=…
test('gate: EXPIRED on a cross-origin redirect even with no seed fingerprint (SSO bounce)', async () => {
  const page = await pageWith({ fp: 'FP_SSO' });   // page sits on about:blank; entryUrl is a different origin
  const r = await checkEntryPointFresh({ page, reactStateStore: fakeStore([]), site: 'x', entryUrl: 'https://ejoy-english.com/app/courses/37/314', maxWaitMs: 200 });
  assert.equal(r.fresh, false);
  assert.match(r.reason, /different origin/);
});

test('gate: EXPIRED when the app redirected away from the entry route (login redirect)', async () => {
  // Served SAME-ORIGIN as the entry route (both on APP_ORIGIN) but at a different path: the app bounced
  // /dashboard -> /landing. Must be same-origin, else the cross-origin check short-circuits first.
  const page = await servedPage('/landing', { fp: 'FP_LANDING' });
  const entryUrl = `${APP_ORIGIN}/dashboard`;   // the entry route; the app redirected to /landing (same origin)
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
