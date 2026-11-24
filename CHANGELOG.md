# Changelog

Older entries: [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).

## 2026-11-24 12:40 — fix: NON_AUTHZ_TERMS += feature/service (plural-aware) — talkpal mode-swap FPs

talkpal's `sentence-mode -> character/daily-pick` dashboard-mode swaps (6 findings) passed the authz
gate only because the embedding classifier scored benign UI chrome above the 0.30 threshold: the
`newFeature` "NEW" badge normalizes to "new feature" (0.46) and a `category` VALUE of `"Services"`
normalizes to "services" (0.37). Neither is a paid-resource gate; the DOM guards can't reject them
because a different mode genuinely renders different content.

- **What changed:** `NON_AUTHZ_TERMS` now also holds the SINGULARs `feature` and `service`, and the
  membership check (`isNonAuthzWord`) matches a word or its simple English plural (s/es/ies), so one
  entry covers `services`/`features`/`categories` — no need to list plurals. Live policy (checked in
  `classify` before cache/model), so no `CLASSIFIER_VERSION` bump and cached scores are overridden.
- **Suffix-only de-pluralization** keeps lookalikes distinct: `featured` (pimsleur, ends in `ed`) is
  NOT a plural of `feature`; `access`/`status`/`business` do not collapse to any set entry.
- **Reference set safe (offline-proven):** no busuu/pimsleur/promova/lingualeo/ejoy signal matches —
  `isFree`/`lock`/`premium`/`tier`/`paywall`/`featured` all kept; busuu's `…-service-…` is inside
  image-URL asset values (already excluded). authzClassifier tests 7/7.
- **Effect:** talkpal 6 mode-swap FPs dropped (the 4 `modeType` fallback FPs were already removed by
  the page-uses-param fallback gate). Decision-logic change → `recheckFindings` on the 5 reference
  sites to confirm (offline already shows no loss).
## 2026-11-24 12:05 — fix: client-routing query fallback requires the page to use the param

The HTTP→client-routing fallback (for a query candidate the forge did not confirm) re-applied the
param to `event.pageUrl` and probed it. But `pageUrl` is only where the XHR fired, not necessarily a
route that honours the param — so talkpal's `mode-progress-percentage?modeType=<mode>` (XHR on
`/sentence-mode` & `/word-mode`, pages with no `modeType` in their URL) produced one false positive
per sibling mode: the page ignored the bogus param and rendered its own content, which read as "novel".

- **What changed:** `clientRoutingQueryFallback` now drops unless `event.pageUrl` already carries
  `paramName` in its query. A param genuinely part of the page route (pimsleur's `/…?id=`) is present,
  so real fallbacks are untouched. Can only DROP, never add.
- **Reference set is unaffected (offline-proven):** no busuu/pimsleur/promova/lingualeo/ejoy finding
  comes through this fallback — they are all `http` or direct `CLIENT` (method ≠ GET+client-routing).
  Only talkpal (the 4 FPs, now dropped) and the EXCLUDED mondly had fallback rows.
- **Reference set note:** the evaluation set is busuu/pimsleur/promova/lingualeo/ejoy (+ babbel as the
  0-finding control). mondly (Ember) and global-exam (React+Vue hybrid) are excluded; their DB rows are
  to be deleted. `.claude/rules/analysis.md` Regression-checks updated accordingly.

## 2026-11-24 11:05 — fix: only 200 GETs are forge references; memoized preindex lookups; early-abort generation

talkpal's analysis never finished: generation ran for 20+ min at ~4 GB RSS with zero forges. Its
~31k first-party Google Analytics beacons (`app.talkpal.ai/bqpw/g/collect`, status `204`, unique
`_p`/`sst.rnd`/`rcb` per hit) survive both the same-site capture filter and `normalizeUrl`, and drove
~2M segments / ~3.6M preindex matches with a fresh URL per beacon, so `seen` never deduped them.

- **Why:** a `204`/`3xx`/`4xx` GET can never be a forge reference (no body to compare; a forged `200`
  fails the status-equality similarity, a forged `>=400` hits the error-status guard), so they only
  cost time. The main pipeline also had no generation early-abort, unlike the ablation.
- **What changed:** `AnalysisPipeline` and `AblationPipeline` skip non-200 GETs as forge references
  (history filter still uses every event); `CandidateGenerator` memoizes `countByValue`/`findByValue`
  per value per site (reset per run); the main pipeline breaks out of generation as soon as
  `tasks > maxGeneratedRequests`. New test in `AnalysisPipeline.test.ts`.
- **Latent ablation bug, also fixed:** the ablation generation loop never enforced the GET-only
  invariant (it used every event as its own forge reference), so once talkpal's generation was no
  longer `infeasible` it reached a `200` POST whose URL carried a preindexed value and crashed on
  `forgeRequest`'s non-GET refusal. `AblationPipeline` now skips non-GET references too (the talkpal
  roleplay resources stay analysed via their 3 `200` GET carriers). Reference pool drops from ~21k
  POST to 192 GET; the JSON preindex/siblings still come from any response body.
- **Measured (offline generation, read-only):** talkpal >10k candidates (early-aborted after 170 URLs,
  12 s) → **500 in 1.9 s**; promova 128 → 128; mondly.com / app.mondly.com 0 → 0; busuu 61 → 42 (the 19
  dropped come from one `403` premium-download reference, which could never yield a finding). All 40
  stored HTTP findings (busuu 14, promova 16, mondly 10) have a `200` reference → no loss.
  Client-routing is untouched (seeded from page URLs, not `http_events`).
- **Live (talkpal, re-authenticated):** main pipeline FRESH, 31436 non-200 GETs excluded, 726
  candidates dispatched, 54 s, not infeasible, **9 findings** (3 client CLIENT, 4 client GET, 2 http
  GET). The session expires in ~3 min, so a clean end-to-end ablation run still awaits a fresh login.

## 2026-11-23 19:10 — fix: recover longer paid resources — asymmetric response-length check

busuu re-derived only 8 of its paid-lesson HTTP findings when ~14 are real. The 6 missing ones
(`objective_ja_complete_a1_29/34_a/35_a/36/38_a`, `objective_8b3be45f`) pass the authz gate against the
active lesson `5f` and forge a 200 with real content, but were dropped by the response-similarity gate.

- **Why:** `getServerResponseSimilarity`'s body-length arm used a SYMMETRIC band (`checkIntSimilarity`,
  ratio in `[0.45, 2.22]`). The reference is the single observed "active" lesson `5f` (a *writing* lesson,
  27 KB); longer paid lessons of the same shape (identical 200 + `application/json` + 7 top-level keys) ran
  2.25–2.64× its length and tripped the upper cap — a 4% length difference flipped the verdict (`22560674`
  at 2.16× kept, `8b3be45f` at 2.25× dropped). A paid resource legitimately carries MORE content than the
  reference, so a larger body is not evidence against a leak; only a much SMALLER body (stub/denial) is.
- **What changed:** new `isLengthNotTruncated` in `responseEvaluate.ts` (keeps the lower bound — candidate
  ≥ `0.45×` the reference — and drops the upper one); `getServerResponseSimilarity.bodyLength` now uses it.
  Shape stays symmetric (`checkIntSimilarity` on the top-level key count) — a different-shaped response is a
  different resource. Shared by BOTH the main pipeline and the ablation (the two analysis modules keep the
  same tools; the ablation only differs in not using React states).
- **Effect / regressions:** offline demo HTTP findings — busuu **8 → 14** (the +6 are exactly the longer
  Group-A lessons, no spurious additions; the 2 Cluster-B siblings `06c5a9cd`/`2f34a6a8` stay out — they
  fail the authz gate, a separate matter). The 4 reference sites are **unchanged**: promova 16 → 16 (same
  set — the rule is strictly more permissive, so no finding can be lost), lingualeo/ejoy/pimsleur 0 → 0
  (their TPs are client-routing = DOM comparison, untouched by construction). `responseEvaluate` 31/31
  (+1 `isLengthNotTruncated` suite, +1 larger-body case), ablation 9/9, AnalysisPipeline 12/12, typecheck
  clean. Run `recheckFindings` on the 4 live sites to confirm no stored finding is lost (guaranteed by the
  monotonic relaxation, but it is the official gate).

## 2026-11-23 14:30 — fix: lingualeo refclmark HTTP FPs — tracking-param filter

A depth-4 lingualeo crawl flagged 19 findings, only 9 TP (the `wordTranslate` client-routing training siblings). The other 10 were all the SAME request: the CRM buy-page data blob `/_next/data/…/en/buy/nt_ton_prem_web_2690n.json?…&refclmark=2&campaignId=…`, HTTP-detected, swapping `refclmark` from `2` to wordset ids.

- **Why:** `refclmark` (ref-click-mark, a marketing/attribution param) is inert — the server ignores it. But its value `2` collided with a real wordset id in the page's React state (`props.elements.1.id`, 5 nodes), so candidate generation forged sibling ids (`12178`, …). `isIdenticalResponse` couldn't drop them: the blob's `elements`/`tags` list is dynamic and reordered between crawl-time capture and analysis-time forge, so the POSITIONAL diff at `elements.1` showed `type: "user" -> "global"`; the value `"user"` tripped the authz classifier → 10 HTTP FPs. `refclmark` was already a known client-routing FP (rejected by the content guard); with the `_next/data` JSON now in `http_events`, the HTTP path had no equivalent filter.
- **What changed:** new `TRACKING_PARAM`/`isTrackingParam` in `candidateGenerator.ts` (regex, a semantic param-name fact like `LOCALE_PARAM` — not a config knob), matched beside the locale filter in BOTH the main pipeline and the ablation. Covers `utm_*`, `refclmark`, `campaign(_)?id`, and the common click-ids (`gclid`/`fbclid`/`msclkid`/…). Regex, not a blacklist token, so a resource param that merely contains a tracking word (`refId`, `price_id`, `campaign_name`) stays mutable.
- **Effect:** the 10 `refclmark` HTTP candidates are skipped at generation time; the 9 client-routing TPs are untouched (different path). No reference-site TP swaps a tracking param (verified by name: pimsleur `?id`, busuu objective/price, lingualeo `wordTranslate`, promova/mondly ids), so no loss. `candidateGenerator` tests 18/18 (+1 `isTrackingParam` suite). Re-run `runAnalysisFromDb.ts lingualeo.com` to confirm 9/9 on the live session.

## 2026-11-23 — fix: ejoy 4/4 — client-routing dedup by route, cross-origin auth gate

ejoy kept flagging 0–2 of its 4 locked lessons, flapping run-to-run; the root causes were two, neither the query-rewrite (the `?path=` reaches the probe intact).

- **Cross-origin login redirect not detected.** The analysis profile's ejoy session had expired, so every cold navigation (free reference AND paid siblings) bounced to `sso.ejoyspace.com/?continue=…` — a DIFFERENT origin. The auth-freshness gate couldn't catch it: ejoy's entry URL has no seed fingerprint, so the gate proceeded conservatively and the run wasted ~50s producing 0 with misleading "redirected to /" logs. The gate now checks a cross-origin redirect FIRST, independent of any seed — positive, unambiguous evidence of an unauthenticated session. Verified live: logged in → FRESH, logged out → EXPIRED (sso bounce).
- **Distinct locked siblings collapsed as "duplicate".** Once authenticated, all 4 siblings render distinct real content (the DOM guard sees Lesson 3/4/5/6), but `keepClientRoutingByContent`'s reactContentKey duplicate-check dropped all but 2: a LOCKED lesson renders a near-identical paywall shell, whose identifier set is the course's whole lesson LIST (same across siblings), so 1033/1035 hashed equal to 1032/1034 and were dropped. Cross-candidate dedup for client-routing is now DETERMINISTIC on the leaked ROUTE (`vulnerabilityId`'s `clientRoute = normalizeUrl(candidateUrl)`): 1032 proposed from both the 1030 and 1031 pages rewrites to one route → one finding, sibling lessons keep their own routes. The reactContentKey DUPLICATE check is removed (the ALREADY-COLLECTED check stays); `captureReactContentKey` also now waits network-idle + settle so a fetch-gated route's content has landed before hashing.
- **Effect:** ejoy a stable 4/4 across two consecutive runs (1032/1033/1034/1035), ~50s. `findings`/`AnalysisPipeline`/`authFreshness` tests green (+1 client-route id test, +1 cross-origin SSO-bounce test, authFreshness 8/8). Promova/lingualeo client-routing counts unaffected (each sibling already a distinct route).

## 2026-11-23 — fix: authz gate ignores the swapped identifier + same-type id swaps + `privacy` is never authz (duolingo)

duolingo flagged 2 FPs, both swaps onto a "Privacy" link. Neither was caused by missing history (live DOM: neither link is inside nav/footer, and `/privacy` was already crawled), so a nav/footer harvest would not have helped.

- **Why:** (1) `/settings/account -> /settings/privacy`: the ONLY sensitive key was the swapped href VALUE `privacy` — the identifier being swapped acted as its own entitlement evidence. (2) `help/faq?relative_domains=1 -> privacy`: the value `1` matched by token inside a lesson button's href (`/lesson/unit/1/level/1`), whose "sibling" in the same Link component is the footer `/privacy` link — a numeric slot swapped for a word.
- **What changed:** `excludeSwapDiff` drops the swap-path diff before `assessAuthZ` (motivation keeps the full diff); `sameIdShape` skips numeric <-> non-numeric swaps at generation (main + ablation; string form, so React `1` and `'1'` are both numeric); `NON_AUTHZ_TERMS = {privacy}` in the classifier, matched per normalized word at read time (no `CLASSIFIER_VERSION` bump).
- **Auth gate false EXPIRED (same batch):** `runAnalysisFromDb` kept aborting on duolingo even right after `refreshAuth`, because the gate required an EXACT fingerprint match and duolingo `/learn` had 220 captures with 220 distinct fingerprints (live, logged in: 562 nodes, no redirect, no login form). A mismatch is no longer expiry: EXPIRED now needs positive evidence — left the entry route, a password field, or a tree < 0.5× the smallest captured one (`ReactStateStore.nodeCountsForUrl`). Verified live both ways: logged in → FRESH; empty profile → EXPIRED (redirected to `/`). `authFreshness.test.ts` rewritten, 7/7.
- **Effect:** live duolingo re-analysis 2 → 0 findings, 569 → 354 requests, 3m06s → 49s; the `relative_domains` candidate is no longer generated, the `settings/privacy` one no longer passes the gate. Offline check on every stored finding: no TP of pimsleur (4), lingualeo (19), promova (25) affected; 2 odd mondly rows (`4 -> leoSprint/savannah`, lingualeo values — likely pre-site-scoping residue) would also drop. Tests: +6 unit (sameIdShape incl. `'1'`/`1`, excludeSwapDiff, privacy deny); pipeline/ablation 21/21.

## 2026-11-23 — fix: stage-2 redirect-away guard + negative sibling-group inference + route-level probe dedup (clozemaster)

clozemaster produced 101 client-routing FPs in 65 min of analysis: every paid wikipedia story bounces to `/pro`, and nothing noticed.

- **Why (FPs):** the stage-2 SSR navigation fallback captured the post-goto URL but never checked it — only stages 1 (`stayedOnRoute`) and 3 (`sameRoutePath`) had a redirect-away guard. The `/pro` upsell differs from both the reference and the not-found baseline, so it read as "new content" → accept.
- **Why (time):** each visited story slug matches its catalog card, whose ~508 paid siblings are all genuine `isFree: true → false` candidates; client probes were deduped per *reference page*, so 10 visited stories × 508 = 5 080 live probes.
- **What changed:** (1) stage 2 rejects a real load the app redirected away from (same `sameRoutePath` guard; a failed capture still keeps). (2) Client-routing probes are deduped by canonical candidate route, like HTTP. (3) Negative sibling-group inference (`analysis.clientRoutingGroupRejectAfter`, default 3, 0 = off): after K same-target redirect-aways the rest of the group is skipped (stashed, so a later genuine confirmation still recovers it). `recheckFindings` gained `RECHECK_LIMIT=N`.
- **Effect:** clozemaster recheck 0/101 still flagged (all `/pro` redirect-away); full re-analysis 101 → 0 findings, client probes 5 080 → 508 dispatched / ~10 executed (498 skipped), analysis 64m48s → 1m38s. New tests: stage-2 paywall redirect (fails without the fix) + group skip; `AnalysisPipeline.test.ts` 12/12. Stage 2 is lingualeo's stage → its `recheckFindings` is still owed.
