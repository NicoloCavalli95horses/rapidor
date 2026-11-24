import 'dotenv/config'; // loads .env into process.env before any field below reads it
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_ALLOWED_LINK_SCHEMES } from './utils/utils.js';

// dotenv does not expand variables: resolve a leading ~, $HOME or ${HOME} ourselves
function expandHome({ value }: { value: string }): string {
  const home = os.homedir();
  return path.resolve(value.replace(/^(~|\$HOME|\$\{HOME\})(?=\/|$)/, home));
}

export interface ExtensionCall {
  fn: string;  // name on window, e.g. '__RAPIDOR__getData'
  // - start: before the exploration;
  // - end: after the last state; before-action: before each action on a page;
  // - after-action: after each action, on the resulting page. before/after-action results are
  // treated as "ready"/"not ready" and never block the crawl.
  when: 'start' | 'end' | 'before-action' | 'after-action';
  args?: unknown[]; // arguments, JSON-serializable
}

export interface ExtensionConfig {
  path: string; // extension folder (the one with manifest.json), unpacked
  calls: ExtensionCall[];
}

export interface LightweightConfig {
  enabled: boolean;               // cheaper browsing while exploring: 1ms animations, no paint-only CSS, no images
  blockImages: boolean;           // images are not loaded (the layout is stable, so fingerprints stay consistent between runs)
  blockFonts: boolean;            // font files are not loaded: the text uses fallback fonts
  blockedUrlPatterns: string[];   // Chromium URL patterns (* wildcard) never requested: analytics, ads, session replay
  cacheStaticAssets: boolean;     // scripts/stylesheets are kept in memory: restoring a state does not download them again
  assetCacheMaxMb: number;        // cap on the memory used by that cache, per site
}

export interface CrawlConfig {
  startUrl: string;
  startUrls: string[];          // sites to explore in one run (`npm start`); when empty, only startUrl is explored
  maxDepth: number;
  // Try a state's clickables in RANDOM order instead of capture (DOM/reading) order. Capture order puts
  // nav/header chrome first, and a DFS with a time budget drains it on those branches before ever reaching
  // the page-centre buttons (busuu: 45min/depth-2 never leaves the nav). Randomizing samples the whole
  // clickable set so central lesson buttons get an equal early chance. Per-tab local shuffle — no cross-tab
  // coordination needed (the synchronous claim() still guarantees exclusivity). Makes a crawl non-repeatable.
  randomizeClickOrder: boolean;
  maxStates: number;            // cap on the states saved by each tab: guarantees termination
  restoreAttempts: number;      // times a (state,element) pair is retried across landings before being given up as unreachable: absorbs intermittent interstitials without pruning a whole branch (see StateStoreOptions.restoreAttempts)
  maxDurationSecs: number;      // per-PHASE time budget per site: the exploration shuts down on its own after this, and the end-of-crawl analysis is allowed the same budget again (the request handler is sized for both — see main.ts requestHandlerTimeoutSecs)
  concurrency: number;          // sites explored in parallel
  tabsPerSite: number;          // tabs exploring the same site together (same context: shared cookies and storage)
  restoreDelayMs: number;       // minimum gap between two reloads of the same site (all tabs together)
  viewport: { width: number; height: number };
  stability: { quietMs: number; timeoutMs: number; longRequestMs: number };
  rectGridPx: number;           // rectangle rounding in the fingerprint
  includeUrlInFingerprint: boolean;
  text: {
    inElementId: boolean;         // clickable's text in its id
    inStateFingerprint: boolean;  // visible page texts in the state fingerprint
    maxBlocks: number;
    maxBlockLength: number;
  };
  actionTimeoutMs: number;
  screenshots: boolean;         // saves a PNG image of each state (visual debugging only)
  headless: boolean;            // false: opens a browser window to watch the crawler in action
  locale: string;               // language requested from sites: keeps texts and blocklist consistent
  blocklist: string[];          // texts not to click (e.g. logout)
  ignoreClickablesWithin: string[];  // CSS selectors: never treat anything inside these as clickable (e.g. nav/header/footer chrome)
  allowedLinkSchemes: string[];      // href schemes clickable in-browser; any other (mailto:, tel:, sms:, webcal:, zoommtg:, …) is dropped so the OS never launches an external app
  dismissOverlays: boolean;     // close blocking modals (Escape / close control) before capturing, so an interstitial does not cost a depth level
  db: {
    path: string;                    // SQLite file, shared across the whole run (every site, every tab)
    clearOnStart: boolean;           // wipe http_events/react_states/preindexed_values/vulnerabilities/analysis_stats (every site's rows) once at the start of each crawler run; false by default — use overwriteExistingDomain to only overwrite the domain(s) being explored
    overwriteExistingDomain: boolean; // before exploring a domain, delete only THAT domain's rows from every per-site table, so a re-run overwrites its own previous results while other saved runs are kept; true by default
    clearClassifierCache: boolean;   // wipe authz_classifications too; false by default: classifications are a pure function of the key string, independent of site/run, so they're worth keeping forever
    demoPath: string;                // self-contained, HTTP-only demo DB (scripts/buildDemo.ts / runDemo.ts): one site's inputs + forged_requests cache, for a deterministic offline replay
    exportDemoAfterRun: boolean;     // env EXPORT_DEMO; after each site's analysis, refresh demoPath with that site's HTTP-detection snapshot (same as running scripts/buildDemo.ts). false by default
  };
  analysis: {
    maxConcurrentRequests: number; // bounds forged-request concurrency; mirrors RAPIDOR's config.js maxConcurrentRequests
    timeBetweenRequestsMs: number; // pacing after each forged request; mirrors RAPIDOR's config.js timeBetweenRequests
    // how many pages the client-routing phase probes on in parallel. Each candidate's pushState probe
    // + not-found screenshot mutate a page's live DOM, so they used to serialize on one shared page —
    // the dominant cost of a large analysis. A pool of this many pages (same authenticated context,
    // shared cookies) runs that many probes at once; near-linear speedup on that phase. Bounded: each
    // page is a real tab doing navigations/screenshots (RAM/CPU) and parallel probes mean more
    // concurrent traffic to the site, so this is deliberately modest, not maxed out.
    clientRoutingConcurrency: number;
    reportsDir: string;            // where each flagged finding's reproduction script lands: <reportsDir>/<site>/<findingId>.repro.ts
    // window the client-side-routing probe (checkClientSideRouting/checkClientSideRoutingForPath)
    // waits for a DOM mutation after a synthetic pushState+popstate. Three bounds (see
    // WAIT_DOM_IDLE_SRC in clientRouting.ts): `minWaitMs` is the floor (earliest a reaction may be
    // reported settled — gives a router redirect / multi-burst render time to manifest), `idleMs` is
    // the DOM-quiet settle, `maxWaitMs` is the ceiling. The ceiling guarantees termination on a page
    // that never goes quiet AND keeps watching for a FIRST mutation past the floor, so a render gated
    // on a slow network fetch (e.g. a lazily-loaded exercise/resource) is still caught instead of
    // reading as "did not react" the moment the floor elapses. A route that truly ignores the segment
    // rides to the ceiling and reports no reaction, so analysis never stalls.
    clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };
    // Ablation study: runs a second, independent analysis pass (AblationPipeline) alongside the
    // main one, candidate-generating ONLY from the JSON bodies of already-captured HTTP responses
    // -- no React state, no component siblings, no client-routing probes at all. Its findings land
    // in their own tables (ablation_vulnerabilities/ablation_stats, never vulnerabilities/
    // analysis_stats) so the two are always comparable, never mixed. Off by default: it doubles the
    // forged-request traffic against the site under test for a comparison most runs don't need.
    ablationMode: boolean;
    // candidate-generation guard: a URL segment whose value appears in MORE than this many
    // preindexed React nodes is treated as a generic keyword (a DOM tag/role/category word that
    // also happens to be a path segment — "svg", "grammar", "vocabulary"...), not a user-scoped
    // identifier, and is skipped. Real identifiers (objective/exercise/activity ids) appear only a
    // few tens of times, far below this, so nothing worth probing is lost; without it a single
    // generic word fans out to thousands of matches times every URL that shares it, which is what
    // made candidate generation take tens of minutes (and produced thousands of junk candidates).
    maxSegmentMatches: number;
    // per-site forge budget (main AND ablation): if candidate generation produces MORE than this many
    // distinct forge requests, the analysis is abandoned for that site and flagged infeasible instead of
    // dispatched. Guards against the combinatorial explosion of HTTP-JSON matching (promova's ablation
    // alone generates ~4.8M distinct GETs) — a memory bound (generation early-aborts here, never
    // materialising millions), a time bound (see the value's own note), and an ethical one (GET-only,
    // but millions of live requests is a DoS). The main pipeline is bounded by the React preindex and
    // rarely trips this; a site that does (promova's main generated ~12.5k before the volatile-param
    // dedup trimmed it) is a genuine outlier the budget is meant to catch.
    maxGeneratedRequests: number;
    // client-routing false-positive guard: when a candidate route has no decisive network signal,
    // its normalized DOM (text nodes + <img> src + element count, see analysis/domSnapshot.ts) is
    // compared against the app's own "not found" page (calibrated by rendering a garbage id in the
    // same slot). If no more than this fraction of text nodes differ AND the element count differs
    // by no more than this fraction, the route only rendered the not-found page — a false positive —
    // and the candidate is rejected.
    notFoundDomMaxDiff: number;
    // candidate-generation blacklist: a URL path segment whose VALUE (case-insensitive) is in this
    // list is never mutated. These are app-shell / section prefixes (an SPA's "/app", "/speak", ...
    // route roots), not user-scoped identifiers, so swapping one only navigates to another SECTION of
    // the app — which naturally renders a different DOM and so looks like a client-routing finding
    // (ejoy's /app -> /speak,/go,/website-directory false positives).
    segmentBlacklist: string[];
    // candidate-generation blacklist for QUERY PARAMS (by param NAME, case-insensitive): a pagination
    // or sorting control is not an object reference, so swapping it can never cross an authorization
    // boundary — it changes how MUCH of your own data you get, never WHOSE. Without this, busuu's
    // `notifications?limit=5` looked up the bare value "5" in the preindex, matched 77 unrelated nodes
    // (`$paddingCorrection`, `itemsCount`, `elements[4].id`, ...) and forged dozens of nonsense ids;
    // every forged response legitimately differed (a different page size), so no response or DOM guard
    // could ever reject them — 22 of busuu's 27 false positives came from this one param.
    // `maxSegmentMatches` is the wrong tool here (77 is far under the cap, and lowering it would drop
    // real identifiers that legitimately appear on many nodes). Path segments are never gated by this.
    paramBlacklist: string[];
    // client-routing stage-3 escalation: when the cheap pushState probe is inconclusive (the SPA did
    // not digest the swapped value — no DOM reaction, or it redirected away), allow a STRICT real page
    // load (page.goto) to decide, but ONLY for a high-suspicion candidate (its props diff already
    // crossed an authorization boundary, e.g. lock:false->true). This catches an app whose router
    // ignores a synthetic popstate for a sibling route (ejoy/Next.js) while re-imposing the pushState
    // gate's safety on the real load (a redirect-away or a failed capture is a REJECT). Kill switch for
    // regression bisection; leave on. See AnalysisPipeline.clientSideConfirmed / confirmByFullNavigation.
    clientRoutingFullNavigationEscalation: boolean;
    // total attempts (1 = no retry) for the STAGE-3 full-navigation escalation, the costly real-load
    // confirmation that decides for ejoy-class Next.js routes. Unlike the pushState probe it was single-
    // shot, so a one-off incomplete render (a fetch-gated lesson not finished loading) produced a false
    // NEGATIVE, flipping which paid siblings surface run-to-run. A retry on a FLAKY reject (capture
    // failed / inert / not-found — never an accept, never a deterministic redirect-away) recovers them.
    // Can only recover a finding, never lose one. Lower to 1 on a huge site if the 45-min budget is tight.
    clientRoutingEscalationAttempts: number;
    // Direction gate (assessDirection, NLI zero-shot polarity): reject a candidate whose entitlement props
    // say it is LESS restricted than its reference (`isFree: false -> true`) — a free sibling of a paid
    // resource the user legitimately reached (a free preview) is never a paid-content leak. Main AND
    // ablation. Kill switch for regression bisection: AUTHZ_DIRECTION_GATE=false.
    authzDirectionGate: boolean;
    // client-routing PATH coherence: a path candidate keeps the reference URL's query (spliceSegment
    // re-attaches it), so when the swapped identity is DUPLICATED in the url (ejoy's lesson
    // /courses/37/314/<id>?path=.../lessons/<id>/<hash>.json) the query copy goes stale. When on, the query
    // copy is rewritten from the SIBLING's own state (rewriteCorrelatedQuery) — forging the real sibling
    // url, incl. a leaked capability/hash; if the old value can't be reconciled that way the candidate is
    // dropped as incoherent (never probed on a query-stripped path — that only false-positived). Kill
    // switch; leave on. See evaluateClientRoutingPathCandidate.
    clientRoutingPathCoherence: boolean;
    // Negative sibling-group inference: after this many siblings of one group (same reference node, swap
    // path, authz keys) were rejected by a redirect-away to the SAME target, skip the rest of the group.
    // A paywall bounce is deterministic and uniform across structurally identical siblings (clozemaster:
    // 508 paid stories -> /pro). 0 = off (probe every sibling). See ClientSiblingGroups (analysis/clientSiblingGroups.ts).
    clientRoutingGroupRejectAfter: number;
    // Re-analysis hygiene: before recording a site's findings, delete that site's PREVIOUS rows in
    // `vulnerabilities` (clearSite) so the table always reflects the CURRENT engine's output, not the
    // union of every past run. Needed because VulnerabilityStore.record is INSERT OR IGNORE keyed by a
    // deterministic finding id: without this, a false positive the improved engine now correctly
    // rejects would stay in the table forever (its old row is never revisited). Only `vulnerabilities`
    // is cleared — never the crawler/extension capture tables (http_events / react_states /
    // preindexed_values / crawl_states), and never the forged_requests forge cache (shared with the
    // ablation). analysis_stats self-overwrites per site (ON CONFLICT(site)), so it needs no clear.
    // Default true;
    overwriteFindingsPerSite: boolean;
    // header NAMES (lowercased) whose value is session auth material (a bearer token etc.). When a
    // re-analysis run re-authenticates (scripts/refreshAuth.ts), these are the headers harvested fresh
    // at t2 and overlaid onto every forged request (see analysis/authSession.ts). Cookie-auth sites need
    // no entry here — they ride the browser context's cookies. Default: just Authorization.
    volatileAuthHeaders: string[];
  };
  lightweight: LightweightConfig;
  extension?: ExtensionConfig;  // Chrome extension to load (optional)
  debugNoCrawling: boolean;     // opens the browser on the URL and waits for the user to close it, without exploring (manual login)
  userDataDir?: string;        // persistent browser profile (optional): cookies and storage survive across runs
  extraApiDomains: string[];   // backend domains to treat as first-party even though they don't share a base domain with startUrl (e.g. a CloudFront/API Gateway backend)
}

export const config: Readonly<CrawlConfig> = Object.freeze({
  startUrl: process.env.START_URL || 'https://example.com/',
  // START_URLS="https://a.com,https://b.com" (comma and/or newline separated, quoted in .env if on several lines), or fill the array here: replaces startUrl in `npm start`
  startUrls: (process.env.START_URLS || '').split(/[\s,]+/).filter(Boolean),
  maxDepth: process.env.MAX_DEPTH ? Number(process.env.MAX_DEPTH) : 4,
  // on by default (big sites waste the budget on nav otherwise)
  randomizeClickOrder: true,
  maxStates: 500,
  // a landing page's interstitial (cookie/"welcome back" sheet) can appear on one reload and not the
  // next, covering the target: retry a missed (state,element) a few times across landings before
  // giving up, so one unlucky reload never prunes a whole branch
  restoreAttempts: 4,
  maxDurationSecs: 2700, // 45min per phase (exploration, then analysis)
  concurrency: 1,
  tabsPerSite: 10,
  restoreDelayMs: 200,
  viewport: { width: 1920, height: 1080 },
  stability: { quietMs: 500, timeoutMs: 10_000, longRequestMs: 3_000 },
  rectGridPx: 4,
  includeUrlInFingerprint: true,
  // texts are normalized (digits -> '#'); on pages with random content
  text: { inElementId: true, inStateFingerprint: true, maxBlocks: 2000, maxBlockLength: 200 },
  actionTimeoutMs: 5_000,
  // PNG images of the states: not needed by the exploration, only to inspect it by eye
  screenshots: false,
  // HEADLESS=false npm start to see the browser
  headless: process.env.HEADLESS !== 'false',
  // browser locale and Accept-Language header: multilingual sites respond in English
  locale: 'en-US',
  // case-insensitive substring match on text, aria-label and href
  blocklist: ['logout', 'log out', 'sign out', 'quit', 'delete'],
  // skip clickables inside site chrome so exploration focuses on the main content; set to [] to explore everything
  ignoreClickablesWithin: ['nav', 'footer'],
  // allowlist of href schemes that stay in the browser; links to any other scheme (mailto:, tel:, sms:,
  // webcal:, zoommtg:, app deep-links) are both discarded as clickables and blocked at click time
  allowedLinkSchemes: DEFAULT_ALLOWED_LINK_SCHEMES,
  // close blocking modals (Escape, then an explicit close control) before capturing a state
  dismissOverlays: true,
  // single SQLite file every store
  // DB_CLEAR_ON_START=true wipes every site's rows; by default only the explored domain is overwritten
  db: {
    path: 'storage/crawler.db',
    clearOnStart: process.env.DB_CLEAR_ON_START === 'true',
    overwriteExistingDomain: process.env.OVERWRITE_EXISTING_DOMAIN !== 'false',
    clearClassifierCache: false,
    demoPath: 'demo/crawler.db',
    exportDemoAfterRun: process.env.EXPORT_DEMO === 'true',
  },
  // server-side IDOR analysis (preindex/match/forge/evaluate), ported from RAPIDOR's full-mode pipeline
  analysis: {
    maxConcurrentRequests: 3,
    timeBetweenRequestsMs: 250,
    clientRoutingConcurrency: 8,
    reportsDir: 'reports',
    clientRoutingProbe: { minWaitMs: 1_000, idleMs: 300, maxWaitMs: 3_000 },
    // ABLATION_MODE=true npm start to turn it on from the shell instead of editing this file
    ablationMode: process.env.ABLATION_MODE === 'true',
    // a value in more than this many preindexed nodes is a generic keyword, not an identifier: skipped
    maxSegmentMatches: 300,
    // per-site forge budget: above this, the analysis is abandoned as infeasible (see the field doc).
    // Kept loosely aligned with the pacing so a feasible site fits a ~45-min per-site time budget:
    // maxGeneratedRequests x timeBetweenRequestsMs / maxConcurrentRequests ≈ 10000 x 250ms / 3 ≈ 14 min
    // of pacing (roughly double with network time). Adjust the three together, by eye, if pacing changes.
    maxGeneratedRequests: 10_000,
    // <= 5% of text nodes (and of elements) differing from the calibrated not-found page => the
    // candidate IS the not-found page. A real resource's page differs in most of its content.
    notFoundDomMaxDiff: 0.05,
    // app-shell/section prefixes, not identifiers: mutating them only switches app section (FPs).
    segmentBlacklist: ['app'],
    // pagination/sorting controls, not object references: swapping one changes how much of your own
    // data you get, never whose, so a differing response is expected and proves nothing.
    // matched by exact name AND by token (see paramNameBlacklisted): `max`/`min` here also drop
    // `maxLevel`/`minScore`; keep entries to bound/pagination words (a token like `order` would also
    // drop `orderId`).
    paramBlacklist: [
      'limit', 'offset', 'page', 'per_page', 'perpage', 'page_size', 'pagesize',
      'size', 'count', 'skip', 'take', 'sort', 'order', 'order_by', 'orderby',
      'depth', 'max', 'min',
      // Timezone params select the response's REPRESENTATION (how times are rendered), not WHOSE
      // resource it is — like a locale/pagination param, swapping one returns the same resource and
      // no content guard can reject the difference. duolingo's `tzoffset=1` sat on ~every endpoint and
      // forged thousands of nonsense offsets. Non-id; no reference-site TP uses one.
      'tzoffset', 'tz', 'timezone', 'utcoffset', 'timezoneoffset',
    ],
    // strict real-navigation escalation for high-suspicion candidates the cheap pushState probe missed.
    clientRoutingFullNavigationEscalation: true,
    // 2 = one retry of the stage-3 escalation on a flaky reject (reduces ejoy's run-to-run sibling flapping).
    clientRoutingEscalationAttempts: 2,
    authzDirectionGate: process.env.AUTHZ_DIRECTION_GATE !== 'false',
    clientRoutingPathCoherence: true,
    clientRoutingGroupRejectAfter: 3,
    overwriteFindingsPerSite: true,
    // AUTH_HEADERS=x-auth-token,authorization to override from the shell
    volatileAuthHeaders: process.env.AUTH_HEADERS?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) ?? ['authorization'],
  },
  // USER_DATA_DIR enables a persistent profile (~ and $HOME are expanded); when unset, a temporary profile is used
  userDataDir: process.env.USER_DATA_DIR ? expandHome({ value: process.env.USER_DATA_DIR }) : undefined,
  // EXTRA_API_DOMAINS="api.example.com,d123.cloudfront.net" (comma-separated) for backends hosted off the app's own base domain
  extraApiDomains: (process.env.EXTRA_API_DOMAINS || 'd3vu3jnt00sinm.cloudfront.net').split(',').map((domain) => domain.trim()).filter(Boolean),
  // DEBUG_NO_CRAWLING=true: no exploration, the browser stays open until you close it (to log in manually into the persistent profile; use with HEADLESS=false)
  debugNoCrawling: process.env.DEBUG_NO_CRAWLING === 'true',
  // LIGHTWEIGHT=false turns it off; never active with DEBUG_NO_CRAWLING (manual login needs the real page)
  lightweight: {
    enabled: process.env.DEBUG_NO_CRAWLING !== 'true' && process.env.LIGHTWEIGHT !== 'false',
    blockImages: true,
    blockFonts: true,
    blockedUrlPatterns: [
      '*://www.google-analytics.com/*', '*://*.googletagmanager.com/*', '*://*.doubleclick.net/*',
      '*://connect.facebook.net/*', '*://*.hotjar.com/*', '*://*.clarity.ms/*', '*://*.segment.io/*',
      '*://*.segment.com/*', '*://*.fullstory.com/*',
    ],
    cacheStaticAssets: true,
    assetCacheMaxMb: 150,
  },
  // browser extension details: this is launched with the Chromium browser
  extension: {
    path: 'browser_extension/react-instrumented', // path to the extension (unpacked)
    calls: [
      // [called on start] clears the extension's shared IndexedDB once, so a run on a persistent profile starts clean
      { fn: '__RAPIDOR__reset', when: 'start' },
      // [called before an action on the page] force-settle and wait until React state has been captured for it
      // (otherwise a fast reload would navigate away before ReactStateHooks can read it)
      { fn: '__RAPIDOR__waitToAction', when: 'before-action', args: [{ timeoutMs: 3000 }] },
      // [called after an action on the page] settle again so the clicked-into state is ready the moment ReactStateHooks reads it
      { fn: '__RAPIDOR__waitToAction', when: 'after-action', args: [{ timeoutMs: 8000 }] },
      // [called on analysis end] kept only to surface extension runtime errors to the crawler log
      { fn: '__RAPIDOR__getData', when: 'end' },
    ],
  },
} as const satisfies CrawlConfig);
