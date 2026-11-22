# RAPIDOR


RAPIDOR is a fully automated solution for detecting **IDOR/BOLA vulnerabilities** in React applications, in cases where unauthorized users gain access to paid resources (subscription bypass).

The tool takes advantage of a SPA crawler that explores a site by **clicking**, not just by following links. For each site, it builds a `state → click → state` graph, where a *state* is a distinct UI configuration (page, open menu, modal, selected tab...).

Alongside exploration, it loads an instrumeted React DevTools browser extension, to capture React component state as it clicks around, correlates that state with the HTTP traffic it observes, and — entirely server-side, in this Node process — forges alternative requests (and, for SPA routes that never hit the network, replays the page's own client-side routing) to see whether a different user's data leaks out.

Based on [Crawlee](https://crawlee.dev) and [Playwright](https://playwright.dev) (Chromium), written in TypeScript.

## Quick Start

```bash
npm install
npx playwright install chromium

# explores a single site
START_URL=https://example.com npm start

# same as above, with the browser window visible
HEADLESS=false npm start

# log in by hand once, saving cookies/tokens into a persistent browser profile (see Authentication below)
USER_DATA_DIR=$HOME/.crawler-profile DEBUG_NO_CRAWLING=true HEADLESS=false npm start

# crawl states/edges + IDOR findings + per-site stats from the last run(s), straight from SQLite
npm run stats

# tests (run with a real browser)
npm test

# execute TS type check
npm run typecheck
```

Everything the crawler produces — crawl states/edges, HTTP traffic, React state, IDOR findings, stats — lives in one SQLite file, `storage/crawler.db` — see [Output](#output).

## How It Works

Exploration is a **Depth-First Search (DFS)** over UI states:

1. the page loads and waits until it is **stable**;
2. the state is **captured**: clickable elements, visible texts, URL → an ID (fingerprint);
3. for each unattempted clickable element: the starting state is **restored**,
a **click** is performed, it waits for stability, and the resulting state is captured;
4. the edge is added to the graph; if the state is new, it is saved and recursed upon.

The visit stops when reaching `maxDepth`, `maxStates`, or `maxDurationSecs`:
termination is guaranteed even on very rich UIs. An error on an element only costs its own branch.

While this happens, three more things run unconditionally for every site (see [IDOR analysis](docs/analysis.md)):

* **`NetworkObserver`** captures same-site `fetch`/XHR traffic directly via Playwright (`page.on('requestfinished'/'requestfailed')`), deduplicated into `http_events`.
* **`ReactStateHooks`** reads `window.__RAPIDOR__getLatestState()` (exposed by the RAPIDOR extension, see below) after each action and persists it into `react_states`, immediately re-indexing the interesting prop values it contains (`preindexed_values`). A repeated capture of the same `(url, fingerprint)` refreshes the stored graph (so the preindex never points at node IDs missing from it), and capture outcomes (captured / no graph / failed) are counted and logged. `AnalysisPipeline` warns when a crawled URL has no React state at all.
* **`AnalysisPipeline`** runs once per site, at the end of its exploration: for every captured HTTP event it looks for a sibling React component instance with a different value at the same prop path, forges the corresponding request, and flags+persists a vulnerability (`vulnerabilities`) when the response looks authorized and the differing props are themselves authorization-relevant.

### Main Components

| Module | Role |
| --- | --- |
| [src/core/DfsExplorer.ts](src/core/DfsExplorer.ts) | Exploration algorithm and limits. Depends only on the interfaces in [src/core/interfaces.ts](src/core/interfaces.ts). |
| [src/buildExplorer.ts](src/buildExplorer.ts) | Composition root: the single point that instantiates concrete classes. |
| [src/main.ts](src/main.ts) | Configures `PlaywrightCrawler` (browser, language, viewport, concurrency) and wires up the SQLite stores shared across the whole run. |
| [src/browser/StabilityWaiter.ts](src/browser/StabilityWaiter.ts) | Waits for DOM, network, and finished animations to settle for `quietMs`. Ignores websockets, long-polling, and infinite animations. |
| [src/extraction/ClickableExtractor.ts](src/extraction/ClickableExtractor.ts) | Collects visible clickable elements and discards those in the `blocklist`. Form fields (`input`/`select`/`textarea`) are never clickables, however they are detected (semantic selector, `onClick` prop, `cursor: pointer`): the crawler never fills forms, and this also avoids triggering a native file/date picker from inside a payment modal. |
| [src/browser/ActionExecutor.ts](src/browser/ActionExecutor.ts) | Clicks the target element; also guards every page against alert/confirm dialogs, popups, off-domain navigation, and downloads (cancelled, never written to disk — only logged, since the site under test is untrusted — the triggering request itself is still followed/analysed like any other). |
| [src/extraction/SelectorBuilder.ts](src/extraction/SelectorBuilder.ts) | Gives each element a stable ID: tag + rounded rectangle (+ text), never DOM IDs or classes. |
| [src/state/StateFingerprinter.ts](src/state/StateFingerprinter.ts) | State ID: hash of the sorted set of clickables, plus URL and texts if active. |
| [src/browser/StateNavigator.ts](src/browser/StateNavigator.ts) | Restores a state by reloading the root and replaying the click path, accepting it when the route matches and the target element is present (tolerant of a non-deterministic UI). A miss — e.g. an intermittent interstitial covering the target — is retried across later landings up to `restoreAttempts` before the pair is given up, so one unlucky reload never prunes a whole branch. |
| [src/browser/ActionExecutor.ts](src/browser/ActionExecutor.ts) | Clicks at the element's coordinates. Closes dialogs and popups, blocks navigation to other origins. |
| [src/state/StateStore.ts](src/state/StateStore.ts), [src/state/StateGraph.ts](src/state/StateGraph.ts) | Seen states (in-memory) and the per-(state, element) attempt lifecycle (`claim`/retry/done); persist full records via [src/db/CrawlStateStore.ts](src/db/CrawlStateStore.ts)/[src/db/CrawlEdgeStore.ts](src/db/CrawlEdgeStore.ts). |
| [src/browser/NetworkObserver.ts](src/browser/NetworkObserver.ts) | Shadow capture of same-site HTTP traffic (see above), persisted via [src/db/HttpEventStore.ts](src/db/HttpEventStore.ts). |
| [src/browser/ReactStateHooks.ts](src/browser/ReactStateHooks.ts) | Reads and persists RAPIDOR's React state ([src/db/ReactStateStore.ts](src/db/ReactStateStore.ts)) and pre-indexes it ([src/db/PreindexedValueStore.ts](src/db/PreindexedValueStore.ts)). |
| [src/analysis/AnalysisPipeline.ts](src/analysis/AnalysisPipeline.ts) | Entry point of the preindex → match → forge → evaluate chain: generates and dispatches candidates, records stats. The work sits in its collaborators — [candidateGenerator.ts](src/analysis/candidateGenerator.ts), [candidateEvaluator.ts](src/analysis/candidateEvaluator.ts), [clientRoutingVerifier.ts](src/analysis/clientRoutingVerifier.ts), [recheckRunner.ts](src/analysis/recheckRunner.ts), [PagePool.ts](src/analysis/PagePool.ts), [findings.ts](src/analysis/findings.ts). See [IDOR analysis](docs/analysis.md). |
| [scripts/stats.ts](scripts/stats.ts) | Prints per-site crawl/IDOR stats, cross-site averages, and flagged findings from `storage/crawler.db`. |
| [src/analysis/reproductionScript.ts](src/analysis/reproductionScript.ts) | Generates a runnable `.repro.ts` for every flagged finding; see [Reproduction scripts](docs/analysis.md#reproduction-scripts). |
| [scripts/runAnalysisFromDb.ts](scripts/runAnalysisFromDb.ts), [scripts/runAblationFromDb.ts](scripts/runAblationFromDb.ts) | Re-run the main / ablation analysis on a site's already-captured data in `storage/crawler.db` (no new exploration, nothing cleared); `SITE` is derived from the `START_URL` argument. |
| [scripts/recheckFindings.ts](scripts/recheckFindings.ts) | Re-examines only the findings already in `vulnerabilities` for one site with the current engine (forge from cache / probe + DOM guards) and prints which would still be flagged and why the others are dropped. Writes nothing: the stored findings stay the baseline. Fast regression check after a change to the decision logic (it cannot find new findings: use `runAnalysisFromDb` for that). |
| [scripts/compareAblation.ts](scripts/compareAblation.ts) | Compares the main pipeline against the ablation pipeline over `analysis_stats`/`ablation_stats`; see [IDOR analysis](docs/analysis.md). |
| [scripts/debugClientRoutingFlakiness.ts](scripts/debugClientRoutingFlakiness.ts) | Diagnostic: reliability of the client-routing pushState+popstate DOM-mutation probe, run repeatedly against the same candidate. |

### Design Choices

* **Identity without IDs or classes.** Framework-generated IDs and classes change on every load. Therefore, elements and states are identified by geometry and text. The viewport is fixed and Crawlee's random fingerprinting is disabled.
* **One Crawlee request per site.** All exploration for a site lives in a single request handler without retries: a retry would restart from scratch, duplicating states.
* **Isolated contexts.** Each site has its own incognito page, so cookies and storage do not mix. Multiple sites can run in parallel using `concurrency`.
* **Several tabs per site.** With `tabsPerSite > 1` each tab runs its own depth-first search over the shared state store and graph. `claim()` is synchronous, so the first tab to reach a (state, element) pair claims it exclusively; a tab that runs out of work picks up still-claimable elements from other tabs' states. Exploration is therefore not deterministic. Tabs need the persistent browser context (as with the extension or a saved profile).
* **HTTP cache stays on.** Playwright's `page.route` disables Chromium's HTTP cache, so every restore would re-download all scripts and styles. External navigations are blocked through a CDP `Fetch` interception limited to documents instead, and the browser cache works as for a normal user.
* **Always in English.** The browser declares the `en-US` locale (both `navigator.language` and the `Accept-Language` header). Multilingual sites therefore respond in English, and saved texts remain comparable with the `blocklist`. Exceptions remain possible for sites that choose the language based on IP.
* **SQLite for everything the crawler produces.** Crawl states and edges (screenshots included, as BLOBs), captured HTTP events, React state, pre-indexed values, flagged vulnerabilities, per-site stats, and the authorization classifier's cache all live in one file, `storage/crawler.db`. It is the single source of truth: no artifact dump duplicates it, and later runs can query/average across sites trivially.

## Configuration

Everything is in [src/config.ts](src/config.ts). The most important settings:

| Key | Default | Description |
| --- | --- | --- |
| `startUrl` | `$START_URL` or `https://example.com` | Site to explore with `npm start`. Protocol is required. |
| `startUrls` | `$START_URLS` (comma- or newline-separated) or `[]` | Several sites explored in one `npm start` run. When empty, only `startUrl` is explored. |
| `maxDepth` / `maxStates` / `maxDurationSecs` | `4` / `500` / `2700` | Exploration limits. `maxStates` applies to each tab. `maxDurationSecs` is a per-phase budget: the exploration gets it, then the end-of-crawl analysis gets it again (the request handler is sized for both). `maxDepth` defaults to `4` for the intended workflow — a single, manually-chosen target page explored *deeply* (with `ignoreClickablesWithin` keeping the crawler on it), since a lesson/exercise flow sits several clicks down; `MAX_DEPTH=2` for a quick shallow run. |
| `restoreAttempts` | `4` | Times a `(state, element)` pair is retried across later landings before being given up: a state restore can miss when an intermittent interstitial covers the target, and this stops one unlucky reload from pruning a whole branch. |
| `randomizeClickOrder` | `true` | Try a state's clickables in random order instead of capture (DOM/reading) order. Capture order puts nav/header chrome first and a budget-bounded DFS drains it before reaching the page-centre buttons; randomizing samples the whole set so central controls get an early chance. Per-tab local shuffle (no cross-tab coordination). Makes a crawl non-repeatable. |
| `ignoreClickablesWithin` | `['nav', 'footer']` | CSS selectors whose descendants are never treated as clickable — chrome the crawler should not click (navigation, footer), so a single target page stays the page under exploration instead of navigating away. **Keep `header` OUT**: these apps (busuu) render primary content, including lesson cards, inside `<header>`, so ignoring it would make the real targets unreachable. `[]` explores everything. |
| `concurrency` | `1` | Sites explored in parallel. |
| `tabsPerSite` | `5` | Tabs exploring the same site together (same browser context: cookies and storage are shared). Work is split automatically and a state is never saved twice. Keep in sync with RAPIDOR's own `maxStateSnapshots`. |
| `restoreDelayMs` | `150` | Minimum gap between two page reloads of the same site, across all its tabs. |
| `viewport` | `1920×1080` | Fixed: rectangles, and thus IDs, depend on it. |
| `stability` | `500 / 10000 / 3000 ms` | Required silence, maximum wait ceiling, threshold beyond which an open request is ignored. |
| `rectGridPx` | `4` | Rectangle rounding: absorbs small layout shifts. |
| `includeUrlInFingerprint` | `true` | Two routes with the same layout remain distinct states. |
| `text.inStateFingerprint` | `true` | Includes visible texts in the state ID. Should be disabled on pages with random content (carousels, recommendations). |
| `headless` | `true` | `HEADLESS=false` opens the browser window to watch the crawler in action. |
| `lightweight` | enabled while exploring | Cheaper browsing (`LIGHTWEIGHT=false` turns it off; never active with `DEBUG_NO_CRAWLING`): animations/transitions shortened to 1ms (kept, so modals still get their `animationend`), paint-only CSS dropped (shadows, filters, blur — geometry untouched, so fingerprints are unaffected), images/fonts/analytics not loaded, and scripts/stylesheets kept in an in-memory cache so restoring a state does not download them again (`cacheStaticAssets`; fetch/XHR and the page document always go to the server). |
| `locale` | `en-US` | Language requested from sites. |
| `screenshots` | `false` | Saves a PNG of each state. Useful only for visually inspecting results. |
| `blocklist` | `logout, log out, sign out, quit, delete` | Substrings (case-insensitive) of text, `aria-label`, or `href` of elements that should never be clicked. |
| `allowedLinkSchemes` | `http, https, javascript, about` | Allowlist of `href` URL schemes that stay inside the browser. A link to any other scheme (`mailto:`, `tel:`, `sms:`, `webcal:`, `zoommtg:`, custom app deep-links) is both dropped as a clickable and cancelled at click time, so the OS never launches an external app mid-exploration. Schemeless links (`/path`, `#anchor`, `?q`) are always kept. |
| `db.path` | `storage/crawler.db` | Shared SQLite file for the whole run — every table the crawler writes. |
| `db.clearOnStart` | `true` | Wipes `crawl_states`/`crawl_edges`/`http_events`/`react_states`/`preindexed_values`/`vulnerabilities`/`analysis_stats`/`ablation_vulnerabilities`/`ablation_stats`/`forged_requests` once at the start of the run. |
| `db.clearClassifierCache` | `false` | Wipes `authz_classifications` too. Off by default: a classification is a pure function of the key string, independent of site or run, so it is worth keeping forever. |
| `analysis.maxConcurrentRequests` / `analysis.timeBetweenRequestsMs` | `3` / `250` | Bound and pace forged requests. |
| `analysis.reportsDir` | `reports` | Where the reproduction script of each flagged finding is written (`<reportsDir>/<site>/<findingId>.repro.ts`, gitignored). |
| `analysis.clientRoutingProbe` | `1000 / 300 / 3000 ms` | The client-side-routing probe's (`checkClientSideRouting`/`checkClientSideRoutingForPath`) DOM-settle window after a synthetic `pushState`+`popstate`: floor (earliest a reaction is reported settled) / DOM-quiet settle / ceiling. The window is network-aware — it will not settle while a fetch/XHR the route fired is still in flight (so a render gated on a data request is caught) — and the ceiling bounds everything. |
| `analysis.clientRoutingConcurrency` | `8` | How many pages the client-routing phase probes on in parallel. Each candidate's probe + DOM snapshots mutate a page's live DOM, so they run one-per-page across a pool of this many pages (same authenticated context); near-linear speedup on that phase. |
| `analysis.maxSegmentMatches` | `300` | A URL segment whose value appears in more than this many preindexed nodes is a generic keyword, not an identifier, and is skipped in candidate generation. |
| `analysis.notFoundDomMaxDiff` | `0.05` | A client-routing candidate whose normalized DOM (text nodes, `<img>` src, element count) differs from the calibrated not-found page by no more than this fraction of text nodes **and** of elements is the not-found page itself, and is rejected. See [docs/analysis.md](docs/analysis.md) (DOM content guards). |
| `analysis.segmentBlacklist` | `['app']` | Path-segment values never mutated during candidate generation, in either direction. App-shell/section route roots (`/app`, `/speak`, …) are not user-scoped ids — swapping one only switches app section (a different DOM that masquerades as a finding). Query-param values are never gated by this one. |
| `analysis.paramBlacklist` | `limit`, `offset`, `page`, `per_page`, `size`, `count`, `skip`, `take`, `sort`, `order`, … | Query params (by **name**, case-insensitive) never mutated. A pagination or sorting control is not an object reference: swapping it changes how *much* of your own data returns, never *whose*, so the response differs legitimately and no guard can reject it. Path segments are never gated by this. |
| `analysis.clientRoutingFullNavigationEscalation` | `true` | Allows `clientSideConfirmed`'s strict stage-3 real-navigation (`page.goto`) escalation: when the cheap pushState probe is inconclusive (the SPA did not digest the swapped value), a high-suspicion candidate (its props diff already crossed an authorization boundary) gets one real load, which re-imposes the probe gate's safety (a redirect-away or failed capture is rejected). Catches client-trusting routes a synthetic `popstate` can't reach (ejoy/Next.js). Kill switch for regression bisection. |
| `analysis.clientRoutingEscalationAttempts` | `2` | Total attempts (1 = no retry) for the stage-3 full-navigation escalation above. A single real load of a fetch-gated route (ejoy's lessons load their content by id over XHR) can snapshot an *incomplete* render and read as a false negative, flipping which paid siblings surface run-to-run. A retry on a **flaky** reject (capture failed / inert / not-found — never an accept, never a deterministic redirect-away) recovers them; it can only ever recover a finding, never lose one. Lower to `1` on a very large site if the per-phase budget is tight. |
| `analysis.ablationMode` | `false` (`$ABLATION_MODE`) | Runs the [ablation study](docs/analysis.md#ablation-study-http-json-only) alongside the main analysis. Off by default: it roughly doubles the forged-request traffic against the site under test. |
| `analysis.overwriteFindingsPerSite` | `true` (set to `false` to opt out) | Before recording a site's findings, deletes that site's previous `vulnerabilities` rows so the table reflects the **current** engine's output, not the union of every past run. Needed because `VulnerabilityStore.record` is `INSERT OR IGNORE` on a deterministic finding id: without this, a false positive the improved engine now rejects would linger from an older run. Lets you re-run `runAnalysisFromDb.ts` to iterate on the analysis over already-captured data and always get correct final results. Clears **only** `vulnerabilities` — never the capture tables (`http_events`/`react_states`/`preindexed_values`/`crawl_states`) or the shared `forged_requests` forge cache; `analysis_stats` self-overwrites per site. |

## Authentication (protected areas)

Log in **once by hand** into a persistent Chromium profile, and every later run reuses it:

```bash
# opens a real, visible browser on startUrl and waits for you to close it — log in there
USER_DATA_DIR=$HOME/.crawler-profile DEBUG_NO_CRAWLING=true HEADLESS=false START_URL=https://example.com/login npm start

# later runs just point at the same profile; cookies/local storage/tokens are already there
USER_DATA_DIR=$HOME/.crawler-profile START_URL=https://example.com/dashboard npm start
```

* `userDataDir` requires `concurrency: 1` (a profile cannot be shared between browsers running at once).
* Do not point it at the Chrome profile you actually use day-to-day: it gets locked, and Chrome 136+ forbids automating it anyway. Use a dedicated folder (or a copy of one).
* `debugNoCrawling: true` (`DEBUG_NO_CRAWLING=true`) skips exploration entirely: the browser opens on `startUrl` and stays open until you close it — exactly the window you need to log in by hand.

### Analysing later, after the session expired (re-auth, no re-crawl)

Exploration (t1) and analysis (t2) can be hours apart, but the analysis forges live requests and needs a valid session. [scripts/runAnalysisFromDb.ts](scripts/runAnalysisFromDb.ts) checks this up front with an **entry-point gate**: it re-renders the `START_URL` (an internal authenticated page) and compares its live React fingerprint to the one captured at crawl time. A match means the session is alive; a mismatch means the profile was redirected to login (expired). The gate is on a resource you are *entitled* to, so it is never confused by a forged request's own `403` (which, for a paid-resource IDOR, is the correct "no leak" answer — and so never triggers re-authentication).

If the gate reports **EXPIRED**, re-authenticate without re-crawling:

```bash
# opens the profile headed, waits for you to log in, then stores fresh credentials for that site
USER_DATA_DIR=$HOME/.crawler-profile npx tsx scripts/refreshAuth.ts https://example.com/dashboard

# the forge now overlays the refreshed session (fresh cookies / bearer token)
USER_DATA_DIR=$HOME/.crawler-profile npx tsx scripts/runAnalysisFromDb.ts https://example.com/dashboard
```

`refreshAuth` strips the stale captured `Cookie` so cookie-auth sites ride the profile's fresh cookies, and harvests the fresh header-auth (`analysis.volatileAuthHeaders`, default `authorization`) for bearer sites — both stored per-site in `session_auth` (never wiped by `clearOnStart`) and clears that site's `forged_requests` cache so no response forged under the dead session is reused. Two fresh profiles are assumed to carry the same privileges.

## Browser extension (RAPIDOR)

The crawler loads RAPIDOR's unpacked Chrome extension to read React component state as it explores. It runs in RAPIDOR's own `mode: 'minimal'` (set in its `config.js`): the extension only exposes `window.__RAPIDOR__getLatestState()` (Bridge + StateManager) — HTTP tracking and IDOR analysis both happen in this crawler instead (see [IDOR analysis](docs/analysis.md)), not in the extension.

Declared in [src/config.ts](src/config.ts):

```ts
extension: {
  path: '../rapidor/packages/react-devtools-extensions/chrome/build/unpacked', // folder containing manifest.json
  calls: [
    // clears the extension's shared IndexedDB once, so a run on a persistent profile starts clean
    { fn: '__RAPIDOR__reset', when: 'start' },
    // before/after each click: force-settle so the crawler never reads a half-updated React tree
    { fn: '__RAPIDOR__waitToAction', when: 'before-action', args: [{ timeoutMs: 3000 }] },
    { fn: '__RAPIDOR__waitToAction', when: 'after-action', args: [{ timeoutMs: 8000 }] },
    // kept only to surface extension runtime errors to the crawler log
    { fn: '__RAPIDOR__getData', when: 'end' },
  ],
},
```

* `start`: before the first state is captured. `before-action`/`after-action`: around every click on a clickable element. `end`: after the last state (also when the exploration stops on an error), on the page as it was left by the last click.
* The functions must live in the page's `MAIN` world: declare the content script with `"world": "MAIN"` in `manifest.json`, otherwise `window` does not see them.
* A missing function (waits up to `actionTimeoutMs`) or a failing call logs a warning and never stops the crawl.
* With an extension, each site gets its own Chromium with a temporary profile (isolation is the same as incognito, but memory use is higher). Headless uses Chromium's new headless mode (`npx playwright install chromium`).
* After editing RAPIDOR's own source, rebuild it before the crawler picks it up: `cd ../rapidor/packages/react-devtools-extensions && NODE_ENV=development node ./chrome/build`.

## IDOR analysis (authz/IDOR detection)

At the end of each site's exploration, `AnalysisPipeline` correlates captured React state with captured HTTP traffic: preindex → segment extraction → match finding → GET-only request forging → response evaluation (with an embedding-based authorization classifier), plus a client-side-routing fallback for values an SPA only reads client-side. Every flagged finding gets a standalone reproduction script under `reports/`.

Full details — pipeline steps, client-routing oracle, reproduction scripts and the HTTP-JSON-only ablation study — are in **[docs/analysis.md](docs/analysis.md)**.

## Output

Everything the crawler produces lives in one SQLite file, `db.path` (default `storage/crawler.db`) — there are no JSON artifacts anywhere, and nothing else to look at:

* `crawl_states` — one row per distinct UI state (id, URL, depth, click path, clickables, visible texts), keyed by `(site, id)`. The screenshot, when `screenshots` is enabled, is a BLOB column on the same row rather than a separate file.
* `crawl_edges` — the click graph: one row per edge (`from`, `to`, action type/target/text/selector).
* `http_events`, `react_states`, `preindexed_values`, `vulnerabilities`, `analysis_stats`, `authz_classifications` — everything from [IDOR analysis](docs/analysis.md).
* `ablation_vulnerabilities`, `ablation_stats` — the [ablation study](docs/analysis.md#ablation-study-http-json-only)'s own findings/stats, only ever written when `analysis.ablationMode` is on. `forged_requests` — the cache shared between the main pipeline and the ablation, so the same candidate is never forged twice.

The only files written outside the database are the generated [reproduction scripts](docs/analysis.md#reproduction-scripts) under `analysis.reportsDir` (`reports/`).

Crawlee's own bookkeeping (request queue, key-value store) stays separate, under `storage/{datasets,key_value_stores,request_queues}`, and is cleared at the start of each run.

## Statistics

```bash
npm run stats                              # per-site crawl + IDOR stats, cross-site averages, flagged vulnerabilities
npm run stats -- --db storage/other-run.db # or any other SQLite file in that shape
npm run paper-stats                        # paper-support numbers: per-app table + cross-app mean/median/mode + Fig. 4 matrix, and CSVs under reports/
```

`npm run compare-ablation` (same `--db` flag) compares these against the [ablation study](docs/analysis.md#ablation-study-http-json-only)'s own tables, when `analysis.ablationMode` was on for that run.

`npm run paper-stats` reads `analysis_stats` + `vulnerabilities` and prints one row per application (the split counts — unique HTTP events, HTTP forges vs client-routing probes, findings per detection class, clickables per state mean/median, exploration/compute/wait/analysis times) plus a cross-application mean/median/mode for every metric, and the identifier-position × value-type matrix. It writes `reports/paper_per_app.csv` and `reports/paper_id_location.csv` for the plots. The split columns are populated by runs of the current engine; to backfill a site captured earlier without re-crawling, re-run `npx tsx scripts/runAnalysisFromDb.ts <START_URL>` (the Fig. 4 matrix is derived from the finding URLs, so it works on older findings too).

## Reproducible demo (offline, deterministic)

The analysis is **live** — the HTTP path forges requests against the real server and the client-routing probe drives the real app — so its results can change over time. For reproducibility, a frozen snapshot of one site's data lets anyone re-derive the **HTTP** findings deterministically and offline, with no crawl and no authenticated session:

```bash
npm run build-demo -- https://www.busuu.com/dashboard   # storage/crawler.db -> demo/crawler.db (one site's HTTP inputs + recorded responses)
npm run run-demo   -- https://www.busuu.com/dashboard   # replay the real detection offline from demo/crawler.db (no browser, no network)
```

Every forged request is served from the snapshot's recorded cache (a miss throws rather than hitting the network), and the live-only client-routing phase is skipped — so the demo is HTTP-only by construction. See **[demo/README.md](demo/README.md)** for the snapshot date, the expected findings, and why client-routing is not part of the offline replay. The demo DB is gitignored; the full datasets are published on Zenodo (DOI TBD).
