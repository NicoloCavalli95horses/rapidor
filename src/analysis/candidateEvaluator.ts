import { log } from 'crawlee';
import type { Page } from 'playwright';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { ReactStateStore } from '../db/ReactStateStore';
import type { VulnerabilityStore } from '../db/VulnerabilityStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { reactContentKey } from './reactFingerprint';
import { findCandidates } from './matchFinder';
import { type SegmentCandidate } from './segments';
import { forgeRequestCached } from './requestForge';
import { applyAuthOverride, type AuthOverride } from './authSession';
import { rewriteCorrelatedQuery } from './correlatedQuery';
import { getServerResponseSimilarity, isIdenticalResponse, canonicalResponseKey, isEmptyJsonResponse, compareObj, scopeDiffsToResource, describeDiffs, type PropDiff } from './responseEvaluate';
import { assessAuthZ, type AuthzClassifier, type AuthzAssessment } from './authzClassifier';
import { CLIENT_ROUTING_METHOD, vulnerabilityId, describeExtractedSegment } from './findings';
import { Semaphore, sleep, withParam, urlEmbedsValue } from '../utils/utils';
import { writeReproductionScript, type ReproductionKind } from './reproductionScript';
import type { ClientRoutingVerifier } from './clientRoutingVerifier';

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

  // CLIENT-ROUTING content guards, the React analog of the HTTP pair above (reactContentKey):
  // `collectedReactKeys` holds the content key of every React state the crawler already captured (the
  // novelty corpus, primed per run); `recordedReactKeys` holds the keys of client-routing findings
  // already recorded THIS run (the uniqueness/dedup set, reset per run). A client-routing candidate
  // whose rendered state is in the first is already-accessible; one in the second is a duplicate.
  private collectedReactKeys = new Set<string>();
  private recordedReactKeys = new Set<string>();

  constructor(private deps: CandidateEvaluatorDeps) {}

  /** Starts a fresh run: drops the per-run log/dedup state and re-sizes the forge concurrency bound. */
  reset(): void {
    this.loggedFindingIds.clear();
    this.recordedForgedBodyKeys.clear();
    this.recordedReactKeys.clear();
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
   * Content-uniqueness/novelty gate for a client-routing finding (the client-side analog of the HTTP
   * path's canonicalResponseKey guards): captures the candidate route's live React state and requires it
   * to be NEW (not a page the crawler already collected) and UNIQUE (no earlier finding this run rendered
   * the same content). Returns true to KEEP, false to DROP. A missing key (no extension / unreadable
   * graph) KEEPS the finding — drop only on positive evidence. (The capture is async, so the check-and-add
   * on recordedReactKeys is not atomic across candidates: a rare concurrent duplicate may slip through,
   * never a wrongful drop.)
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
    if (this.recordedReactKeys.has(key)) {
      log.debug(`AnalysisPipeline: client-routing candidate not flagged (duplicate rendered content of an already-recorded finding) — ${context}`);
      return false;
    }
    this.recordedReactKeys.add(key);
    return true;
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
    const authz = await assessAuthZ({ differences, classifier: this.deps.classifier });
    if (!authz.isAuthzRelevant) {
      log.debug(`AnalysisPipeline: candidate rejected (no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}) — ${context} | ${describeDiffs(differences)}`);
      return null;
    }
    return authz;
  }

  async evaluateHttpCandidate({ page, site, event, url, candidate, segment }: {
    page?: Page; site: string;   // page is absent in offline/replay mode (forge is cache-only, see below)
    event: ReturnType<HttpEventStore['listBySite']>[number];
    url: string;
    candidate: ReturnType<typeof findCandidates>[number];
    segment: SegmentCandidate;
  }): Promise<void> {
    const { vulnerabilityStore, forgedRequestStore, options } = this.deps;

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
      // Offline/replay: the client-routing fallback is a live probe and is not available, so a
      // candidate the forge did not confirm is simply dropped. The demo therefore reports only the
      // forge-confirmed (pure HTTP) findings — exactly the deterministic subset (see demo/README.md).
      if (options.offline) return;
      // The forged request itself didn't look like it leaked anything (or outright failed) — for a
      // query-param candidate, check whether the SPA's own client-side routing honors it anyway,
      // independently of the server response (RAPIDOR's testClientSideQueryParamsUsage fallback).
      // By the time analysis runs (end of exploration), `page` may well be sitting on a different
      // state than the one this event was captured from, so it is navigated back to event.pageUrl
      // first — otherwise the pushState/popstate probe would run against the wrong React tree.
      // Path-segment candidates aren't retried this way here: `url` is the forged HTTP request's own
      // URL (an API endpoint), which has no reason to share the page's URL shape, so there is no
      // sound `targetUrl` to replay via pushState against `event.pageUrl`'s React tree. Path segments
      // only get the client-routing fallback when they come from the page's own URL in the first
      // place (the pageUrls loop below, see evaluateClientRoutingPathCandidate).
      if (!segment.paramName) return;
      const paramName = segment.paramName;
      const clientCandidateUrl = withParam({ url: event.pageUrl, name: paramName, value: candidate.candidateValue });
      // highSuspicion: the authz gate at the top of this method already passed, so a full-navigation
      // escalation (the verifier's stage 3) is licensed if the cheap pushState stage is inconclusive.
      const reason = await this.deps.clientRoutingVerifier.verifyQueryParam({
        pageUrl: event.pageUrl, candidateUrl: clientCandidateUrl, paramName,
        candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), highSuspicion: true,
      });
      if (reason) {
        log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${event.pageUrl} ?${paramName}=${candidate.candidateValue}`);
        return;
      }
      detectionMethod = 'client-routing';
      // Content novelty/uniqueness gate for the client-routing fallback (navigates the client route, not
      // the forge URL): drop if it renders a state the crawler already collected, or a duplicate of an
      // earlier finding this run.
      if (!await this.keepClientRoutingByContent({ pageUrl: event.pageUrl, candidateUrl: clientCandidateUrl, context: `${event.pageUrl} ?${paramName}=${candidate.candidateValue}` })) return;
    }

    // HTTP-only content guards (see canonicalResponseKey). Both key on the forged response's CONTENT,
    // so they apply only to a genuine HTTP finding — the forged response IS the evidence there; a
    // client-routing finding carries no server-response evidence and is never deduped this way. A
    // forged response with no body yields no key, so neither guard can fire and the finding is kept
    // (same conservative stance as isIdenticalResponse: drop only on positive evidence). Note there is
    // no await between here and the record below on the HTTP path, so the check-and-add on
    // recordedForgedBodyKeys is atomic despite concurrent candidate evaluation.
    if (detectionMethod === 'http') {
      // A forged request the server REJECTED or errored on (4xx/5xx — notably 401/403 "access denied")
      // never reached the resource, so it is never a leak. This fires when the ORIGINAL was also an
      // error (two similar error bodies would otherwise look like a match), and it keeps an expired-token
      // run honest: every forge comes back 401/403 and nothing is flagged, instead of a stale 200 being
      // trusted. The client-routing fallback above is independent and already ran for a query param.
      if (forged.status >= 400) {
        log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response status ${forged.status}: access denied / error, not a leak) — ${event.url} -> ${url}`);
        return;
      }
      // Empty-data guard: a forge that returns no actual data (`{}`, `[]`, or an all-empty wrapper such
      // as {"data":{"data":[],"total":0}}) leaked nothing, however much it differs from the reference.
      if (isEmptyJsonResponse({ body: forged.body })) {
        log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response carries no data: empty object/array) — ${event.url} -> ${url}`);
        return;
      }
      const forgedKey = canonicalResponseKey({ status: forged.status, body: forged.body });
      // The reference event's own response, EXCLUDED from the history check below: a forge that returns
      // the original's own body is the "server ignored the swapped value" case (already handled above by
      // isIdenticalResponse / serverIgnoredValue), not "data accessible at some OTHER URL". Only a match
      // with a DIFFERENT captured response means already-accessible-elsewhere.
      const referenceKey = canonicalResponseKey({ status: original.status, body: original.body });
      if (forgedKey !== undefined) {
        // (1) History: the forged data is a response the crawler already collected legitimately at a
        // DIFFERENT URL (http_events) — this user can already reach it, so it is not a leak.
        if (forgedKey !== referenceKey && this.responseHistoryKeys.has(forgedKey)) {
          log.debug(`AnalysisPipeline: HTTP candidate not flagged (forged response already in the crawler's own http_events — already-accessible data) — ${event.url} -> ${url}`);
          return;
        }
        // (2) Dedup: an earlier candidate this run already produced a byte/JSON-identical forged
        // response — the same leak reached from a second sibling. Record it once, drop the duplicate.
        if (this.recordedForgedBodyKeys.has(forgedKey)) {
          log.debug(`AnalysisPipeline: HTTP candidate not flagged (duplicate forged response of an already-recorded finding) — ${event.url} -> ${url}`);
          return;
        }
        this.recordedForgedBodyKeys.add(forgedKey);
      }
    }

    const id = vulnerabilityId({ candidateValue: candidate.candidateValue, nodeId: candidate.candidateNodeId, method: event.method, url });
    const inserted = vulnerabilityStore.record({
      id, site,
      referenceUrl: event.url, candidateUrl: url, method: event.method,
      referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue,
      motivation: describeDiffs(differences),
      detectionMethod,
      responseSimilarity: similarity, authzDiff: authz,
    });
    this.logConfirmedFinding({
      id, inserted,
      message: `AnalysisPipeline: potential access control issue (${detectionMethod}) — extracted ${describeExtractedSegment({ segment, candidate })} | ${event.method} ${event.url} -> ${url}`,
    });
    if (inserted) {
      this.writeReproduction({
        id, site, motivation: describeDiffs(differences), differences: authz.differences, sensitiveKeys: authz.sensitiveKeys,
        candidate,
        ...(detectionMethod === 'http'
          ? { referenceUrl: event.url, candidateUrl: url, kind: { type: 'http' as const, method: event.method, headers: event.requestHeaders, postData: event.postData, baselineStatus: event.status ?? 0, baselineHeaders: event.responseHeaders ?? {}, baselineBody: responseBody ?? '', baselineContentType: event.contentType } }
          : { referenceUrl: event.pageUrl, candidateUrl: url, kind: { type: 'client-routing-query' as const, paramName: segment.paramName!, candidateValue: candidate.candidateValue } }),
      });
    }
  }

  /**
   * For a query param the SPA only ever reads client-side (its value never reaches any captured
   * HTTP request): there is no server response to forge/compare, so this goes straight to the
   * live pushState+popstate probe, mirroring the client-routing tail of evaluateHttpCandidate.
   */
  async evaluateClientRoutingCandidate({ site, pageUrl, paramName, candidateUrl, candidate }: {
    site: string; pageUrl: string; paramName: string; candidateUrl: string;
    candidate: ReturnType<typeof findCandidates>[number];
  }): Promise<void> {
    const { vulnerabilityStore, options } = this.deps;
    const { clientRoutingProbe } = options;

    // CHEAP FIRST — pure authz gate before the live pushState probe (see authzGate).
    const authz = await this.authzGate({ candidate, context: `${pageUrl} ?${paramName}=${candidate.candidateValue}` });
    if (!authz) return;
    const differences = authz.differences;

    const reason = await this.deps.clientRoutingVerifier.verifyQueryParam({
      pageUrl, candidateUrl, paramName,
      candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), highSuspicion: true,
    });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${pageUrl} ?${paramName}=${candidate.candidateValue}`);
      return;
    }
    if (!await this.keepClientRoutingByContent({ pageUrl, candidateUrl, context: `${pageUrl} ?${paramName}=${candidate.candidateValue}` })) return;

    const id = vulnerabilityId({
      candidateValue: candidate.candidateValue, nodeId: candidate.candidateNodeId,
      method: CLIENT_ROUTING_METHOD, url: candidateUrl,
    });
    const inserted = vulnerabilityStore.record({
      id, site,
      referenceUrl: pageUrl, candidateUrl, method: CLIENT_ROUTING_METHOD,
      referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue,
      motivation: describeDiffs(differences),
      detectionMethod: 'client-routing',
      responseSimilarity: null, authzDiff: authz,
    });
    this.logConfirmedFinding({
      id, inserted,
      message: `AnalysisPipeline: potential access control issue (client-routing) — extracted query param "${paramName}": ${String(candidate.referenceValue)} -> ${candidate.candidateValue} | ${pageUrl} -> ${candidateUrl}`,
    });
    if (inserted) {
      this.writeReproduction({
        id, site, referenceUrl: pageUrl, candidateUrl, motivation: describeDiffs(differences),
        differences: authz.differences, sensitiveKeys: authz.sensitiveKeys, candidate,
        kind: { type: 'client-routing-query', paramName, candidateValue: candidate.candidateValue },
      });
    }
  }

  /**
   * Path-segment analog of evaluateClientRoutingCandidate, for a candidate like busuu's
   * objective_<uuid> that only ever appears in the page's own URL path (no http_event shares that
   * path shape, so there is nothing to forge/compare server-side): goes straight to
   * checkClientSideRoutingForPath, the path equivalent of the pushState+popstate probe above.
   */
  async evaluateClientRoutingPathCandidate({ site, pageUrl, candidateUrl, candidate }: {
    site: string; pageUrl: string; candidateUrl: string;
    candidate: ReturnType<typeof findCandidates>[number];
  }): Promise<void> {
    const { vulnerabilityStore } = this.deps;

    // CHEAP FIRST — the pure authz gate before the live client-routing probe (see authzGate).
    const authz = await this.authzGate({ candidate, context: `${pageUrl} -> ${candidateUrl}` });
    if (!authz) return;
    const differences = authz.differences;

    // highSuspicion: the authz gate just passed, so this candidate's props already point at an
    // authorization boundary — which is what licenses clientSideConfirmed to escalate to a real
    // navigation (stage 3) when the cheap pushState stage is inconclusive (e.g. ejoy's Next.js router
    // ignoring a synthetic popstate for a sibling lesson).
    // Coherence of the swapped url. `spliceSegment` re-attaches the reference's query, so a one-segment
    // path swap is INCOHERENT whenever the OLD value also lives elsewhere in the url: ejoy keeps the id in
    // `?path=` too, so `37 -> 32` yields `/courses/32/314/1030?path=…/live/37/lessons/1030/…` — the new
    // courseId in the route, the OLD one still in the query. Probing THAT renders a Frankenstein page
    // (course-32 chrome + course-37 content) that differs from the reference by the course-level chrome,
    // a false positive the value-masking inert guard can't neutralise (the chrome differs by course NAME,
    // not by the masked number). The only meaningful probe is the clean path (the SPA infers its params
    // from it): a sibling lesson (`1030 -> 1031`) is then a real test, an incoherent course swap renders
    // not-found and is rejected. So when the reference value lingers, probe the query-stripped path; if it
    // STILL lingers there (the old value sits in another path segment), the candidate can't be made
    // coherent at all — drop it.
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
    const reason = await this.probeClientRoutingPath({ pageUrl, candidateUrl: probeUrl, candidate, highSuspicion: true });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${pageUrl} -> ${probeUrl}`);
      return;
    }
    // Everything downstream uses `confirmedUrl` (the clean path when the coherence check stripped the
    // query), so the content guard, finding id, record and reproduction all reflect the url that leaked.
    const confirmedUrl = probeUrl;
    if (!await this.keepClientRoutingByContent({ pageUrl, candidateUrl: confirmedUrl, context: `${pageUrl} -> ${confirmedUrl}` })) return;

    const id = vulnerabilityId({
      candidateValue: candidate.candidateValue, nodeId: candidate.candidateNodeId,
      method: CLIENT_ROUTING_METHOD, url: confirmedUrl,
    });
    const inserted = vulnerabilityStore.record({
      id, site,
      referenceUrl: pageUrl, candidateUrl: confirmedUrl, method: CLIENT_ROUTING_METHOD,
      referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue,
      motivation: describeDiffs(differences),
      detectionMethod: 'client-routing',
      responseSimilarity: null, authzDiff: authz,
    });
    this.logConfirmedFinding({
      id, inserted,
      message: `AnalysisPipeline: potential access control issue (client-routing path) — extracted path segment: ${String(candidate.referenceValue)} -> ${candidate.candidateValue} | ${pageUrl} -> ${confirmedUrl}`,
    });
    if (inserted) {
      this.writeReproduction({
        id, site, referenceUrl: pageUrl, candidateUrl: confirmedUrl, motivation: describeDiffs(differences),
        differences: authz.differences, sensitiveKeys: authz.sensitiveKeys, candidate,
        kind: { type: 'client-routing-path', candidateUrl: confirmedUrl },
      });
    }
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
