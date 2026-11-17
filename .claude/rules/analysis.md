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
- **HTTP forge**: an HTTP forge whose response is identical to the original (`isIdenticalResponse`: byte-equal or deep-equal JSON) is NOT an HTTP finding — the server ignored the swapped value (busuu `checkout.json?price_id=A->B` returned the same 65 KB payload). It falls through to the client-routing fallback, it is not accepted on response "similarity".

## Client-routing IDOR verification (`clientSideConfirmed`) — justified, do not regress

This logic was rebuilt to kill real false positives (lingualeo `refclmark`, the busuu redirect-away) WITHOUT losing real findings (pimsleur 4/4, busuu objective siblings, lingualeo `wordTranslate` siblings). Every rule below exists because a specific site broke without it — change it only with a `recheckFindings` run on all four reference sites (see Regression checks) proving no loss.

- **Probe gate**: a candidate is considered only when the probe reports `hasMutatedDom && stayedOnRoute` (the SPA rendered the candidate's own route and stayed on it). A redirect-away (`stayedOnRoute=false`) is a rejection, not a finding (busuu `dashboard/review -> dashboard/timeline`).
- **Network is a filter, not a veto**: a `2xx` carrying the candidate value (or a hooked `URLSearchParams.get`) *corroborates*; a `4xx` on an incidental request does NOT reject. Attribution is boundary-aware (`urlCarriesValue`: whole segment or whole param value, never a substring — `298` must not match `6140298`).
- **Content guard runs even when corroborated.** A `2xx` cannot tell a real leak from an ignored tracking param (lingualeo `refclmark=1` returns a 2xx for a byte-identical `_next/data` JSON), so the **inert-value** check (candidate DOM == reference DOM) ALWAYS runs. Only the **not-found** check is skipped when corroborated.
- **DOM, never screenshots.** Compare normalized DOM snapshots (`domSnapshot.ts`: text nodes + `<img>` src + element count). Screenshots are viewport-bound, hidden by `lightweightMode`'s placeholder assets, and blind to a one-string change. Do not reintroduce a pixel diff as a *criterion* (it may stay in reproduction scripts as evidence only).
- **Mask BOTH values** out of every side before comparing. A stale pushState render shows the *reference* value in the candidate's content; masking each side with only its own value makes a stale render look falsely different (and match the stale not-found baseline). Masking both makes a stale render read inert → fall through; a real leak still differs by its own data.
- **Remount-noise calibration**: render the reference twice, bracketing the candidate's own render, and ignore the paths that differ between those two (lingualeo training pages draw random quiz words every load) — EXCEPT a path where the second reference render shows the candidate's text (a stale render, not noise). Do not cache the reference render per page: the bracket must be per candidate.
- **Two mechanisms, cheap first — keep BOTH.** pushState first (no reload; the mechanism a genuinely client-routed SPA honours — pimsleur/busuu decide here with no extra network). A real `page.goto` runs ONLY as a fallback when pushState left the candidate inert, because an SSR route (Next.js) renders content only on a server load (lingualeo `/en/training/<type>`: 0 nodes under pushState, ~96 on a real load). Never drop pushState for goto-only: a purely client-trusting route (server would reject a direct load, SPA renders from loaded state) is visible ONLY via pushState. Never drop the goto fallback: SSR routes are invisible to pushState.
- **Wait for network idle before snapshotting** (`waitForLoadState('networkidle')`, bounded, best-effort, in both capture fns). A fetch-gated route (pimsleur loads each lesson by id via XHR) has `load`/popstate fire on the shell while content is still coming; a fixed settle alone catches the shell (or a cookie wall) and silently drops real findings. This is the reliability fix that keeps pimsleur at 4/4 — do not remove it.
- **Not-found baseline must be usable.** The garbage-id baseline rejects a candidate only when it is itself meaningfully different from the known-good reference page. If garbage ≈ reference (a soft-404 app, or a failed/cookie-walled render where everything is the same shell), "looks like garbage" proves nothing, so back off and keep. Baselines are cached per (template, mechanism).
- The client-routing phase runs on a pool of pages (`withPooledPage`). One probe per page at a time, because it mutates the live DOM. The probe is retried up to 3×, on the same page.
- History filter: a candidate URL that is already in `http_events`/`react_states`/`crawl_states` is skipped.
- The ablation writes only to `ablation_*`. Never mix it with `vulnerabilities`/`analysis_stats`.
- Schema: tables are created in `db/openDatabase.ts`. `db.clearOnStart` wipes the tables listed in the README (`db.clearOnStart` in `## Configuration`). If you add a table, decide explicitly whether it gets wiped.

Full documentation: `docs/analysis.md` (keep it updated when behavior changes).

# Regression checks
For a change to the decision logic (guards, response comparison, capture), FIRST `npx tsx scripts/recheckFindings.ts <START_URL>`: re-examines only the stored `vulnerabilities`, writes nothing, minutes instead of a full pass. It verifies you did not LOSE a finding; it cannot find new ones, so also run the full pass when candidate generation changed: `npx tsx scripts/runAnalysisFromDb.ts <START_URL>` (uses captured data, no new crawl).

Expected (`recheckFindings`, authenticated profile, run one site at a time — they share the browser profile):
- **pimsleur 4/4** (`learn.pimsleur.com/MiniLearn`) — pure client-routed lessons by `?id`, fetch-gated. A drop below 4 means the network-idle wait or the not-found backoff regressed.
- **busuu 20/23** (`www.busuu.com/dashboard/timeline/a1`) — the 3 dropped are the `price_*` `checkout.json` findings whose forged response is byte-identical (`isIdenticalResponse`); the 20 kept are the objective siblings. ≥19 is the bar.
- **babbel 0** (`my.babbel.com/dashboard/inprogress`) — no findings stored; a non-zero result is a bug.
- **lingualeo ≥5** (`lingualeo.com/en/training`) — the stable TPs are the `wordTranslate` training siblings. The `savannah -> *` candidates render the generic trainings dashboard (the app's fallback for an unavailable training type) and are correctly rejected as not-found — they are NOT regressions. The `refclmark` candidates (inert tracking param) must stay rejected. Residual run-to-run variation here comes from probe flakiness (`hasMutatedDom`), not the guards.

Report any variation from these, and never "fix" a count by weakening a guard the section above justifies.
