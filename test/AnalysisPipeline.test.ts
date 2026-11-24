import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AnalysisPipeline } from '../src/analysis/AnalysisPipeline';
import { HttpEventStore } from '../src/db/HttpEventStore';
import { PreindexedValueStore } from '../src/db/PreindexedValueStore';
import { ReactStateStore, type RapidorGraph } from '../src/db/ReactStateStore';
import { CrawlStateStore } from '../src/db/CrawlStateStore';
import { VulnerabilityStore } from '../src/db/VulnerabilityStore';
import { AnalysisStatsStore } from '../src/db/AnalysisStatsStore';
import { ForgedRequestStore } from '../src/db/ForgedRequestStore';
import { AuthzClassifier } from '../src/analysis/authzClassifier';
import { AuthzClassificationStore } from '../src/db/AuthzClassificationStore';
import { installParamUsageTracking } from '../src/browser/paramUsageTracker';
import { useBrowser, APP_ORIGIN } from './helpers/browser';

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'crawler-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

/** Sibling nodes of the same component, differing in `id` (not authz-relevant by itself) and in the
 * sensitive-looking `premium` flag — exactly matchFinder.test.ts's own fixture shape. */
function siblingGraph(): RapidorGraph {
  return {
    fingerprint: 'f1',
    nodes: {
      'node-1': { id: 'node-1', componentId: 1, props: { id: '101', premium: false } },
      'node-2': { id: 'node-2', componentId: 1, props: { id: '102', premium: true } },
    },
    componentIndex: { '1': ['node-1', 'node-2'] },
  };
}

describe('AnalysisPipeline: client-side-only query params', () => {
  let n = 0;
  function newPipeline({ authzDirectionGate }: { authzDirectionGate?: boolean } = {}) {
    const dbPath = join(root, `${n++}.db`);
    const db = new Database(dbPath);
    const httpEventStore = new HttpEventStore({ db, clearOnStart: true });
    const preindexStore = new PreindexedValueStore({ db, clearOnStart: true });
    const reactStateStore = new ReactStateStore({ db, clearOnStart: true });
    const crawlStateStore = new CrawlStateStore({ db, clearOnStart: true });
    const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: true });
    const statsStore = new AnalysisStatsStore({ db, clearOnStart: true });
    const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: true });
    const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: true }));
    const pipeline = new AnalysisPipeline({
      httpEventStore, preindexStore, reactStateStore, crawlStateStore, vulnerabilityStore, statsStore, forgedRequestStore, classifier,
      options: {
        maxConcurrentRequests: 1, timeBetweenRequestsMs: 0, maxGeneratedRequests: 100000, dbPath, reportsDir: join(root, 'reports'),
        // test pages react near-instantly: a short window keeps the suite fast without masking a real miss
        clientRoutingProbe: { minWaitMs: 300, idleMs: 50, maxWaitMs: 500 },
        maxSegmentMatches: 300,
        clientRoutingConcurrency: 1,
        notFoundDomMaxDiff: 0.05,
        segmentBlacklist: [],
        paramBlacklist: [],
        clientRoutingFullNavigationEscalation: true,
        clientRoutingEscalationAttempts: 2,
        clientRoutingPathCoherence: true,
        authzDirectionGate,
      },
    });
    return { pipeline, httpEventStore, preindexStore, reactStateStore, crawlStateStore, vulnerabilityStore, classifier };
  }

  const { newPage } = useBrowser();

  // A client-routed SPA that resolves ?id from already-loaded state (no network request for it):
  // a known id renders its owner's profile (data that differs per id, not just the echoed id — an
  // echo alone is masked out by the DOM guards and is not a leak), an unknown id renders nothing —
  // the app's own "not found". That distinction is what the not-found guard needs: a real
  // candidate's DOM (a block of text) must differ from the not-found baseline (empty, garbage id).
  // Replaces children (childList mutation) so clientRouting.ts's MutationObserver sees it — it only
  // watches childList/attributes.
  const html = `<div id="out"></div><script>
    const KNOWN = { '101': 'Alice', '102': 'Bob' };
    function render() {
      const out = document.getElementById('out');
      out.innerHTML = '';
      const id = new URLSearchParams(location.search).get('id');
      if (KNOWN[id]) {
        const block = document.createElement('div');
        block.style.cssText = 'width:1000px;height:600px;background:#3366cc';
        block.textContent = 'Profile ' + id + ' owned by ' + KNOWN[id];
        out.appendChild(block);
      }
    }
    window.addEventListener('popstate', render);
    render();
  </script>`;

  it('flags a sibling id as a candidate and tests it via pushState, with no HTTP request involved', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    // pre-seed the classifier cache: 'premium' is authz-relevant, 'id' is not — skips loading the
    // real embedding model (see authzClassifier.test.ts for the slow, real-model equivalent)
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page); // must be an init script, in place before the page's own script runs
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const pageUrl = `${APP_ORIGIN}/?id=101`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    const findings = vulnerabilityStore.count('app.test');
    assert.equal(findings, 1);
  });

  // Direction gate: the candidate must be the RESTRICTED side. Reference 102 (premium) -> candidate 101
  // (free) is the getpronounce `shimmer -> daniel` shape (a paid item the user legitimately reached,
  // swapped for a free sibling) and is dropped; the forward swap 101 -> 102 is still flagged.
  for (const [refId, expected] of [['102', 0], ['101', 1]] as const) {
    it(`direction gate: reference ${refId} -> ${expected ? 'flagged (candidate is premium)' : 'dropped (candidate is free)'}`, async () => {
      const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline({ authzDirectionGate: true });
      (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
      (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });
      // pre-seed the NLI polarity too (premium restricts), so no model is loaded
      (classifier as unknown as { polarityModel: { cache: Map<string, unknown> } }).polarityModel.cache.set('premium', { polarity: 1, relevance: 1 });

      const page = await newPage();
      await installParamUsageTracking(page);
      await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
      const pageUrl = `${APP_ORIGIN}/?id=${refId}`;
      await page.goto(pageUrl);
      const graph = siblingGraph();
      const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
      preindexStore.reindex({ stateId, graph });

      await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });
      assert.equal(vulnerabilityStore.count('app.test'), expected);
    });
  }

  // Only a 200 GET is a forge reference: a 204 beacon carrying the same id (talkpal's first-party GA
  // `collect`) must generate nothing, while the 200 one still yields its sibling forge.
  it('generates HTTP forge candidates only from 200 GET events', async () => {
    const { pipeline, httpEventStore, preindexStore, reactStateStore } = newPipeline();
    const page = await newPage();
    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: `${APP_ORIGIN}/home`, graph })!;
    preindexStore.reindex({ stateId, graph });
    const base = { method: 'GET', requestHeaders: {}, timestamp: new Date().toISOString(), pageUrl: `${APP_ORIGIN}/home`, responseBody: '' };
    httpEventStore.record({ site: 'app.test', request: { ...base, url: `${APP_ORIGIN}/collect?id=101`, status: 204 } });
    httpEventStore.record({ site: 'app.test', request: { ...base, url: `${APP_ORIGIN}/api/item?id=101`, status: 200, responseBody: '{"id":"101"}' } });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    const db = (httpEventStore as unknown as { db: Database.Database }).db;
    const { http_forged } = db.prepare("SELECT http_forged FROM analysis_stats WHERE site = 'app.test'").get() as { http_forged: number };
    assert.equal(http_forged, 1);
  });

  // Sibling-group confirmation: four sibling instances of one component (reference 101 + premium
  // siblings 102/103/104). The SPA (the `html` fixture) KNOWS only 101 and 102, so 102 renders a real
  // distinct profile (a genuine accept) while 103/104 render the app's empty not-found page — which the
  // per-candidate not-found guard would reject in isolation. Because 102 genuinely confirms the group
  // (same reference node, swap path and authz-relevant `premium` key), 103/104 are recovered as a
  // logical consequence instead of lost: all three siblings are flagged. This is the flakiness fix —
  // confirming ONE paid sibling confirms them all (ejoy's locked lessons). See candidateEvaluator's
  // clientGroup* fields.
  it('recovers flaky-rejected siblings once one sibling of the group is genuinely confirmed', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const pageUrl = `${APP_ORIGIN}/?id=101`;
    await page.goto(pageUrl);

    // Four siblings of component 1: the reference (101) and three premium siblings; only 102 is a
    // resource the fixture actually renders, so 103/104's probes come back as the (empty) not-found page.
    const graph: RapidorGraph = {
      fingerprint: 'f1',
      nodes: {
        'node-1': { id: 'node-1', componentId: 1, props: { id: '101', premium: false } },
        'node-2': { id: 'node-2', componentId: 1, props: { id: '102', premium: true } },
        'node-3': { id: 'node-3', componentId: 1, props: { id: '103', premium: true } },
        'node-4': { id: 'node-4', componentId: 1, props: { id: '104', premium: true } },
      },
      componentIndex: { '1': ['node-1', 'node-2', 'node-3', 'node-4'] },
    };
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    // All three premium siblings are flagged: 102 on its own probe, 103/104 recovered from the group.
    assert.equal(vulnerabilityStore.count('app.test'), 3);
  });

  // The reference id renders a real profile; every other id — the candidate and the garbage
  // calibration value alike — renders the app's not-found page, which ECHOES the id it was given
  // ("Profile 102 not found"). The route reacts (DOM mutates) and differs from the reference (so the
  // inert guard keeps it), but it shows no real resource: the not-found guard must match it to the
  // garbage baseline once each side's own value is masked out, and reject it. The id is parsed with
  // a regex, not URLSearchParams.get, so the probe sees no param read: nothing corroborates the
  // candidate and the not-found guard does run.
  const notFoundHtml = `<div id="out"></div><script>
    function render() {
      const out = document.getElementById('out');
      out.innerHTML = '';
      const m = /[?&]id=([^&]*)/.exec(location.search);
      const id = m ? m[1] : '';
      const block = document.createElement('div');
      block.style.cssText = 'width:1000px;height:600px;background:#cccccc';
      block.textContent = id === '101' ? 'Profile 101 owned by Alice' : 'Profile ' + id + ' not found';
      out.appendChild(block);
    }
    window.addEventListener('popstate', render);
    render();
  </script>`;

  it('rejects a candidate whose render matches the app\'s not-found page (DOM guard)', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: notFoundHtml }));
    const pageUrl = `${APP_ORIGIN}/?id=101`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    // DOM mutated, differs from the reference and 'premium' is authz-relevant, but the render is the not-found page -> not flagged
    assert.equal(vulnerabilityStore.count('app.test'), 0);
  });

  // The lingualeo refclmark false positive, reduced: the app READS ?id (URLSearchParams.get, so the
  // probe sees appReadParam — corroboration that used to skip every visual guard) and re-renders on
  // popstate (a real DOM mutation), but shows the same content for every value. The inert-value
  // guard must see the candidate's render is the reference page's own render and reject it.
  const inertHtml = `<div id="out"></div><script>
    function render() {
      new URLSearchParams(location.search).get('id'); // read, then ignored
      const out = document.getElementById('out');
      out.innerHTML = '';
      const block = document.createElement('div');
      block.style.cssText = 'width:1000px;height:600px;background:#33aa66';
      block.textContent = 'Buy premium';
      out.appendChild(block);
    }
    window.addEventListener('popstate', render);
    render();
  </script>`;

  it('rejects a candidate whose render is identical to the reference page (inert value), even when the app read the param', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: inertHtml }));
    const pageUrl = `${APP_ORIGIN}/?id=101`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    assert.equal(vulnerabilityStore.count('app.test'), 0);
  });

  it('never flags anything when the differing props are not authz-relevant', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 0, isAuthZRelevant: false });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const pageUrl = `${APP_ORIGIN}/?id=101`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    assert.equal(vulnerabilityStore.count('app.test'), 0);
  });
});

describe('AnalysisPipeline: client-side-only path segments', () => {
  let n = 0;
  function newPipeline(extra: { clientRoutingGroupRejectAfter?: number } = {}) {
    const dbPath = join(root, `path-${n++}.db`);
    const db = new Database(dbPath);
    const httpEventStore = new HttpEventStore({ db, clearOnStart: true });
    const preindexStore = new PreindexedValueStore({ db, clearOnStart: true });
    const reactStateStore = new ReactStateStore({ db, clearOnStart: true });
    const crawlStateStore = new CrawlStateStore({ db, clearOnStart: true });
    const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: true });
    const statsStore = new AnalysisStatsStore({ db, clearOnStart: true });
    const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: true });
    const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: true }));
    const pipeline = new AnalysisPipeline({
      httpEventStore, preindexStore, reactStateStore, crawlStateStore, vulnerabilityStore, statsStore, forgedRequestStore, classifier,
      options: {
        maxConcurrentRequests: 1, timeBetweenRequestsMs: 0, maxGeneratedRequests: 100000, dbPath, reportsDir: join(root, 'reports'),
        clientRoutingProbe: { minWaitMs: 300, idleMs: 50, maxWaitMs: 500 },
        maxSegmentMatches: 300,
        clientRoutingConcurrency: 1,
        notFoundDomMaxDiff: 0.05,
        segmentBlacklist: [],
        paramBlacklist: [],
        clientRoutingFullNavigationEscalation: true,
        clientRoutingEscalationAttempts: 2,
        clientRoutingPathCoherence: true,
        ...extra,
      },
    });
    return { pipeline, preindexStore, reactStateStore, crawlStateStore, vulnerabilityStore, classifier };
  }

  const { newPage } = useBrowser();

  // Mirrors busuu's objective_<uuid>: an id that only ever appears in the page's OWN URL path, never
  // in a query string and never in any captured HTTP request's URL. Re-renders (replacing the child
  // element, a childList mutation) the second path segment on every popstate, so clientRouting.ts's
  // MutationObserver sees it regardless of the actual value — there is no path equivalent of
  // __accessedParams (see checkClientSideRoutingForPath's doc comment), so the probe can only tell
  // "the router reacted to the URL change", not "it read this exact segment".
  // Known ids render a large content block, an unknown id renders nothing (the app's own "not found")
  // — so the not-found guard can tell a real candidate's render from the not-found baseline. Each
  // known id shows its own owner, not only the echoed id (an echo is masked out, see domSnapshot.ts).
  const html = `<div id="out"></div><script>
    const KNOWN = { '101': 'Alice', '102': 'Bob' };
    function render() {
      const out = document.getElementById('out');
      out.innerHTML = '';
      const id = location.pathname.split('/').filter(Boolean)[1];
      if (KNOWN[id]) {
        const block = document.createElement('div');
        block.style.cssText = 'width:1000px;height:600px;background:#3366cc';
        block.textContent = 'Profile ' + id + ' owned by ' + KNOWN[id];
        out.appendChild(block);
      }
    }
    window.addEventListener('popstate', render);
    render();
  </script>`;

  it('flags a sibling id carried by a path segment, tested via pushState with no HTTP request involved', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const pageUrl = `${APP_ORIGIN}/users/101/profile`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    const findings = vulnerabilityStore.count('app.test');
    assert.equal(findings, 1);
  });

  // Regression for lingualeo's /en/training/<type>: an SSR route whose CONTENT is produced only on a
  // real load. popstate causes a spurious mutation (a spinner tick) that makes the probe see a DOM
  // reaction and stay on the route, but the content ('out') is written once, on load, from the URL —
  // a pushState to the sibling URL never re-renders it. The content guard must reach the candidate by
  // a REAL navigation (captureRouteByNavigation): on a fresh load, render() reads the new segment and
  // shows the sibling's owner, which differs from the reference. (With the old pushState-based guard
  // the candidate looked identical to the reference and this real finding was dropped.)
  const ssrOnLoadHtml = `<div id="out"></div><div id="spin">0</div><script>
    const KNOWN = { '101': 'Alice', '102': 'Bob' };
    function render() {
      const out = document.getElementById('out');
      out.innerHTML = '';
      const id = location.pathname.split('/').filter(Boolean)[1];
      const block = document.createElement('div');
      block.style.cssText = 'width:1000px;height:600px;background:#3366cc';
      block.textContent = KNOWN[id] ? ('Profile ' + id + ' owned by ' + KNOWN[id]) : ('Profile ' + id + ' not found');
      out.appendChild(block);
    }
    // popstate mutates something trivial (so the probe sees a reaction) but does NOT re-render content
    window.addEventListener('popstate', () => { document.getElementById('spin').textContent = String(Date.now()); });
    render(); // content is set only on a real load, from the URL
  </script>`;

  it('flags a sibling whose route renders its content only on a real navigation (pushState shows nothing new)', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: ssrOnLoadHtml }));
    const pageUrl = `${APP_ORIGIN}/users/101/profile`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    assert.equal(vulnerabilityStore.count('app.test'), 1);
  });

  // Regression: busuu's own dashboard/review -> dashboard/dashboard/weak (client-routing-path). The
  // candidate's own path segment was rejected by the app's router, which silently redirected (client-
  // side, no new network request) to its fallback route — a real DOM mutation (the fallback page
  // rendering), but evidence the candidate was REJECTED, not that the app rendered its content. The
  // old single-signal hasMutatedDom check could not tell the two apart.
  const redirectingHtml = `<div id="out"></div><script>
    function render() {
      const segs = location.pathname.split('/').filter(Boolean);
      const out = document.getElementById('out');
      if (segs[0] === 'users' && segs[1] === '101') {
        out.innerHTML = '<p>' + segs[1] + '</p>';
      } else if (segs[0] === 'home') {
        out.innerHTML = '<p>home</p>';
      } else {
        // unknown route: the app's own router redirects to its fallback, like busuu's dashboard/timeline
        history.pushState({}, '', '/home');
        render();
      }
    }
    window.addEventListener('popstate', render);
    render();
  </script>`;

  // clozemaster, reduced: popstate only ticks a spinner (stage 1 sees a reaction and stays on route, but
  // renders nothing new → stage 2 real load). On a real load a PAID id (102-106) bounces client-side to
  // /pro and shows the upsell; an unknown id shows "not found". The upsell differs from both the reference
  // and the not-found baseline, so only the redirect-away tells it is a paywall, not a leak.
  const paywallHtml = `<div id="out"></div><div id="spin">0</div><script>
    const segs = location.pathname.split('/').filter(Boolean);
    const out = document.getElementById('out');
    if (segs[0] === 'pro') out.textContent = 'Upgrade to Pro to unlock every story';
    else if (segs[1] === '101') out.textContent = 'Story 101: the free story text everyone can read';
    else if (/^10[2-6]$/.test(segs[1])) { history.replaceState({}, '', '/pro'); out.textContent = 'Upgrade to Pro to unlock every story'; }
    else out.textContent = 'Story ' + segs[1] + ' not found';
    window.addEventListener('popstate', () => { document.getElementById('spin').textContent = String(Date.now()); });
  </script>`;

  /** Reference 101 (free) plus `count` premium siblings 102.. of one component. */
  function paywallGraph(count: number): RapidorGraph {
    const nodes: RapidorGraph['nodes'] = { 'node-1': { id: 'node-1', componentId: 1, props: { id: '101', premium: false } } };
    for (let i = 2; i <= count + 1; i++) nodes[`node-${i}`] = { id: `node-${i}`, componentId: 1, props: { id: String(100 + i), premium: true } };
    return { fingerprint: 'f1', nodes, componentIndex: { '1': Object.keys(nodes) } };
  }

  async function runPaywall({ count, rejectAfter }: { count: number; rejectAfter: number }) {
    const ctx = newPipeline({ clientRoutingGroupRejectAfter: rejectAfter });
    (ctx.classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (ctx.classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });
    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: paywallHtml }));
    const pageUrl = `${APP_ORIGIN}/stories/101/read`;
    await page.goto(pageUrl);
    const graph = paywallGraph(count);
    const stateId = ctx.reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    ctx.preindexStore.reindex({ stateId, graph });
    await ctx.pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });
    const skipped = (ctx.pipeline as unknown as { candidateEvaluator: { clientGroupSkipped: number } }).candidateEvaluator.clientGroupSkipped;
    return { findings: ctx.vulnerabilityStore.count('app.test'), skipped };
  }

  it('never flags a sibling whose real load redirects away to a paywall (stage-2 redirect guard)', async () => {
    const { findings } = await runPaywall({ count: 1, rejectAfter: 0 });
    assert.equal(findings, 0);
  });

  // Negative sibling-group inference: 5 paid siblings all bounce to /pro. After 2 same-target redirects the
  // group is rejected and the remaining 3 are skipped, not probed (sequential pool → deterministic count).
  it('skips the rest of a sibling group once enough siblings redirected to the same target', async () => {
    const { findings, skipped } = await runPaywall({ count: 5, rejectAfter: 2 });
    assert.equal(findings, 0);
    assert.equal(skipped, 3);
  });

  it('never flags a path candidate the app rejected by silently redirecting elsewhere (client-side, no new request)', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    // would have been flagged if the redirect-away were mistaken for a genuine accept
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: redirectingHtml }));
    const pageUrl = `${APP_ORIGIN}/users/101/profile`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    assert.equal(vulnerabilityStore.count('app.test'), 0);
  });

  it('never flags anything when the differing props are not authz-relevant', async () => {
    const { pipeline, preindexStore, reactStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 0, isAuthZRelevant: false });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const pageUrl = `${APP_ORIGIN}/users/101/profile`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    assert.equal(vulnerabilityStore.count('app.test'), 0);
  });

  it("never flags a candidate URL already in the crawler's own history (e.g. a normal nav target)", async () => {
    // Regression: busuu's own "dashboard/review" -> "dashboard/community" -- the candidate value
    // happened to land on a URL the crawler had already visited by clicking around normally, so it
    // isn't evidence of unauthorized cross-user access.
    const { pipeline, preindexStore, reactStateStore, crawlStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const page = await newPage();
    await installParamUsageTracking(page);
    await page.route(`${APP_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const pageUrl = `${APP_ORIGIN}/users/101/profile`;
    await page.goto(pageUrl);

    const graph = siblingGraph();
    const stateId = reactStateStore.record({ site: 'app.test', url: pageUrl, graph })!;
    preindexStore.reindex({ stateId, graph });
    // the candidate the pipeline would otherwise forge is .../users/102/profile: recorded here as an
    // ordinary state the DFS exploration already reached on its own.
    crawlStateStore.record({
      site: 'app.test',
      record: { id: 'state-already-seen', url: `${APP_ORIGIN}/users/102/profile`, depth: 1, path: [], clickables: [], texts: [] },
    });

    await pipeline.runForSite({ page, site: 'app.test', explorationMs: 1000 });

    assert.equal(vulnerabilityStore.count('app.test'), 0);
  });
});
