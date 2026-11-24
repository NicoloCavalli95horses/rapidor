import { log } from 'crawlee';
import type { Page } from 'playwright';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { ReactStateStore } from '../db/ReactStateStore';
import type { VulnerabilityStore } from '../db/VulnerabilityStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { reactContentKey } from './reactFingerprint';
import { findCandidates } from './matchFinder';
import { type SegmentCandidate } from './segments';
import { forgeRequestCached, type ResponseLike } from './requestForge';
import { applyAuthOverride, type AuthOverride } from './authSession';
import { rewriteCorrelatedQuery } from './correlatedQuery';
import { getServerResponseSimilarity, isIdenticalResponse, canonicalResponseKey, isEmptyJsonResponse, isErrorEnvelopeResponse, compareObj, scopeDiffsToResource, excludeSwapDiff, describeDiffs, type PropDiff, type ResponseSimilarity } from './responseEvaluate';
import { assessAuthZ, type AuthzClassifier, type AuthzAssessment } from './authzClassifier';
import { CLIENT_ROUTING_METHOD, vulnerabilityId, normalizeUrl, describeExtractedSegment } from './findings';
import { Semaphore, sleep, withParam, urlEmbedsValue } from '../utils/utils';
import { writeReproductionScript, type ReproductionKind } from './reproductionScript';
import { redirectAwayTarget, type ClientRoutingVerifier } from './clientRoutingVerifier';

/** Only the knobs this stage reads (see config.analysis for each one's own comment). */
export interface CandidateEvaluatorOptions {
  maxConcurrentRequests: number;
  timeBetweenRequestsMs: number;
  offline?: boolean;
  userDataDir?: string;
  reportsDir: string;
  clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };
  // see AnalysisPipelineOptions.authOverride — applied to the captured headers before every forge
  authOverride?: AuthOverride;
  // see config.analysis.clientRoutingPathCoherence — path-candidate query-strip retry
  clientRoutingPathCoherence?: boolean;
  // see config.analysis.clientRoutingGroupRejectAfter — negative sibling-group inference (default 3, 0 = off)
  clientRoutingGroupRejectAfter?: number;
}

export interface CandidateEvaluatorDeps {
  httpEventStore: HttpEventStore;   // for the lazy reference-body fetch + the streamed response-history prime
  reactStateStore: ReactStateStore; // for the client-routing novelty corpus (reactContentKey of every collected state)
  vulnerabilityStore: VulnerabilityStore;
  forgedRequestStore: ForgedRequestStore;
  classifier: AuthzClassifier;
  clientRoutingVerifier: ClientRoutingVerifier;
  options: CandidateEvaluatorOptions;
}

/**
 * Turns ONE proposed swap into a finding or a rejection. This is where the cheap->expensive ordering
 * is decided per candidate: the pure authz gate first, then (only if it passed) the forged request
 * and/or the live client-routing verification, then recording + the reproduction script.
 *
 * Three entry points, one per detection path — an HTTP candidate (a forged request, with the
 * client-routing fallback for a query param), a client-only query param, and a client-only path
 * segment. AnalysisPipeline builds the candidates and dispatches them here; it never decides.
 */
export class CandidateEvaluator {
  // Bounds concurrent forged HTTP requests independently of the page pool (the forge uses
  // page.request.fetch, which needs no page DOM, so it is not gated by the pool). Re-created per run.
  private forgeSemaphore: Semaphore = new Semaphore(1);

  // Finding ids this analysis run has already logged. The WARN for a confirmed finding must reflect
  // what THIS run determined, not whether the row happens to be new to the DB: vulnerabilityStore
  // dedups with INSERT OR IGNORE, so a re-run on a DB that already holds the finding (runAnalysisFromDb
  // never clears) would otherwise log nothing while `vulnerabilitiesFlagged` still reports it. We log
  // on confirmation regardless of DB novelty, deduped per run by this set so the same finding reached
  // from two reference events is not logged twice. Reset per run.
  private loggedFindingIds = new Set<string>();

  // The forged-response CONTENT keys (see canonicalResponseKey) of the HTTP findings already recorded
  // THIS run. Two different swaps whose forged response is byte/JSON-identical describe the same leak
  // (the server's answer does not depend on which sibling proposed the value), so the second is
  // suppressed as a duplicate instead of producing a redundant finding row. Reset per run.
  private recordedForgedBodyKeys = new Set<string>();

  // CONTENT keys of every response the crawler already collected legitimately (http_events) for the
  // site under analysis. An HTTP forge whose response is in here returned data this user can already
  // reach by normal browsing — not an access-control leak — so it is not flagged, even when that
  // response differs from the one the reference request returned. Primed per run (primeResponseHistory)
  // and never includes anything the forge itself produced.
  private responseHistoryKeys = new Set<string>();

  // CLIENT-ROUTING already-accessible corpus (reactContentKey): the content key of every React state the
  // crawler already captured, primed per run. A client-routing candidate whose rendered state is in here
  // renders a page the user already reaches by normal browsing — not a leak. (Cross-candidate dedup is NOT
  // here any more: it is done on the leaked route in vulnerabilityId — see keepClientRoutingByContent.)
  private collectedReactKeys = new Set<string>();

  // CLIENT-ROUTING SIBLING-GROUP confirmation (see .claude/rules/analysis.md). A client-routing probe is
  // flaky on a fetch-gated route (ejoy's locked lessons load their content by id over XHR; a single real
  // load can snapshot an incomplete render and read as a false NEGATIVE), so which paid siblings surface
  // flips run-to-run. But siblings of one reference node that share the swap PATH and the authz-relevant
  // keys are structurally identical resources behind the same route: if the probe genuinely confirms ONE
  // (a real, distinct, not-found-passing render), the others are a logical consequence. `clientGroupConfirmed`
  // holds the key of every group a sibling genuinely confirmed; `clientGroupPending` holds the record
  // thunks of siblings the per-candidate probe REJECTED, replayed once their group is confirmed. Both reset
  // per run. SAFETY: this only ever ADDS siblings to an ALREADY-confirmed group — it can never confirm a
  // group with zero genuine accepts, so it recovers the flaky-lost siblings of a real finding without
  // manufacturing a finding where the detector found nothing.
  private clientGroupConfirmed = new Set<string>();
  private clientGroupPending = new Map<string, Array<() => void>>();

  // NEGATIVE sibling-group inference, the mirror of the confirmation above: once `clientRoutingGroupRejectAfter`
  // siblings of one group were rejected by a DETERMINISTIC redirect-away to the SAME target (clozemaster
  // bounces every paid story to /pro), the remaining siblings are skipped instead of probed (508 per group
  // there). Only redirect-away counts: probe flakiness yields false negatives on inert/capture, never a
  // redirect. Skipped siblings are still stashed, so a later genuine confirmation recovers them. Reset per run.
  private clientGroupRedirects = new Map<string, Map<string, number>>();
  private clientGroupRejected = new Set<string>();
  private clientGroupSkippedCount = 0;

  constructor(private deps: CandidateEvaluatorDeps) {}

  /** Starts a fresh run: drops the per-run log/dedup state and re-sizes the forge concurrency bound. */
  reset(): void {
    this.loggedFindingIds.clear();
    this.recordedForgedBodyKeys.clear();
    this.clientGroupConfirmed.clear();
    this.clientGroupPending.clear();
    this.clientGroupRedirects.clear();
    this.clientGroupRejected.clear();
    this.clientGroupSkippedCount = 0;
    this.forgeSemaphore = new Semaphore(this.deps.options.maxConcurrentRequests);
  }

  /**
   * Builds the client-routing NOVELTY corpus: the reactContentKey of every React state the crawler
   * already captured for this site. A client-routing candidate whose live-rendered state hashes to one
   * of these renders a page the user can already reach by normal browsing — not a leak. Streamed one
   * graph at a time (forEachGraphBySite) so the full corpus is never materialised; called once per run
   * before any candidate, mirroring primeResponseHistory on the HTTP side.
   */
  primeReactHistory({ site }: { site: string }): void {
    this.collectedReactKeys = new Set<string>();
    this.deps.reactStateStore.forEachGraphBySite({ site, onGraph: (graph) => {
      const key = reactContentKey({ graph });
      if (key !== undefined) this.collectedReactKeys.add(key);
    } });
  }

  /**
   * ALREADY-ACCESSIBLE gate for a client-routing finding: captures the candidate route's live React state
   * and drops it when that state is one the crawler ALREADY collected (a page the user reaches by normal
   * browsing at a different url — e.g. `/terms/press-center` rendering the crawled `/press-center`).
   * Returns true to KEEP, false to DROP. A missing key (no extension / unreadable graph) KEEPS the finding —
   * drop only on positive evidence.
   *
   * The cross-candidate DUPLICATE check that used to live here was removed: it keyed on the live
   * reactContentKey, which renders a near-identical paywall shell for every LOCKED sibling (ejoy's 1033 vs
   * 1035), so distinct paid lessons hashed equal and all but one were wrongly dropped. Cross-candidate dedup
   * now happens deterministically on the leaked ROUTE, in `vulnerabilityId` (clientRoute) — see its doc.
   */
  private async keepClientRoutingByContent({ pageUrl, candidateUrl, context }: {
    pageUrl: string; candidateUrl: string; context: string;
  }): Promise<boolean> {
    const key = await this.deps.clientRoutingVerifier.captureReactContentKey({ pageUrl, candidateUrl });
    if (key === undefined) return true;
    if (this.collectedReactKeys.has(key)) {
      log.debug(`AnalysisPipeline: client-routing candidate not flagged (renders a React state the crawler already collected — already-accessible) — ${context}`);
      return false;
    }
    return true;
  }

  /**
   * Sibling-group key for a client-routing candidate: the reference component INSTANCE (stateId + node)
   * on a given page, the swapped field (`path`) and the authz-relevant keys. Every sibling swap that one
   * reference node produces shares it; a different authz signature forms a different group, so unrelated
   * entitlements never cross-confirm. See the clientGroup* fields.
   */
  private clientGroupKey({ pageUrl, candidate, authz }: {
    pageUrl: string; candidate: ReturnType<typeof findCandidates>[number]; authz: AuthzAssessment;
  }): string {
    return [pageUrl, candidate.stateId, candidate.referenceNodeId, JSON.stringify(candidate.path), [...authz.sensitiveKeys].sort().join(',')].join('\u0000');
  }

  /**
   * A client-routing sibling the per-candidate probe REJECTED: not recorded now, but stashed under its
   * group. If any sibling of the group is later genuinely confirmed, the group flush records it — the
   * reject was most likely a flaky render, not a real negative. `record` captures the recordFinding call.
   */
  private stashClientSibling({ groupKey, record }: { groupKey: string; record: () => void }): void {
    const list = this.clientGroupPending.get(groupKey) ?? [];
    list.push(record);
    this.clientGroupPending.set(groupKey, list);
  }

  /**
   * Counts a sibling's reject towards its group's negative inference: only a redirect-away counts, per
   * target. Reaching `clientRoutingGroupRejectAfter` redirects to one target marks the group rejected.
   */
  private noteClientGroupReject({ groupKey, reason }: { groupKey: string; reason: string }): void {
    const threshold = this.deps.options.clientRoutingGroupRejectAfter ?? 3;
    const target = redirectAwayTarget(reason);
    if (threshold <= 0 || !target || this.clientGroupRejected.has(groupKey)) return;
    const perTarget = this.clientGroupRedirects.get(groupKey) ?? new Map<string, number>();
    const count = (perTarget.get(target) ?? 0) + 1;
    perTarget.set(target, count);
    this.clientGroupRedirects.set(groupKey, perTarget);
    if (count >= threshold) {
      this.clientGroupRejected.add(groupKey);
      log.info(`AnalysisPipeline: client-routing sibling group rejected — ${count} siblings redirected to ${target}; skipping the rest of the group`);
    }
  }

  /**
   * True (and the sibling stashed) when its group was already rejected by negative inference: the caller
   * skips the probe. Confirmation wins over rejection — an already-confirmed group never reaches here.
   */
  private skipRejectedClientGroup({ groupKey, record }: { groupKey: string; record: () => void }): boolean {
    if (!this.clientGroupRejected.has(groupKey)) return false;
    this.clientGroupSkippedCount++;
    this.stashClientSibling({ groupKey, record });
    return true;
  }

  /** Client-routing siblings skipped by negative group inference this run (for the end-of-run log). */
  get clientGroupSkipped(): number {
    return this.clientGroupSkippedCount;
  }

  /** Marks a client-routing group confirmed by a genuine accept and immediately replays its pending siblings. */
  private confirmClientGroup({ groupKey }: { groupKey: string }): void {
    this.clientGroupConfirmed.add(groupKey);
    this.flushClientGroup({ groupKey });
  }

  /** Records every still-pending sibling of a (now confirmed) client-routing group, once (the list is consumed). */
  private flushClientGroup({ groupKey }: { groupKey: string }): void {
    const list = this.clientGroupPending.get(groupKey);
    if (!list) return;
    this.clientGroupPending.delete(groupKey);
    for (const record of list) record();
  }

  /**
   * End-of-run backstop for client-routing sibling groups: records any still-pending sibling whose group
   * was confirmed. confirmClientGroup already flushes eagerly, so this only catches the race where a
   * sibling's probe rejected (and stashed it) AFTER its group's confirming flush had already run. Called
   * once by AnalysisPipeline after every candidate task settles, before the final finding count.
   */
  finalizeClientGroups(): void {
    for (const groupKey of [...this.clientGroupPending.keys()]) {
      if (this.clientGroupConfirmed.has(groupKey)) this.flushClientGroup({ groupKey });
    }
  }

  /**
   * Rebuilds the response-history guard set from the site's already-captured http_events: the content
   * key (canonicalResponseKey) of every event that carries a body. Called once per run, before any
   * candidate is evaluated, so an HTTP forge whose response matches one of these — data the crawler
   * already obtained legitimately — is recognised as already-accessible and never flagged.
   */
  primeResponseHistory({ site }: { site: string }): void {
    // Streamed one row at a time (forEachResponse), so the full corpus of bodies is never held in
    // memory at once — only the resulting hash set is kept. This is what the 568 MB/17k-event promova
    // site needs: folding the bodies into keys, not materialising them.
    this.responseHistoryKeys = new Set<string>();
    this.deps.httpEventStore.forEachResponse({ site, onRow: (r) => {
      const key = canonicalResponseKey({ status: r.status ?? 0, body: r.body ?? '' });
      if (key !== undefined) this.responseHistoryKeys.add(key);
    } });
  }

  /** How many findings THIS run confirmed (what the end-of-run summary reports). */
  get confirmedCount(): number {
    return this.loggedFindingIds.size;
  }

  /**
   * Logs a confirmed finding once per analysis run (deduped by id), independent of whether the DB row
   * was newly inserted. `inserted === false` means the finding was already recorded by an earlier run,
   * surfaced in the message so the count in the logs still matches `vulnerabilitiesFlagged`. Returns
   * whether this was the first time the finding was logged this run (callers need no more than that).
   */
  private logConfirmedFinding({ id, message, inserted }: { id: string; message: string; inserted: boolean }): boolean {
    if (this.loggedFindingIds.has(id)) return false;
    this.loggedFindingIds.add(id);
    log.warning(`${message}${inserted ? '' : ' [already recorded in a previous run]'}`);
    return true;
  }
  /**
   * The cheapest gate, and deliberately the FIRST one every candidate passes. It is pure: a diff of the
   * two React nodes' props (compareObj) classified for authorization-relevance (assessAuthZ, cached in
   * authz_classifications) — no network, no live browser. A candidate whose props carry no entitlement
   * signal (two public resources differing only by id/name/href) can never become a finding, since every
   * evaluator already required `isAuthzRelevant` before recording. Rejecting it HERE, before any forged
   * request or client-routing probe, skips the whole expensive half of the pipeline for it — and the
   * relevance verdict (an entitlement-shaped props diff) is exactly the "high suspicion" signal the
   * costlier stages key off (it gates the full-navigation escalation in clientSideConfirmed). Returns the
   * assessment (its `.differences` is reused downstream) or null when not authz-relevant (already logged).
   */
  private async authzGate({ candidate, context }: {
    candidate: ReturnType<typeof findCandidates>[number]; context: string;
  }): Promise<AuthzAssessment | null> {
    // Scope the diff to the SWAPPED resource's own subtree before classifying: a generic key elsewhere in
    // a whole-component swap (a nav/sidebar's `user`) must not license the finding — only an entitlement
    // attached to the swapped id (ejoy's `lesson.lock` under `lesson.id`). See scopeDiffsToResource.
    const differences = scopeDiffsToResource({
      differences: compareObj(candidate.referenceProps, candidate.candidateProps),
      swapPath: candidate.path,
    });
    // Classify WITHOUT the swapped identifier's own diff (excludeSwapDiff), but keep the full diff on the
    // returned assessment so the recorded motivation still shows what was swapped.
    const authz = await assessAuthZ({ differences: excludeSwapDiff({ differences, swapPath: candidate.path }), classifier: this.deps.classifier });
    if (!authz.isAuthzRelevant) {
      log.debug(`AnalysisPipeline: candidate rejected (no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}) — ${context} | ${describeDiffs(differences)}`);
      return null;
    }
    return { ...authz, differences };
  }

  /**
   * The HTTP-only content guards for a genuine HTTP finding's forged response, run before it is recorded.
   * Returns true to DROP the candidate (logging why), false to keep it. Synchronous, and the only state it
   * touches is adding the forged response's content key to recordedForgedBodyKeys on a keep — so, with no
   * await between this call and the record, that check-and-add stays atomic under concurrent evaluation.
   * Never run for a client-routing finding: it carries no server-response evidence to key on.
   */
  private httpContentGuardReject({ forged, original, context }: {
    forged: ResponseLike; original: ResponseLike; context: string;
  }): boolean {
    // Server REJECTED/errored (4xx/5xx, notably 401/403 "access denied"): the resource was never reached,
    // so never a leak. Fires when the ORIGINAL also errored (two similar error bodies would look like a
    // match) and keeps an expired-token run honest (every forge 401/403 → nothing flagged, no stale 200).
    if (forged.status >= 400) {
      log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response status ${forged.status}: access denied / error, not a leak) — ${context}`);
      return true;
    }
    // No actual data (`{}`, `[]`, or an all-empty wrapper like {"data":{"data":[],"total":0}}): leaked nothing.
    if (isEmptyJsonResponse({ body: forged.body })) {
      log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response carries no data: empty object/array) — ${context}`);
      return true;
    }
    // Error envelope despite 200 (`{"error":true}`, a top-level `error` string/object, `success:false`,
    // `status:"error"`): reached nothing even with real-looking fields beside the flag (apps like Mondly).
    if (isErrorEnvelopeResponse({ body: forged.body })) {
      log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response is an error envelope despite 200) — ${context}`);
      return true;
    }
    const forgedKey = canonicalResponseKey({ status: forged.status, body: forged.body });
    // The reference event's OWN response is excluded from the history check: a forge returning the
    // original's body is the "server ignored the value" case, not "accessible at some OTHER url".
    const referenceKey = canonicalResponseKey({ status: original.status, body: original.body });
    if (forgedKey !== undefined) {
      // (1) History: the forged data is a response the crawler already collected at a DIFFERENT url —
      // the user can already reach it, so not a leak.
      if (forgedKey !== referenceKey && this.responseHistoryKeys.has(forgedKey)) {
        log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response already in the crawler's own http_events — already-accessible data) — ${context}`);
        return true;
      }
      // (2) Dedup: an earlier candidate this run produced a byte/JSON-identical forged response (the same
      // leak reached from another sibling) — record it once, drop the duplicate.
      if (this.recordedForgedBodyKeys.has(forgedKey)) {
        log.debug(`AnalysisPipeline: HTTP candidate not flagged (duplicate forged response of an already-recorded finding) — ${context}`);
        return true;
      }
      this.recordedForgedBodyKeys.add(forgedKey);
    }
    return false;
  }

  /**
   * The shared tail of every evaluator once a candidate is CONFIRMED: build the finding id (always from
   * `method` + the recorded `candidateUrl`, the url that leaked), record it (deduped by the store), log it
   * once per run, and — only on a newly inserted row — write the reproduction script. Centralises the
   * record/log/repro contract the three evaluate* paths used to repeat verbatim.
   */
  private recordFinding({ site, method, referenceUrl, candidateUrl, candidate, segment, motivation, detectionMethod, responseSimilarity, authz, logMessage, reproduction }: {
    site: string; method: string; referenceUrl: string; candidateUrl: string;
    candidate: ReturnType<typeof findCandidates>[number]; segment: SegmentCandidate; motivation: string;
    detectionMethod: 'http' | 'client-routing'; responseSimilarity: ResponseSimilarity | null;
    authz: AuthzAssessment; logMessage: string;
    reproduction: { referenceUrl: string; candidateUrl: string; kind: ReproductionKind };
  }): void {
    // Semantic dedup key (see vulnerabilityId's own doc): HTTP keys on origin+method (the LAYER) +
    // the sibling-pair swap identity (stateId, refNodeId, candNodeId, path); CLIENT-ROUTING keys on the
    // leaked ROUTE (the canonical reconciled candidateUrl), so the same lesson reached from two reference
    // pages collapses to one. Falls back to the raw candidateUrl if URL parsing throws — never expected.
    let origin: string;
    try { origin = new URL(candidateUrl).origin; } catch { origin = candidateUrl; }
    const id = vulnerabilityId({
      site, origin, method,
      stateId: candidate.stateId, referenceNodeId: candidate.referenceNodeId, candidateNodeId: candidate.candidateNodeId, path: candidate.path,
      clientRoute: method === CLIENT_ROUTING_METHOD ? normalizeUrl(candidateUrl) : undefined,
    });
    const inserted = this.deps.vulnerabilityStore.record({
      id, site, referenceUrl, candidateUrl, method,
      referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue,
      motivation, detectionMethod, responseSimilarity, authzDiff: authz,
      // mutated-value position for the paper's Fig. 4 (path index from the right, or a query param)
      segmentLocation: segment.location,
      segmentIndex: segment.location === 'path' ? (segment.indexFromRight ?? null) : null,
    });
    this.logConfirmedFinding({ id, inserted, message: logMessage });
    if (inserted) {
      this.writeReproduction({
        id, site, referenceUrl: reproduction.referenceUrl, candidateUrl: reproduction.candidateUrl,
        motivation, differences: authz.differences, sensitiveKeys: authz.sensitiveKeys, candidate,
        kind: reproduction.kind,
      });
    }
  }

  /**
   * The client-routing fallback for an HTTP candidate the forge did NOT confirm: for a QUERY-PARAM
   * candidate only, check whether the SPA honours the value client-side anyway (pushState/popstate probe
   * against event.pageUrl's React tree, with its own content-novelty gate). Returns 'client-routing' when
   * it confirms, or null to DROP. A path-segment candidate drops here — `url` is the forged API endpoint,
   * with no sound targetUrl to replay; path segments get the fallback via evaluateClientRoutingPathCandidate.
   */
  private async clientRoutingQueryFallback({ event, candidate, segment }: {
    event: ReturnType<HttpEventStore['listBySite']>[number];
    candidate: ReturnType<typeof findCandidates>[number];
    segment: SegmentCandidate;
  }): Promise<'client-routing' | null> {
    if (!segment.paramName) return null;
    const paramName = segment.paramName;
    // Only re-apply the param to event.pageUrl when that page ACTUALLY uses it as a route param. The
    // param lived in an API query (the value matched a React node), and event.pageUrl is merely where
    // that XHR fired — not necessarily a route that honours the param. talkpal's mode-progress XHR fires
    // on /sentence-mode and /word-mode (no `modeType` in their URL); re-applying `?modeType=<sibling>`
    // there navigates a 200 page that ignores the param and renders its own content, so every sibling
    // "confirms" — a systematic false positive. A param genuinely part of the page route (pimsleur's
    // `/…?id=`) is present in pageUrl, so real fallbacks are untouched. Can only DROP, never add.
    let pageUsesParam = false;
    try { pageUsesParam = new URL(event.pageUrl).searchParams.has(paramName); } catch { pageUsesParam = false; }
    if (!pageUsesParam) {
      log.debug(`AnalysisPipeline: client-routing fallback skipped — ${event.pageUrl} does not use ?${paramName} as a route param`);
      return null;
    }
    const clientCandidateUrl = withParam({ url: event.pageUrl, name: paramName, value: candidate.candidateValue });
    // highSuspicion: the authz gate already passed, licensing the verifier's stage-3 full-navigation
    // escalation if the cheap pushState stage is inconclusive.
    const reason = await this.deps.clientRoutingVerifier.verifyQueryParam({
      pageUrl: event.pageUrl, candidateUrl: clientCandidateUrl, paramName,
      candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), highSuspicion: true,
    });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${event.pageUrl} ?${paramName}=${candidate.candidateValue}`);
      return null;
    }
    // Content novelty/uniqueness gate (navigates the client route, not the forge url): drop a state the
    // crawler already collected, or a duplicate of an earlier finding this run.
    if (!await this.keepClientRoutingByContent({ pageUrl: event.pageUrl, candidateUrl: clientCandidateUrl, context: `${event.pageUrl} ?${paramName}=${candidate.candidateValue}` })) return null;
    return 'client-routing';
  }

  async evaluateHttpCandidate({ page, site, event, url, candidate, segment }: {
    page?: Page; site: string;   // page is absent in offline/replay mode (forge is cache-only, see below)
    event: ReturnType<HttpEventStore['listBySite']>[number];
    url: string;
    candidate: ReturnType<typeof findCandidates>[number];
    segment: SegmentCandidate;
  }): Promise<void> {
    const { forgedRequestStore, options } = this.deps;

    // CHEAP FIRST — the pure authz gate before any live forged request (see authzGate). Not authz-
    // relevant → no forge, no client-routing probe, nothing. `differences` below is the diff it computed.
    const authz = await this.authzGate({ candidate, context: `${event.method} ${event.url} -> ${url}` });
    if (!authz) return;
    const differences = authz.differences;

    const forged = await this.forgeSemaphore.run(async () => {
      const res = await forgeRequestCached({
        cache: forgedRequestStore, site, page, url, method: event.method,
        // Re-point the captured t1 headers at the re-authenticated session when a refresh happened
        // (strip stale cookie / overlay fresh bearer); a no-op when authOverride is undefined.
        headers: applyAuthOverride({ headers: event.requestHeaders, override: options.authOverride }),
        postData: event.postData,
        requireCache: options.offline,
      });
      await sleep(options.timeBetweenRequestsMs);
      return res;
    });

    // Reference body fetched lazily (events are listed without bodies, see listMetaBySite): past the
    // forge semaphore this path has no further await, so only a few bodies are ever live at once.
    const responseBody = event.id !== undefined ? this.deps.httpEventStore.getResponseBody({ site, id: event.id }) : event.responseBody;
    const original = { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: responseBody ?? '', contentType: event.contentType };
    const similarity = getServerResponseSimilarity(original, forged);
    // A forged response identical to the original one means the server ignored the swapped value:
    // nothing leaked over HTTP, however similar the two look. Treated like a non-similar response, so
    // the candidate still gets the client-routing fallback below (the SPA might honour the value
    // client-side even though the server does not) — with its own inert-value guard.
    const serverIgnoredValue = similarity.areSimilar && isIdenticalResponse({ reference: original, candidate: forged });
    if (serverIgnoredValue) {
      log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response identical to the original: the server ignores the value) — ${event.url} -> ${url}`);
    }

    let detectionMethod: 'http' | 'client-routing' = 'http';
    if (!similarity.areSimilar || serverIgnoredValue) {
      // Offline/replay: the client-routing fallback is a live probe and is not available, so a candidate
      // the forge did not confirm is simply dropped (the demo reports only the forge-confirmed HTTP subset).
      if (options.offline) return;
      // The forge didn't look like a leak — for a QUERY param, see if the SPA honours the value client-side
      // anyway (clientRoutingQueryFallback). null → drop; otherwise continue as a client-routing finding.
      const fallback = await this.clientRoutingQueryFallback({ event, candidate, segment });
      if (fallback === null) return;
      detectionMethod = fallback;
    }

    // HTTP-only content guards (httpContentGuardReject): they key on the forged response's CONTENT, the
    // evidence for an HTTP finding — a client-routing finding carries none, so it skips them. Synchronous
    // and the last step before recordFinding (also synchronous), so the dedup check-and-add stays atomic.
    if (detectionMethod === 'http' && this.httpContentGuardReject({ forged, original, context: `${event.url} -> ${url}` })) return;

    this.recordFinding({
      site, method: event.method, referenceUrl: event.url, candidateUrl: url, candidate, segment,
      motivation: describeDiffs(differences), detectionMethod, responseSimilarity: similarity, authz,
      logMessage: `AnalysisPipeline: potential access control issue (${detectionMethod}) — extracted ${describeExtractedSegment({ segment, candidate })} | ${event.method} ${event.url} -> ${url}`,
      // The forge url is the reference for an HTTP finding; the client-routing fallback reproduces the
      // client route from the page url instead (its kind differs too).
      reproduction: detectionMethod === 'http'
        ? { referenceUrl: event.url, candidateUrl: url, kind: { type: 'http', method: event.method, headers: event.requestHeaders, postData: event.postData, baselineStatus: event.status ?? 0, baselineHeaders: event.responseHeaders ?? {}, baselineBody: responseBody ?? '', baselineContentType: event.contentType } }
        : { referenceUrl: event.pageUrl, candidateUrl: url, kind: { type: 'client-routing-query', paramName: segment.paramName!, candidateValue: candidate.candidateValue } },
    });
  }

  /**
   * For a query param the SPA only ever reads client-side (its value never reaches any captured
   * HTTP request): there is no server response to forge/compare, so this goes straight to the
   * live pushState+popstate probe, mirroring the client-routing tail of evaluateHttpCandidate.
   */
  async evaluateClientRoutingCandidate({ site, pageUrl, paramName, candidateUrl, candidate, segment }: {
    site: string; pageUrl: string; paramName: string; candidateUrl: string;
    candidate: ReturnType<typeof findCandidates>[number]; segment: SegmentCandidate;
  }): Promise<void> {
    // CHEAP FIRST — pure authz gate before the live pushState probe (see authzGate).
    const authz = await this.authzGate({ candidate, context: `${pageUrl} ?${paramName}=${candidate.candidateValue}` });
    if (!authz) return;
    const differences = authz.differences;

    // The record action for THIS sibling, reused whether it is confirmed on its own probe or recovered
    // from a confirmed sibling of its group (see the clientGroup* fields).
    const record = () => this.recordFinding({
      site, method: CLIENT_ROUTING_METHOD, referenceUrl: pageUrl, candidateUrl, candidate, segment,
      motivation: describeDiffs(differences), detectionMethod: 'client-routing', responseSimilarity: null, authz,
      logMessage: `AnalysisPipeline: potential access control issue (client-routing) — extracted query param "${paramName}": ${String(candidate.referenceValue)} -> ${candidate.candidateValue} | ${pageUrl} -> ${candidateUrl}`,
      reproduction: { referenceUrl: pageUrl, candidateUrl, kind: { type: 'client-routing-query', paramName, candidateValue: candidate.candidateValue } },
    });
    const groupKey = this.clientGroupKey({ pageUrl, candidate, authz });
    // A sibling of an ALREADY-confirmed group: record it without re-probing (see evaluateClientRoutingPathCandidate).
    if (this.clientGroupConfirmed.has(groupKey)) { record(); return; }
    if (this.skipRejectedClientGroup({ groupKey, record })) return;

    const reason = await this.deps.clientRoutingVerifier.verifyQueryParam({
      pageUrl, candidateUrl, paramName,
      candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), highSuspicion: true,
    });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${pageUrl} ?${paramName}=${candidate.candidateValue}`);
      this.stashClientSibling({ groupKey, record });
      this.noteClientGroupReject({ groupKey, reason });
      return;
    }
    if (!await this.keepClientRoutingByContent({ pageUrl, candidateUrl, context: `${pageUrl} ?${paramName}=${candidate.candidateValue}` })) return;

    record();
    this.confirmClientGroup({ groupKey });
  }

  /**
   * Path-segment analog of evaluateClientRoutingCandidate, for a candidate like busuu's
   * objective_<uuid> that only ever appears in the page's own URL path (no http_event shares that
   * path shape, so there is nothing to forge/compare server-side): goes straight to
   * checkClientSideRoutingForPath, the path equivalent of the pushState+popstate probe above.
   */
  async evaluateClientRoutingPathCandidate({ site, pageUrl, candidateUrl, candidate, segment }: {
    site: string; pageUrl: string; candidateUrl: string;
    candidate: ReturnType<typeof findCandidates>[number]; segment: SegmentCandidate;
  }): Promise<void> {
    // CHEAP FIRST — the pure authz gate before the live client-routing probe (see authzGate).
    const authz = await this.authzGate({ candidate, context: `${pageUrl} -> ${candidateUrl}` });
    if (!authz) return;
    const differences = authz.differences;

    // highSuspicion (passed to the probe below): the authz gate just passed, so this candidate's props
    // point at an authorization boundary — which is what licenses clientSideConfirmed to escalate to a real
    // navigation (stage 3) when the cheap pushState stage is inconclusive (e.g. ejoy's Next.js router
    // ignoring a synthetic popstate for a sibling lesson).
    // Reconcile the whole url to the chosen sibling resource. `spliceSegment` swapped one path segment but
    // re-attached the reference's query, so when the swapped identity is DUPLICATED in the url the query
    // copy is now stale. rewriteCorrelatedQuery rewrites that copy from the SIBLING's own state (ejoy keeps
    // every lesson's content path — hash included — on its sibling node, even paid ones with lock:true), so
    // `1030 -> 1032` becomes the real paid-lesson url `…/1032?path=…/lessons/1032/<h2>.json` — the leaked-
    // capability IDOR this detector exists to forge. If the old value STILL lingers (nothing correlated —
    // ejoy's courseId 37->32, whose ?path= carries a LESSON path absent from the COURSE node), the swap is
    // incoherent and can't be reconciled from state, so it is DROPPED (we never probe a query-stripped clean
    // path: that tested a different url than the user reaches and only produced false positives).
    const refValue = String(candidate.referenceValue);
    let probeUrl = candidateUrl;
    if (this.deps.options.clientRoutingPathCoherence) {
      probeUrl = rewriteCorrelatedQuery({ url: candidateUrl, referenceValue: refValue, referenceProps: candidate.referenceProps, candidateProps: candidate.candidateProps });
      if (urlEmbedsValue(probeUrl, refValue)) {
        log.debug(`AnalysisPipeline: candidate rejected (incoherent path swap — reference value ${refValue} still in the url after the correlated rewrite) — ${pageUrl} -> ${candidateUrl}`);
        return;
      }
    }
    // Everything downstream uses `confirmedUrl` (the clean path when the coherence check stripped the
    // query), so the content guard, finding id, record and reproduction all reflect the url that leaked.
    const confirmedUrl = probeUrl;
    // The record action for THIS sibling, reused whether it is confirmed on its own probe or recovered
    // from a confirmed sibling of its group (see the clientGroup* fields).
    const record = () => this.recordFinding({
      site, method: CLIENT_ROUTING_METHOD, referenceUrl: pageUrl, candidateUrl: confirmedUrl, candidate, segment,
      motivation: describeDiffs(differences), detectionMethod: 'client-routing', responseSimilarity: null, authz,
      logMessage: `AnalysisPipeline: potential access control issue (client-routing path) — extracted path segment: ${String(candidate.referenceValue)} -> ${candidate.candidateValue} | ${pageUrl} -> ${confirmedUrl}`,
      reproduction: { referenceUrl: pageUrl, candidateUrl: confirmedUrl, kind: { type: 'client-routing-path', candidateUrl: confirmedUrl } },
    });
    const groupKey = this.clientGroupKey({ pageUrl, candidate, authz });
    // A sibling of an ALREADY-confirmed group: record it without re-probing. The group's confirming
    // sibling already proved the route honours the swap client-side; a fresh flaky probe here would only
    // risk losing this structurally-identical sibling (the content guards are skipped for the same reason).
    if (this.clientGroupConfirmed.has(groupKey)) { record(); return; }
    // The mirror: a group already rejected by deterministic redirects is skipped (see clientGroupRejected).
    if (this.skipRejectedClientGroup({ groupKey, record })) return;

    const reason = await this.probeClientRoutingPath({ pageUrl, candidateUrl: probeUrl, candidate, highSuspicion: true });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${pageUrl} -> ${probeUrl}`);
      // Maybe a flaky render, not a real negative: stash under the group and recover it if a sibling confirms.
      this.stashClientSibling({ groupKey, record });
      this.noteClientGroupReject({ groupKey, reason });
      return;
    }
    if (!await this.keepClientRoutingByContent({ pageUrl, candidateUrl: confirmedUrl, context: `${pageUrl} -> ${confirmedUrl}` })) return;

    record();
    this.confirmClientGroup({ groupKey });
  }

  /**
   * One client-routing path probe + content-guard decision: the cheap pushState/popstate probe against
   * `candidateUrl`, then clientSideConfirmed. Returns null to ACCEPT, or a rejection reason string.
   * `highSuspicion` is forwarded to clientSideConfirmed to license its stage-3 full-navigation escalation.
   */
  private async probeClientRoutingPath({ pageUrl, candidateUrl, candidate, highSuspicion }: {
    pageUrl: string; candidateUrl: string; candidate: ReturnType<typeof findCandidates>[number]; highSuspicion: boolean;
  }): Promise<string | null> {
    return this.deps.clientRoutingVerifier.verifyPathSegment({
      pageUrl, candidateUrl,
      candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), highSuspicion,
    });
  }

  /** Assembles the common fields every call site above already has in scope and delegates to writeReproductionScript. */
  private writeReproduction({ id, site, referenceUrl, candidateUrl, motivation, differences, sensitiveKeys, candidate, kind }: {
    id: string; site: string; referenceUrl: string; candidateUrl: string; motivation: string;
    differences: PropDiff[]; sensitiveKeys: string[];
    candidate: ReturnType<typeof findCandidates>[number];
    kind: ReproductionKind;
  }): void {
    writeReproductionScript({
      id, site, referenceUrl, candidateUrl, motivation, differences, sensitiveKeys,
      referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue,
      referenceProps: candidate.referenceProps, candidateProps: candidate.candidateProps,
      userDataDir: this.deps.options.userDataDir, reportsDir: this.deps.options.reportsDir,
      clientRoutingProbe: this.deps.options.clientRoutingProbe,
      kind,
    });
  }
}
