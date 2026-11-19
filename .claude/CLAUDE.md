# RAPIDOR

RAPIDOR runs **IDOR/BOLA detection** by crawling web apps (**clicking**, not just following links): it builds a `state → click → state` graph per site (DFS over UI states). It reads React component state through the a browser extension, correlates it with the observed HTTP traffic, then forges sibling-value GET requests and probes client-side routing.
Stack: TypeScript (ESM, `.js` import suffixes), Crawlee + Playwright (Chromium), better-sqlite3, `@huggingface/transformers`.

Docs (don't read them whole, grep the section you need):
- `README.md` (~210 lines): `## Configuration`, `## Output`, `## Browser extension`, `## Authentication`.
- `docs/analysis.md`: IDOR pipeline, client routing, reproduction scripts, ablation study.
- `docs/CHANGELOG-archive.md`: old entries, only for historical context.

## Commands
```bash
npm run typecheck                                   # tsc, run after every change
node --import tsx --test test/<Name>.test.ts        # one test file (real Chromium, slow); prefer this
npm test                                            # full suite (~230 tests, slow): only at the end
START_URL=https://x.com npm start                   # crawl one site (HEADLESS=false to watch it)
npx tsx scripts/runAnalysisFromDb.ts <START_URL>    # re-run analysis on data already in the DB, no new crawl
npx tsx scripts/recheckFindings.ts <START_URL>      # re-examine only the stored findings with the current engine (writes nothing): fast regression check
npm run stats                                       # per-site stats + findings from storage/crawler.db
npm run build-demo -- <START_URL>                   # snapshot one site's HTTP inputs into demo/crawler.db
npm run run-demo   -- <START_URL>                   # offline, deterministic, HTTP-only replay from demo/crawler.db (no browser/network)
```
To query data, use `sqlite3 storage/crawler.db` (read-only queries). Never `Read` the `.db` files.

## Code map (src/)
- `main.ts`: PlaywrightCrawler setup and the shared SQLite stores. `buildExplorer.ts` is the composition root, the only place that instantiates concrete classes.
- `config.ts`: every setting, overridable via env (`.env.example`).
- `core/`: `DfsExplorer` (algorithm and limits), `interfaces.ts` (all `I*` contracts), `types.ts`, `CompositeHooks`.
- `browser/`: Playwright interaction: `ActionExecutor`, `StabilityWaiter`, `StateNavigator` (restore = reload + replay the click path), `NetworkObserver` (→ `http_events`), `ReactStateHooks` (browser extension → `react_states` + preindex), `AnalysisHooks`/`AblationHooks` (run the analysis at the end of a site), `ExtensionCalls`, `lightweightMode`. `inPage/` holds code serialized into the page.
- `extraction/`: clickables and texts (`browser/` = code that runs inside the page).
- `state/`: fingerprint, capture, in-memory store and graph (claim/release per `(state, element)`).
- `analysis/`: IDOR pipeline, split into single-responsibility collaborators. `AnalysisPipeline.ts` is the **entry point only** (~280 lines): it loads a site's data, builds the history filter, generates + dispatches candidates, records stats, and exposes `runForSite`/`recheckFindings`. The work lives in `candidateGenerator.ts` (preindex → segments → matchFinder, pure), `candidateEvaluator.ts` (one candidate → finding: authz gate first, then requestForge/responseEvaluate and/or the client-routing check, then recording + `reproductionScript`), `clientRoutingVerifier.ts` (the whole DOM-verification subsystem behind `verifyQueryParam`/`verifyPathSegment`: probe + 3-stage cheap→expensive ladder + content guards), `recheckRunner.ts` (the regression-check entry point, writes nothing), `PagePool.ts` (browser page pool) and `findings.ts` (finding vocabulary: ids, URL canonical form). `AblationPipeline` + `jsonMatchFinder` are the HTTP-JSON-only variant. Generic helpers live in `src/utils/utils.ts`.
- `db/`: one `*Store.ts` per SQLite table; `openDatabase.ts` holds the schema.
- `scripts/`: CLIs (stats, compareAblation, run*FromDb, recheckFindings, buildDemo/runDemo, debug).
- `db/demoExport.ts`: copies one site's HTTP-detection inputs + `forged_requests` into `demo/crawler.db` for the offline demo (`AnalysisPipelineOptions.offline`). `demo/crawler.db` is gitignored (→ Zenodo).
- `test/`: `node:test`, one `<Module>.test.ts` per module; helpers in `test/helpers/` (`browser.ts`, `fakes.ts`).

## Do not read / ignore
`node_modules/`, `storage/` (SQLite, ~500MB), `reports/` (generated), `browser_extension/react-instrumented/` (minified build of a browser extension, rebuilt from its own repo: never edit it here). `TODO.md` holds the user's notes (in Italian).

## React instrumented (external extension)
Source: `/home/ncavalli/Desktop/rapidor-browser-extension/packages/react-devtools-{instrumentation,extensions}`. Its build must be copied into `browser_extension/react-instrumented`. Rebuild with: `cd ../rapidor-browser-extension/packages/react-devtools-extensions && NODE_ENV=development node ./chrome/build`. The crawler only uses `window.__RAPIDOR__*` (MAIN world).

## Rules
- TypeScript only. **Named parameters**: functions take a single destructured object (`function f({ a, b }: { a: string; b: number })`); callers pass `f({ a, b })`. Exceptions: interface methods already in `core/interfaces.ts` and trivial helpers (`sleep(ms)`).
- Code comments in English. Comments explain *why* (the existing style is discursive: keep it).
- Do NOT create git branches or switch branches without permission. Commit only when asked; message format: `[feature|fix|docs|chore|safety|config|debug] scope: summary`.
- Update `CHANGELOG.md` (in English) after every change: new entry **at the top**, under `# Changelog`, format `## YYYY-MM-DD HH:MM — Title` + a short paragraph + bullets (why, what changed, measured effect/regressions). Read only the first ~10 lines (`head`), never the whole file.
- Update the matching docs when you change behavior or config (`README.md` for exploration/config, `docs/analysis.md` for the IDOR analysis). When `CHANGELOG.md` grows past ~8 entries, move the oldest ones to the top of `docs/CHANGELOG-archive.md`.
- Safety: the analysis forges **GET only** (see `.claude/rules/analysis.md`). Never add state-changing requests against target sites.
- Maintainability: If a file has more than 500 lines of code, it's a "code smell" and may need refactoring. Suggest refactoring for these cases.
- Do not be verbose: comments are recommended for any code change but keep their content short (~2-3 lines at most)
