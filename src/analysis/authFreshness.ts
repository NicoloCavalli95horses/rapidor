import type { Page } from 'playwright';
import type { ReactStateStore, RapidorGraph } from '../db/ReactStateStore';
import { sleep, sameRoutePath, safePath } from '../utils/utils';

/**
 * Entry-point auth-freshness gate for a re-analysis run (t2) over data captured earlier (t1). The forge
 * needs a live authenticated session; if it expired since capture, every probe is denied. We decide this
 * ONCE, up front, on a resource the user is unambiguously entitled to — the crawl's own entry point
 * (START_URL, an internal authenticated page). That is the whole point: a per-forge 403 is AMBIGUOUS (for
 * a paid-resource IDOR a 403 is the CORRECT "no leak" answer), so it must never drive re-authentication,
 * or an expired run would loop. The gate is the only auth trigger; the forge path never calls it.
 *
 * Signal: re-render the entry point and read its live React fingerprint via the extension, compared to the
 * fingerprint(s) captured for that URL at t1. A valid session renders the same authenticated component
 * tree (match -> fresh); an expired one redirects to login, a structurally different tree (mismatch ->
 * expired). STRUCTURE only (graph.fingerprint), never the content key: the page's DATA legitimately
 * changes between t1 and t2, its STRUCTURE collapses only when we land on the login page.
 *
 * Conservative on missing evidence (returns fresh): no seed fingerprint stored, no extension, or an app
 * that never mounts means we cannot gate — proceed rather than block, the same stance the content guards
 * take on a missing key. The page is assumed already navigated to entryUrl by the caller.
 */
export async function checkEntryPointFresh({ page, reactStateStore, site, entryUrl, maxWaitMs = 3_000 }: {
  page: Page; reactStateStore: ReactStateStore; site: string; entryUrl: string; maxWaitMs?: number;
}): Promise<{ fresh: boolean; reason: string; liveFingerprint?: string; seedCount: number }> {
  const seed = new Set(reactStateStore.fingerprintsForUrl({ site, url: entryUrl }));
  if (seed.size === 0) return { fresh: true, reason: 'no seed fingerprint for the entry URL (cannot gate — proceeding)', seedCount: 0 };

  const hasApi = await page.evaluate(
    () => typeof (window as unknown as { __RAPIDOR__getLatestState?: unknown }).__RAPIDOR__getLatestState === 'function',
  ).catch(() => false);
  if (!hasApi) return { fresh: true, reason: 'extension not present (cannot gate — proceeding)', seedCount: seed.size };

  await page.waitForLoadState('networkidle', { timeout: maxWaitMs }).catch(() => {});
  // Poll the extension's MAIN-world API until the app has mounted and emitted a non-empty graph.
  let graph: RapidorGraph | undefined;
  for (let i = 0; i < 20 && !(graph?.nodes && Object.keys(graph.nodes).length > 0); i++) {
    graph = await page.evaluate(
      () => (window as unknown as { __RAPIDOR__getLatestState?: () => RapidorGraph | undefined }).__RAPIDOR__getLatestState?.() ?? undefined,
    ).catch(() => undefined);
    if (!(graph?.nodes && Object.keys(graph.nodes).length > 0)) await sleep(150);
  }
  const live = graph?.fingerprint;
  if (!live) return { fresh: true, reason: 'app did not mount a readable React state (cannot gate — proceeding)', seedCount: seed.size };
  if (seed.has(live)) return { fresh: true, liveFingerprint: live, seedCount: seed.size, reason: 'entry-point fingerprint matches a captured authenticated state' };

  // No exact match is NOT evidence of expiry: a dynamic entry page re-renders a new structure every time
  // (duolingo /learn: 220 captures, 220 distinct fingerprints, while logged in). Require POSITIVE evidence.
  const common = { fresh: false, liveFingerprint: live, seedCount: seed.size };
  if (!sameRoutePath(page.url(), entryUrl)) return { ...common, reason: `redirected away from the entry route to ${safePath(page.url())} (login)` };
  if (await page.evaluate(() => !!document.querySelector('input[type="password"]')).catch(() => false)) {
    return { ...common, reason: 'entry point renders a password field (login form)' };
  }
  const liveNodes = Object.keys(graph?.nodes ?? {}).length;
  const minSeedNodes = Math.min(...reactStateStore.nodeCountsForUrl({ site, url: entryUrl }));
  if (Number.isFinite(minSeedNodes) && liveNodes < MIN_NODE_RATIO * minSeedNodes) {
    return { ...common, reason: `entry point renders ${liveNodes} React nodes, under ${MIN_NODE_RATIO}x the smallest captured state (${minSeedNodes}) — a login/landing page` };
  }
  return { fresh: true, liveFingerprint: live, seedCount: seed.size, reason: `new structural variant of the entry point (${liveNodes} nodes, smallest capture ${minSeedNodes}), still on route with no login form — proceeding` };
}

/** A live entry tree smaller than this fraction of the smallest captured one is a login/landing page. */
const MIN_NODE_RATIO = 0.5;
