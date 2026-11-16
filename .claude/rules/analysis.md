---
paths:
  - "src/analysis/**"
  - "src/db/**"
  - "scripts/**"
  - "test/*Pipeline*.test.ts"
  - "test/authzClassifier.test.ts"
  - "test/clientRouting.test.ts"
---

# IDOR analysis: invariants (do not break)

- **GET only.** `requestForge.forgeRequest` refuses non-GET methods, and candidate generation skips non-GET events. Never relax this: replaying POST/PUT/DELETE changes state on real sites.
- Forged requests go through `page.request.fetch()` so they never pollute `http_events`. Go through `forgeRequestCached` (`forged_requests` table, shared with the ablation).
- **Authz classifier**: if you change normalization or embedding in `authzClassifier.ts`, bump `CLASSIFIER_VERSION`, otherwise stale rows in `authz_classifications` (never wiped by default) get reused.
- **Client routing**: the primary signal is `hasMutatedDom && stayedOnRoute`. The network is a filter, not a veto (a 2xx confirms, a 4xx does not reject on its own). Attribution uses `urlCarriesValue` (whole segment or param, never a substring). A not-found render is rejected via `routeScreenshot`. The probe is retried up to 3×, on the same page.
- The client-routing phase runs on a pool of pages (`withPooledPage`). One probe per page at a time, because it mutates the live DOM.
- History filter: a candidate URL that is already in `http_events`/`react_states`/`crawl_states` is skipped.
- The ablation writes only to `ablation_*`. Never mix it with `vulnerabilities`/`analysis_stats`.
- Schema: tables are created in `db/openDatabase.ts`. `db.clearOnStart` wipes the tables listed in the README (`db.clearOnStart` in `## Configuration`). If you add a table, decide explicitly whether it gets wiped.

Full documentation: `docs/analysis.md` (keep it updated when behavior changes).

# Regression checks
Reference sites, using data already captured (no new crawl): `npx tsx scripts/runAnalysisFromDb.ts <START_URL>`. Expected per the CHANGELOG: pimsleur 4/4, busuu 19/19, lingualeo 12. Report any variation.
