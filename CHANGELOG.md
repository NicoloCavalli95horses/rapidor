# Changelog

Older entries: [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).

## 2026-11-24 18:31 — docs: getpronounce joins the reference set; busuu/promova expected counts refreshed

The getpronounce TP must survive future decision-logic changes, so it is now a regression reference.

- `.claude/rules/analysis.md` Regression checks: reference set = busuu, pimsleur, promova, lingualeo, ejoy, **getpronounce** (+ babbel). getpronounce expects exactly 1: `voice=echo -> shimmer` (paid TTS voice on arbitrary text); `shimmer -> daniel` and `shimmer -> evelyn` must stay rejected.
- Expected counts from today's `recheckFindings`: busuu 20/23 → **14/17** (14 `http` objective siblings; the 3 client-routing `courseName` rows are directional-gate FPs), promova 16 → **25/25** (9 CLIENT + 16 `http`).

## 2026-11-24 18:14 — chore: extract client-routing sibling-group inference from `CandidateEvaluator`

`candidateEvaluator.ts` was past 700 lines. The client-routing sibling-group logic (positive confirmation +
negative redirect-away inference) moves to its own module. Behavior-preserving refactor.

- New `src/analysis/clientSiblingGroups.ts` (`ClientSiblingGroups`): the group state, the key, `finalize()`, and `evaluate()`. `evaluate()` is the confirmed → rejected-skip → probe → content-guard → confirm flow that the query and path evaluators used to duplicate line by line.
- `CandidateEvaluator` delegates to it (708 → 582 lines). `finalizeClientGroups()`/`clientGroupSkipped` stay as thin delegates, so `AnalysisPipeline` and the tests are unchanged.
- New `test/clientSiblingGroups.test.ts` (8 unit tests, no browser). `AnalysisPipeline.test.ts` 15/15 (browser-backed group tests). Full `npm test`: 372/373, the one failure is the flaky `ExtensionCalls` 200 ms handshake (passes 3/3 alone, untouched code).

## 2026-11-24 17:59 — fix: HTTP value-insensitivity guard — getpronounce `shimmer -> evelyn` FP

A forge was accepted when its response differed from the reference, even if the server had ignored the value
and fallen back to a default. getpronounce `/pronounce?voice=evelyn&provider=openai` (`evelyn` is a `gcp` voice,
the URL value matched `voiceId` instead of `providerVoiceId`) returned the default `echo` audio, byte-identical
to `voice=joseph` and to every other unknown openai voice.

- New `src/analysis/forgeValueSensitivity.ts`: two DIFFERENT values in the SAME request slot (method + reference url + param/path position) with an identical response (`canonicalResponseKey`) → server fallback, neither is an HTTP finding. Generalizes `isIdenticalResponse` (candidate == reference) to candidate == sibling.
- `CandidateEvaluator`: every forge is observed; HTTP findings are deferred to `finalizeHttpFindings` (the colliding sibling may come later), called by `AnalysisPipeline` before pool teardown. The cross-candidate dedup moved there, after this check. Value-insensitive → client-routing query fallback, as for an identical-to-reference forge.
- `RecheckRunner` rebuilds it from the `forged_requests` cache (`ForgedRequestStore.listUrlsByOrigin`, `singleSwapPosition`): no new requests. Ablation unchanged (it lacks `isIdenticalResponse` by design).
- Offline replay on every stored http finding: getpronounce `evelyn` dropped, `shimmer` (paid voice, distinct audio) kept; promova 16/16 and busuu 14/14 kept. Client-routing findings untouched. Live `recheckFindings`: getpronounce 1/2 (`evelyn` rejected by this guard), pimsleur 4/4, promova 25/25, ejoy 4/4, busuu 14/17 (the 3 dropped are the client-routing `courseName` swaps of the directional gate, unrelated), lingualeo 16/18 (2 client-routing redirect-away, unrelated). `runAnalysisFromDb` getpronounce: 1 finding (`echo -> shimmer`).

## 2026-11-24 16:50 — fix: directional authz gate (NLI polarity) — getpronounce `shimmer -> daniel` FP

The authz gate was symmetric: it checked that an entitlement prop differs, not WHICH side is locked.
getpronounce lets a free user preview every voice, paid ones included, so `voice=shimmer` (`isFree: false`)
is a legitimate 200 reference and its free siblings (`daniel`, …) became candidates — `isFree: false -> true`
passed the gate. The forge with `voice=daniel&provider=openai` returned the server's fallback voice (`echo`,
byte-identical for daniel/evelyn/joseph/echo) and was flagged.

- **Why NLI:** the MiniLM similarity is polarity-blind — measured, `locked`/`restricted`/`disabled` sit
  closer to an "access granted" anchor than `unlocked`. A zero-shot NLI model reads negation. Chosen among
  7 models × 7 phrasings on 44 terms: `Xenova/bart-large-mnli`, premise "This lesson is marked as <term>.",
  hypotheses "The user must pay or upgrade to open it" / "can open it at no cost" (multi-label) → signs
  `lock` +0.80, `premium` +1.00, `free` −1.00, `unlocked` −0.99; neutral terms relevance ≤ 0.42.
- **What changed:** `EntitlementPolarity` (new, `entitlementPolarity.ts`, cached in the new `authz_polarity`
  table) + `assessDirection` (`authzClassifier.ts`): only the diffs MiniLM already found authz-relevant vote;
  a flag's key carries the sign, its value switches it; a string enum's values carry it. Drop only on
  positive evidence (delta < −0.2). Applied in `authzGate` (main) and the ablation; re-run by
  `recheckFindings` on the stored `authz_diff`. Kill switch `analysis.authzDirectionGate` (`AUTHZ_DIRECTION_GATE=false`).
- **Effect (all 76 stored findings, real implementation):** getpronounce 4/5 (`daniel` dropped; the
  `echo -> shimmer` premium-voice TP and the 3 locked exercises kept), ejoy 4/4, pimsleur 4/4, lingualeo
  18/18 (no vote: `available: null -> 0`), promova 25/25, busuu 14/17 — the 14 objective TPs kept, the 3
  client-routing `courseName` swaps dropped (`unlocked: false -> true`: the candidate is the unlocked side).
- **Known limit:** user-STATE terms (`purchased`, `owned`, `isSubscribed`) get the wrong sign; absent from
  the reference set, but `purchased: true -> false` would be dropped.

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

