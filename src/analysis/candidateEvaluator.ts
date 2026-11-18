import { log } from 'crawlee';
import type { Page } from 'playwright';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { VulnerabilityStore } from '../db/VulnerabilityStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { findCandidates } from './matchFinder';
import { type SegmentCandidate } from './segments';
import { forgeRequestCached } from './requestForge';
import { getServerResponseSimilarity, isIdenticalResponse, compareObj, describeDiffs, type PropDiff } from './responseEvaluate';
import { assessAuthZ, type AuthzClassifier, type AuthzAssessment } from './authzClassifier';
import { CLIENT_ROUTING_METHOD, vulnerabilityId, describeExtractedSegment } from './findings';
import { Semaphore, sleep, withParam } from '../utils/utils';
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
}

export interface CandidateEvaluatorDeps {
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

  constructor(private deps: CandidateEvaluatorDeps) {}

  /** Starts a fresh run: drops the per-run log dedup and re-sizes the forge concurrency bound. */
  reset(): void {
    this.loggedFindingIds.clear();
    this.forgeSemaphore = new Semaphore(this.deps.options.maxConcurrentRequests);
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
    const differences = compareObj(candidate.referenceProps, candidate.candidateProps);
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
        cache: forgedRequestStore, site, page, url, method: event.method, headers: event.requestHeaders, postData: event.postData,
        requireCache: options.offline,
      });
      await sleep(options.timeBetweenRequestsMs);
      return res;
    });

    const original = { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: event.responseBody ?? '', contentType: event.contentType };
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
          ? { referenceUrl: event.url, candidateUrl: url, kind: { type: 'http' as const, method: event.method, headers: event.requestHeaders, postData: event.postData, baselineStatus: event.status ?? 0, baselineHeaders: event.responseHeaders ?? {}, baselineBody: event.responseBody ?? '', baselineContentType: event.contentType } }
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
    const reason = await this.probeClientRoutingPath({ pageUrl, candidateUrl, candidate, highSuspicion: true });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${pageUrl} -> ${candidateUrl}`);
      return;
    }

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
      message: `AnalysisPipeline: potential access control issue (client-routing path) — extracted path segment: ${String(candidate.referenceValue)} -> ${candidate.candidateValue} | ${pageUrl} -> ${candidateUrl}`,
    });
    if (inserted) {
      this.writeReproduction({
        id, site, referenceUrl: pageUrl, candidateUrl, motivation: describeDiffs(differences),
        differences: authz.differences, sensitiveKeys: authz.sensitiveKeys, candidate,
        kind: { type: 'client-routing-path', candidateUrl },
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
