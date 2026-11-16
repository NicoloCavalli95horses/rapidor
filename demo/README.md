# Reproducible demo — busuu HTTP IDOR detection

This folder lets anyone **re-derive our IDOR findings deterministically and offline**, without crawling
the live site and without our authenticated session. It runs the *real* analysis pipeline over a frozen
snapshot of data we collected, replaying every server response from a recorded cache — so the result is
always the same, independent of time, network, or machine.

- **Snapshot collected:** 2026-11-16, from `www.busuu.com`.
- **Expected result:** **22 HTTP IDOR findings** (path-segment `objective_<uuid>` swaps on
  `api.busuu.com/api/v2/component/...`), identical to what our live run flagged on that date.

## Run it

The snapshot DB (`demo/crawler.db`) is **not committed** (it is ~45 MB; see *Data availability* below).
Obtain it first — from Zenodo (DOI _TBD_) or by regenerating it from a full crawler DB — then:

```bash
npm install
npm run run-demo -- https://www.busuu.com/dashboard
# or:  npx tsx scripts/runDemo.ts https://www.busuu.com/dashboard
```

It prints the 22 reference → candidate URL pairs and re-derives them every time. No browser, no login, no
network: every forged request is served from the snapshot's `forged_requests` cache, and a cache miss
*throws* rather than hitting the network — the offline guarantee is enforced, not assumed.

## (Re)generating the snapshot

After a fresh crawl + analysis of the app under test, refresh the snapshot from the full crawler DB:

```bash
npm run build-demo -- https://www.busuu.com/dashboard          # storage/crawler.db -> demo/crawler.db
# or set EXPORT_DEMO=true on the crawl itself to refresh it automatically at the end of each site's analysis
```

`build-demo` copies only the site's HTTP-detection inputs (`http_events`, `react_states`,
`preindexed_values`, `crawl_states`), the recorded `forged_requests` responses, and the global
`authz_classifications` cache. It overwrites only that site's rows, so other sites in the demo DB are kept.

## Why HTTP-only? (and not client-side routing)

The detector has two paths (see [../docs/analysis.md](../docs/analysis.md)):

1. **HTTP forging** — swap an id into a captured GET, replay it, compare responses. This path is
   **deterministically replayable**: the candidate responses are recorded in `forged_requests`, so the
   oracle (response-similarity + the cached authorization classifier) is a pure function of the snapshot.
   This demo reproduces exactly this path. busuu's findings are of this kind.
2. **Client-side routing** — for values an SPA only reads client-side, the probe does a live
   `pushState`+`popstate` against the *running app* and watches the real DOM, with a pixel screenshot of
   the rendered route compared against the app's not-found page.

Path 2 **cannot be made deterministic offline** without effectively shipping a full record-and-replay of
each page: not just the JS bundles, but every runtime `fetch`/`XHR` the route fires, all fonts/images for
pixel-stable screenshots, and a seeded not-found calibration (ours uses `Math.random`). Even then the
screenshot comparison is sensitive to fonts/GPU and would not reproduce identically across machines. It is
genuinely error-prone, so we deliberately scope this reproducible demo to the HTTP path, which is both
rigorous and portable.

## Data availability

The complete datasets we collected (all sites, both detection paths, including the client-routing findings
that are only observable live) will be published on **Zenodo** (DOI _TBD_) as the full `crawler.db`, so the
raw data is open for inspection even where live re-derivation is not deterministic. This demo is the subset
anyone can *re-run* and get byte-for-byte the same findings.
