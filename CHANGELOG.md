# Changelog

Older entries: [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).

## 2026-11-19 — fix: NetworkObserver no longer buffers every captured request in memory (OOM on long crawls)

A long headed Promova crawl died with `JavaScript heap out of memory`. Cause: `NetworkObserver.handle()` pushed every same-site request — each with its response body (up to `maxBodyBytes`, default 200 KB) — into an in-memory `requests[]` that was never cleared and lived for the whole per-site exploration, *in addition to* persisting each one to SQLite. Nothing ever reads that array in production (only `stats` is consumed, for one log line; dedup is the store's job via `UNIQUE(site, fingerprint)` + `ON CONFLICT seen_count+1`, not the array's). On a site that loads ~140 requests per page, across a deep crawl with `tabsPerSite: 10`, it grew to GBs and blew past Node's default heap.

- **Why**: the crash was the Node/V8 heap (the crawler process), not the browser — headed just let the crawl run long enough to hit it.
- **What changed**: `handle()` now records straight to the store when one is present (always, in production) and keeps nothing in memory; the `requests[]` buffer is retained only as the fallback sink when there is no store (store-less unit tests inspect it directly). No behaviour change to what reaches `http_events`.
- **Effect/regressions**: unbounded per-site memory growth removed. `test/NetworkObserver.test.ts` + `test/NetworkObserverHooks.test.ts` 6/6 green; typecheck clean. Orthogonal mitigations still available if needed: `NODE_OPTIONS=--max-old-space-size=…` and a lower `tabsPerSite`.

## 2026-11-19 — analysis: two always-on HTTP content-identity guards + ablation in runAnalysisFromDb

Two false-positive/duplicate vectors on the HTTP detection path were unguarded: findings were deduped only by candidate identity (`candidateValue+nodeId+method+url`), never by response content, and the forged response was only ever compared against the reference event — never against the rest of the crawler's own `http_events`.

- **Why**: cleaner precision for the 17-app evaluation — do not count the same leak twice, and do not flag data the user can already reach.
- **What changed**: new `responseEvaluate.canonicalResponseKey` (status + body, byte-equal or key-order-independent JSON — the equivalence `isIdenticalResponse` already uses). Before recording an HTTP finding, `CandidateEvaluator` (and, identically, `AblationPipeline`) now applies, always on, no config knob: (1) **already-accessible-data** — drop a forge whose response equals one the crawler collected legitimately at a *different* URL (the reference event's own response is excluded: that is the server-ignored-value case handled by `isIdenticalResponse`); (2) **cross-candidate dedup** — two swaps forging a byte/JSON-identical response are one leak, recorded once. A missing body yields no key → finding kept (drop only on positive evidence). Both are HTTP-only (client-routing findings carry no server-response evidence). Also: `scripts/runAnalysisFromDb.ts` now runs the ablation pass too when `ABLATION_MODE=true` (it previously instantiated only `AnalysisPipeline`), and the ablation got the same `overwriteFindingsPerSite` re-run hygiene.
- **Effect/regressions**: no reference finding can be lost — pimsleur (4), lingualeo (17) and babbel (0) are all client-routing, which the guards never touch; busuu is the only site with HTTP findings (69) and both guards drop **0** of them (verified offline two ways: all 69 forged bodies are distinct, none appears in `http_events`), so busuu stays at **73**. `test/AnalysisPipeline.test.ts` + `test/AblationPipeline.test.ts` 16/16 green; typecheck clean.
