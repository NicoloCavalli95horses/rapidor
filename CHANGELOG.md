# Changelog

Older entries: [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).

## 2026-11-24 20:30 — fix: analysis heap OOM on large React graphs (rocketlanguages)

rocketlanguages' end-of-crawl analysis died with `JavaScript heap out of memory`: 259 states of ~23 MB of graph JSON each (5.4 GB, 10x any other site), and `CandidateGenerator` kept every parsed graph for the whole run (~31 MB of heap each, ~8 GB against Node's ~4.3 GB limit).

- Why so big: the extension's `node.dom` is the element's FULL `outerHTML`, so every subtree is repeated at each ancestor (13 of the 23 MB per state). Only the chrome-zone skip reads it.
- `slimGraphForGeneration` (`domZone.ts`): on load, each node's `dom` becomes its precomputed `chromeZone` label and is dropped. Same verdict: checked on every stored state (1 472 states, 3.0M nodes, 0 differences).
- The graph cache is now an LRU bounded by stored JSON size (`graphCacheMaxBytes`, default 1 GB). Every other site fits whole, so they never re-parse; `ReactStateStore.getJsonById` added.
- Effect (generation only, rocketlanguages, default heap): peak 2.3 GB, 275 parses (259 states + 16 re-parses), 33 s, 231 candidates. No change to what any site generates.

## 2026-11-24 19:06 — fix: `run_metadata` drops `git_commit`, stores the seed URL as given

RAPIDOR goes to peer review with an anonymous repository: a public commit hash in the DB would break it.

- `git_commit` removed from `RunMetadataStore`/`RunMetadataHooks` (and `gitRevision`), and dropped from `storage/crawler.db` (`ALTER TABLE run_metadata DROP COLUMN`, the 14 backfilled rows kept).
- `start_url` is now the seed exactly as given (`request.url`, passed to `buildExplorer` as `seedUrl`), not the URL loaded after redirects. The 14 backfilled rows keep their root-state URL (the original seed is not in the DB).

## 2026-11-24 19:00 — feature: `run_metadata` table — how each site's crawl was produced

The DB recorded no trace of the config, code revision or stop condition behind a crawl, so a truncated
crawl looked like a complete one and the data's provenance (needed for the Zenodo artifact) was unknown.
`analysis_stats.exploration_ms` is also overwritten with 0 by `runAnalysisFromDb` (duolingo, talkpal).

- New `RunMetadataStore` (`run_metadata`, one row per site) written by `RunMetadataHooks` at the end of the exploration, before `AnalysisHooks`: start URL, start/end, `exploration_ms`, `stop_reason`, `git_commit` (`-dirty` aware), effective config JSON (without `userDataDir`/`startUrl(s)`). Wiped by `clearOnStart` and by the per-domain overwrite like the other per-site tables. Not written by `runAnalysisFromDb` (a debug path).
- `DfsExplorer` reports why it stopped: `IExplorationHooks.onEnd` gets an optional `stopReason` (`completed`/`max-states`/`max-duration`/`error`).
- Backfilled the 14 sites crawled 22–24/11 (one-off, outside the repo): exploration code and config unchanged since the first crawl (verified by `git diff`), commit = last before the crawl, `exploration_ms` from `analysis_stats` (state-timestamp span for duolingo/talkpal), `stop_reason` inferred: max-duration celpip/duolingo/pimsleur/lingualeo, max-states clozemaster, completed the rest.
- Tests: `RunMetadataHooks.test.ts` (5), `DfsExplorer.test.ts` +4 stop-reason cases.

## 2026-11-24 18:36 — fix: positional token match in candidate generation + per-value expansion memo — mangolanguages 403 FPs

mangolanguages flagged 4 client-routing FPs (a 403 "not authorized" page). The lesson links' `url` prop
`/pathway/…/fr/485/1/1/1` is tokenized; the page segment `485` matched it, and `diffValue` (a token SET
difference) returned the sibling's differing token, the lesson number `4`, which was swapped into the PATHWAY
slot: `/fr/485/1/1 -> /fr/4/1/1`.

- `matchFinder.diffValue`: positional comparison (same token count, one differing position) and, with `matchedValue`, that position must hold the matched URL value. Passed by `CandidateGenerator` and the ablation's `findJsonCandidates`.
- `RecheckRunner` replays the rule on the stored swap diff (`authz_diff`), before any network.
- `CandidateGenerator.expand`: the value-only expansion (preindex rows → chrome skip → siblings → value filters) is memoized per run, so a repeated segment (`/lesson/1/2/1`) or another URL with the same value reuses it; a node+path is expanded once (one preindex row per token). Same items and `matches` stat as before, minus exact duplicates.
- Effect: offline replay on every stored finding changes only 5 rows. `recheckFindings`: mangolanguages 0/4 (all 4 FPs rejected), promova 24/25 (the `/my-plan/<id> -> /my-plan/profile` FP rejected). Unit tests: matchFinder 10/10, candidateGenerator 20/20, jsonMatchFinder 12/12, AblationPipeline 9/9. `runAnalysisFromDb`: mangolanguages 0 findings, promova 24 (9 CLIENT + 15 http), promova ablation unchanged at 138. `npm test` 377/377.

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
