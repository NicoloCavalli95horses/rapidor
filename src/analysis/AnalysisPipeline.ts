import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { PreindexedValueStore } from '../db/PreindexedValueStore';
import type { ReactStateStore } from '../db/ReactStateStore';
import type { CrawlStateStore } from '../db/CrawlStateStore';
import type { VulnerabilityStore, StoredFinding } from '../db/VulnerabilityStore';
import type { AnalysisStatsStore } from '../db/AnalysisStatsStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { spliceSegment, type SegmentCandidate } from './segments';
import { findCandidates } from './matchFinder';
import { forgeRequestCached } from './requestForge';
import { runWithConcurrency, sleep, Semaphore, withParam } from '../utils/utils';
import { getServerResponseSimilarity, isIdenticalResponse, compareObj, describeDiffs, type PropDiff } from './responseEvaluate';
import { assessAuthZ, type AuthzClassifier, type AuthzAssessment } from './authzClassifier';
import { PagePool } from './PagePool';
import { CandidateGenerator } from './candidateGenerator';
import { CLIENT_ROUTING_METHOD, vulnerabilityId, normalizeUrl, describeExtractedSegment } from './findings';
import { ClientRoutingVerifier } from './clientRoutingVerifier';
import { formatDuration } from '../core/duration';
import { writeReproductionScript, type ReproductionKind } from './reproductionScript';

export interface AnalysisPipelineOptions {
  maxConcurrentRequests: number;
  timeBetweenRequestsMs: number;
  dbPath: string;          // so a generated reproduction script can re-read the exact React snapshot a finding came from
  userDataDir?: string;    // so it can reopen the same (authenticated, if persistent) browser profile
  reportsDir: string;      // reproduction scripts land in <reportsDir>/<site>/<findingId>.repro.ts
  clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };  // see config.analysis.clientRoutingProbe's own comment
  clientRoutingConcurrency: number; // pages the client-routing phase probes on in parallel (see config.analysis.clientRoutingConcurrency)
  maxSegmentMatches: number; // skip a URL segment whose value appears in more preindexed nodes than this: a generic keyword, not an identifier (see config.analysis.maxSegmentMatches)
  notFoundDomMaxDiff: number; // a client-routing candidate whose normalized DOM differs from the calibrated not-found page by no more than this fraction (of text nodes AND of element count) is the app's own not-found page, not a real resource — rejected (see config.analysis.notFoundDomMaxDiff)
  segmentBlacklist: string[]; // path-segment values never mutated: app-shell/section prefixes, not identifiers (see config.analysis.segmentBlacklist)
  clientRoutingFullNavigationEscalation: boolean; // allow clientSideConfirmed's strict stage-3 real-navigation escalation for high-suspicion candidates (see config.analysis.clientRoutingFullNavigationEscalation)
  // Offline/replay mode (the deterministic demo, see scripts/runDemo.ts). When true the analysis is
  // pure HTTP and never touches the network: every forged request must already be in the
  // forged_requests cache (a miss throws instead of forging live), the client-routing phase is
  // skipped entirely (its pushState probe + not-found screenshot are live-only and not deterministically
  // replayable — see demo/README.md), and no browser/page is needed. Default false (normal live run).
  offline?: boolean;
}

export interface AnalysisPipelineDeps {
  httpEventStore: HttpEventStore;
  preindexStore: PreindexedValueStore;
  reactStateStore: ReactStateStore;
  crawlStateStore: CrawlStateStore;
  vulnerabilityStore: VulnerabilityStore;
  statsStore: AnalysisStatsStore;
  // shared with AblationPipeline — see ForgedRequestStore's own doc comment
  forgedRequestStore: ForgedRequestStore;
  classifier: AuthzClassifier;
  options: AnalysisPipelineOptions;
}


/**
 * Server-side port of RAPIDOR's preindex -> matchFinder -> requestGenerator -> responseEvaluator
 * chain: for every captured HTTP event of a site, proposes an alternative segment value (from a
 * sibling component instance), forges the replacement request, and flags+persists a vulnerability
 * when the response looks like it succeeded AND the differing props are authorization-relevant.
 *
 * Query params and path segments a SPA only ever reads/routes on itself — never sent to the backend
 * in any request with the same shape, so they'd never be extracted at all if seeding came only from
 * http_events — are seeded separately, from the crawler's own captured page URLs (reactStateStore),
 * and tested purely via checkClientSideRouting/checkClientSideRoutingForPath (there is no server
 * request to forge for these; see evaluateClientRoutingCandidate/evaluateClientRoutingPathCandidate).
 *
 * Before generating any request, a candidate URL is checked against the crawler's own history
 * (every URL seen in http_events, react_states, AND crawl_states — see the `historyUrls` set built
 * in runForSite): if the exact same URL is already something this user reached through ordinary
 * exploration, swapping in that value isn't evidence of unauthorized access, so it's skipped as a
 * false positive rather than flagged.
 *
 * Every count along the way (segments extracted, matches found, candidates found, requests
 * generated) is recorded to AnalysisStatsStore, one row per site, for later averaging.
 */

export class AnalysisPipeline {
  // Pool of pages the client-routing phase runs its probes/screenshots on, in parallel (see PagePool).
  private pagePool = new PagePool();
  // Bounds concurrent forged HTTP requests independently of the page pool (the forge uses
  // page.request.fetch, which needs no page DOM, so it is not gated by the pool). Mirrors
  // maxConcurrentRequests. Re-created per run.
  private forgeSemaphore: Semaphore = new Semaphore(1);

  // Per-run cache of React graphs parsed from the DB. findUrlCandidates looks a state's graph up
  // once per preindex match (tens of thousands of times for a rich site), but there are only as
  // many DISTINCT graphs as captured react_states (a couple hundred at most): without this, the

  // Finding ids this analysis run has already logged. The WARN for a confirmed finding must reflect
  // what THIS run determined, not whether the row happens to be new to the DB: vulnerabilityStore
  // dedups with INSERT OR IGNORE, so a re-run on a DB that already holds the finding (runAnalysisFromDb
  // never clears) would otherwise log nothing while `vulnerabilitiesFlagged` still reports it. We log
  // on confirmation regardless of DB novelty, deduped per run by this set so the same finding reached
  // from two reference events is not logged twice. Cleared at the start of each runForSite.
  private loggedFindingIds = new Set<string>();

  // The preindex -> matchFinder half (pure, no browser); reset() per run clears its graph cache.
  private candidateGenerator: CandidateGenerator;

  // The client-side-routing DOM verification subsystem (probe + stage ladder + content guards).
  private clientRoutingVerifier: ClientRoutingVerifier;

  constructor(private deps: AnalysisPipelineDeps) {
    this.candidateGenerator = new CandidateGenerator({
      preindexStore: deps.preindexStore,
      reactStateStore: deps.reactStateStore,
      maxSegmentMatches: deps.options.maxSegmentMatches,
      segmentBlacklist: deps.options.segmentBlacklist,
    });
    this.clientRoutingVerifier = new ClientRoutingVerifier({
      pagePool: this.pagePool,
      options: {
        clientRoutingProbe: deps.options.clientRoutingProbe,
        notFoundDomMaxDiff: deps.options.notFoundDomMaxDiff,
        clientRoutingFullNavigationEscalation: deps.options.clientRoutingFullNavigationEscalation,
      },
    });
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

  async runForSite({ page, site, explorationMs }: { page?: Page; site: string; explorationMs: number }): Promise<void> {
    const analysisStartedAt = Date.now();
    this.candidateGenerator.reset();
    this.clientRoutingVerifier.reset();
    this.loggedFindingIds.clear();
    const { httpEventStore, reactStateStore, crawlStateStore, vulnerabilityStore, statsStore, options } = this.deps;
    const events = httpEventStore.listBySite(site);
    const pageUrls = reactStateStore.listUrlsBySite(site);
    const crawledStates = crawlStateStore.listBySite(site);
    // Every URL the crawler already reached on its own, through any channel it records — not just
    // the two lists above: also the DFS exploration's own visited states (crawl_states), which may
    // carry URLs neither http_events nor react_states ever saw (e.g. a state RAPIDOR failed to
    // capture). A candidate that lands on one of these isn't an authz issue: it's a page/request this
    // same user can already reach by clicking around normally, so flagging it is a false positive
    // (e.g. busuu's own "dashboard/review" -> "dashboard/community", both just ordinary nav targets).
    const historyUrls = new Set<string>([
      ...events.map((e) => normalizeUrl(e.url)),
      ...pageUrls.map((u) => normalizeUrl(u)),
      ...crawledStates.map((s) => normalizeUrl(s.url)),
    ]);
    this.candidateGenerator.warnOnMissingReactStateCoverage({ site, crawledStates, pageUrls });
    const seen = new Set<string>(); // dedup candidate requests within this run
    const tasks: (() => Promise<void>)[] = [];

    let segmentsExtracted = 0;
    let matchesFound = 0;
    let candidatesFound = 0;

    for (const event of events) {
      // Only GET is ever forged. Replaying a captured POST/PUT/PATCH/DELETE with a swapped id would
      // re-trigger a state change on the target site (record progress, mutate/delete another user's
      // resource) — unsafe and unethical for an authz probe, which must only READ. Non-GET events are
      // skipped here; forgeRequest also refuses them as a hard backstop.
      if (event.method.toUpperCase() !== 'GET') continue;
      const found = this.candidateGenerator.findUrlCandidates({ url: event.url });
      segmentsExtracted += found.segments;
      matchesFound += found.matches;
      for (const { segment, candidate } of found.items) {
        candidatesFound++;
        const url = spliceSegment({ parts: segment.parts, index: segment.index, value: candidate.candidateValue, query: segment.query });
        if (historyUrls.has(normalizeUrl(url))) continue;
        const key = `http|${event.method}|${url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tasks.push(() => this.evaluateHttpCandidate({ page, site, event, url, candidate, segment }));
      }
    }

    // Client-routing candidates (seeded from the crawler's own page URLs) are probed live — a
    // pushState+popstate against the real app, plus a not-found screenshot. Neither is deterministically
    // replayable offline, so the offline demo skips this whole phase and stays HTTP-only (see
    // AnalysisPipelineOptions.offline and demo/README.md).
    for (const pageUrl of options.offline ? [] : pageUrls) {
      const found = this.candidateGenerator.findUrlCandidates({ url: pageUrl });
      segmentsExtracted += found.segments;
      matchesFound += found.matches;
      for (const { segment, candidate } of found.items) {
        candidatesFound++;
        const paramName = segment.paramName;
        if (paramName) {
          const candidateUrl = new URL(pageUrl);
          candidateUrl.searchParams.set(paramName, candidate.candidateValue);
          if (historyUrls.has(normalizeUrl(candidateUrl.href))) continue;
          const key = `client|${pageUrl}|${paramName}|${candidate.candidateValue}`;
          if (seen.has(key)) continue;
          seen.add(key);
          tasks.push(() => this.evaluateClientRoutingCandidate({ site, pageUrl, paramName, candidateUrl: candidateUrl.href, candidate }));
        } else {
          // path segment of the page's own route (e.g. busuu's objective_<uuid>): no matching
          // http_event exists for it, so the only probe available is the page's own client-side
          // routing (see checkClientSideRoutingForPath).
          const candidateUrl = spliceSegment({ parts: segment.parts, index: segment.index, value: candidate.candidateValue, query: segment.query });
          if (historyUrls.has(normalizeUrl(candidateUrl))) continue;
          const key = `client|${pageUrl}|path|${candidateUrl}`;
          if (seen.has(key)) continue;
          seen.add(key);
          tasks.push(() => this.evaluateClientRoutingPathCandidate({ site, pageUrl, candidateUrl, candidate }));
        }
      }
    }

    if (tasks.length > 0) {
      const poolSize = Math.max(1, options.clientRoutingConcurrency);
      log.info(options.offline
        ? `AnalysisPipeline: dispatching ${tasks.length} candidate request(s) for ${site} (offline/replay — HTTP only, ${options.maxConcurrentRequests} forge slot(s), no browser)`
        : `AnalysisPipeline: dispatching ${tasks.length} candidate request(s) for ${site} (${poolSize} client-routing page(s), ${options.maxConcurrentRequests} forge slot(s))`);
      this.forgeSemaphore = new Semaphore(options.maxConcurrentRequests);
      // Offline is HTTP-only: every task is a cache-served forge gated by forgeSemaphore, none needs a
      // pool page, so the browser-backed pool is never created (page may be undefined here).
      if (!options.offline && page) await this.pagePool.setup({ page, size: poolSize });
      try {
        // Isolate each candidate: one task throwing (a forged request erroring, a client-routing probe
        // whose navigation destroys the page context, ...) must not reject the whole pool and abort the
        // run — that would lose analysis_stats and every not-yet-dispatched candidate. A failure is
        // logged and treated as "no finding", same as a candidate that was simply rejected.
        const guarded = tasks.map((task) => async () => {
          try {
            await task();
          } catch (err) {
            log.warning(`AnalysisPipeline: candidate task failed (skipped): ${(err as Error).message}`);
          }
        });
        // Outer limit is the page-pool size: client-routing tasks are gated by the pool, forge-only
        // tasks by forgeSemaphore, so letting this many run keeps the pool fed without over-forging.
        await runWithConcurrency({ tasks: guarded, limit: Math.max(poolSize, options.maxConcurrentRequests) });
      } finally {
        if (!options.offline) await this.pagePool.teardown();
      }
    }

    const analysisMs = Date.now() - analysisStartedAt;
    const flagged = vulnerabilityStore.count(site);
    log.info(`AnalysisPipeline: ${site} — ${flagged} vulnerabilit${flagged === 1 ? 'y' : 'ies'} flagged (${this.loggedFindingIds.size} confirmed this run), exploration ${formatDuration(explorationMs)}, analysis ${formatDuration(analysisMs)}`);

    statsStore.record({
      site,
      httpEvents: events.length,
      segmentsExtracted,
      reactStates: reactStateStore.countBySite(site),
      matchesFound,
      candidatesFound,
      requestsGenerated: tasks.length,
      vulnerabilitiesFlagged: vulnerabilityStore.count(site),
      explorationMs,
      analysisMs,
    });
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

  private async evaluateHttpCandidate({ page, site, event, url, candidate, segment }: {
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
      const reason = await this.clientRoutingVerifier.verifyQueryParam({
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
  private async evaluateClientRoutingCandidate({ site, pageUrl, paramName, candidateUrl, candidate }: {
    site: string; pageUrl: string; paramName: string; candidateUrl: string;
    candidate: ReturnType<typeof findCandidates>[number];
  }): Promise<void> {
    const { vulnerabilityStore, options } = this.deps;
    const { clientRoutingProbe } = options;

    // CHEAP FIRST — pure authz gate before the live pushState probe (see authzGate).
    const authz = await this.authzGate({ candidate, context: `${pageUrl} ?${paramName}=${candidate.candidateValue}` });
    if (!authz) return;
    const differences = authz.differences;

    const reason = await this.clientRoutingVerifier.verifyQueryParam({
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
  private async evaluateClientRoutingPathCandidate({ site, pageUrl, candidateUrl, candidate }: {
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
    return this.clientRoutingVerifier.verifyPathSegment({
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

  /**
   * Re-runs today's accept/reject decision on findings ALREADY in the `vulnerabilities` table, without
   * regenerating candidates and without writing anything (no vulnerabilities, stats, reports). A
   * targeted regression check for a change to the guards: instead of re-analysing a whole site (tens
   * of minutes, hundreds of candidates), only the stored findings are re-examined and the caller sees,
   * per finding, whether it would still be flagged and why not.
   *
   * What it re-runs is exactly the tail of the normal path, from the stored URLs/values:
   * - `http`: the forged response (from the forged_requests cache, so normally no new request) is
   *   compared to the captured original; a non-similar or identical response falls through to the
   *   client-routing fallback, as evaluateHttpCandidate does;
   * - `client-routing`: the probe + the DOM content guards (clientSideConfirmed). The page URL and the
   *   swapped param/segment are recovered from the stored reference/candidate URLs (for a finding that
   *   came from the http fallback, the page URL is the captured event's own page_url).
   * The authz-relevance step is not re-run: it depends only on the React props, which this change does
   * not touch, so the stored finding already passed it.
   */
  async recheckFindings({ page, site, findings }: {
    page: Page; site: string; findings: StoredFinding[];
  }): Promise<{ finding: StoredFinding; kept: boolean; reason: string }[]> {
    this.clientRoutingVerifier.reset();
    const events = this.deps.httpEventStore.listBySite(site);
    await this.pagePool.setup({ page, size: Math.max(1, this.deps.options.clientRoutingConcurrency) });
    try {
      return await Promise.all(findings.map(async (finding) => {
        try {
          const reason = await this.recheckOne({ site, finding, events, page });
          return { finding, kept: reason === null, reason: reason ?? 'still flagged' };
        } catch (err) {
          return { finding, kept: false, reason: `recheck failed: ${(err as Error).message}` };
        }
      }));
    } finally {
      await this.pagePool.teardown();
    }
  }

  /** One finding of recheckFindings: a rejection reason, or null if it would still be flagged. */
  private async recheckOne({ site, finding, events, page }: {
    site: string; finding: StoredFinding; events: ReturnType<HttpEventStore['listBySite']>; page: Page;
  }): Promise<string | null> {
    const { referenceUrl, candidateUrl, referenceValue, candidateValue } = finding;
    const probe = this.deps.options.clientRoutingProbe;

    // A finding the http path produced (detected over HTTP, or via its client-routing fallback): the
    // stored reference URL is the captured request, its page is that event's page_url.
    const event = finding.method !== CLIENT_ROUTING_METHOD
      ? events.find((e) => e.url === referenceUrl && e.method.toUpperCase() === finding.method.toUpperCase())
      : undefined;
    if (finding.method !== CLIENT_ROUTING_METHOD && !event) return 'original http event not found in http_events';

    if (event) {
      if (finding.detectionMethod === 'http') {
        const forged = await forgeRequestCached({
          cache: this.deps.forgedRequestStore, site, page, url: candidateUrl, method: event.method, headers: event.requestHeaders, postData: event.postData,
        });
        const original = { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: event.responseBody ?? '', contentType: event.contentType };
        const similar = getServerResponseSimilarity(original, forged).areSimilar;
        if (similar && !isIdenticalResponse({ reference: original, candidate: forged })) return null;
        const why = similar ? 'forged response identical to the original (server ignores the value)' : 'forged response not similar';
        // the same client-routing fallback evaluateHttpCandidate would run
        const fallback = await this.recheckQueryFallback({ pageUrl: event.pageUrl, referenceUrl, referenceValue, candidateValue, probe });
        return fallback === null ? null : `${why}; client-routing fallback: ${fallback}`;
      }
      return this.recheckQueryFallback({ pageUrl: event.pageUrl, referenceUrl, referenceValue, candidateValue, probe });
    }

    // A pure client-routing finding: reference_url is the page, candidate_url its mutated route.
    const ref = new URL(referenceUrl);
    const cand = new URL(candidateUrl);
    if (ref.pathname === cand.pathname) {
      const paramName = [...cand.searchParams.keys()].find((k) => cand.searchParams.get(k) === candidateValue && ref.searchParams.get(k) !== candidateValue);
      if (!paramName) return 'cannot tell which query param was swapped';
      return this.clientRoutingVerifier.verifyQueryParam({
        pageUrl: referenceUrl, candidateUrl, paramName, candidateValue,
        referenceValue: ref.searchParams.get(paramName) ?? referenceValue, highSuspicion: true,
      });
    }
    // path segment: the stored reference value is not always the bare segment, so take the segment
    // that actually differs between the two paths (used only for masking the reference render)
    const refSegs = ref.pathname.split('/');
    const candSegs = cand.pathname.split('/');
    const i = candSegs.findIndex((seg, k) => seg !== refSegs[k]);
    return this.clientRoutingVerifier.verifyPathSegment({
      pageUrl: referenceUrl, candidateUrl, candidateValue,
      referenceValue: i >= 0 ? decodeURIComponent(refSegs[i] ?? '') : referenceValue, highSuspicion: true,
    });
  }

  /** The http path's client-routing fallback, rebuilt from a stored finding: same param, swapped on the event's own page. */
  private async recheckQueryFallback({ pageUrl, referenceUrl, referenceValue, candidateValue, probe }: {
    pageUrl: string; referenceUrl: string; referenceValue: string; candidateValue: string;
    probe: { minWaitMs: number; idleMs: number; maxWaitMs: number };
  }): Promise<string | null> {
    const paramName = [...new URL(referenceUrl).searchParams.entries()].find(([, v]) => v === referenceValue)?.[0];
    // a path-segment candidate gets no client-routing fallback on the http path (see evaluateHttpCandidate)
    if (!paramName) return 'no client-routing fallback for a path-segment http candidate';
    const candidateUrl = withParam({ url: pageUrl, name: paramName, value: candidateValue });
    return this.clientRoutingVerifier.verifyQueryParam({
      pageUrl, candidateUrl, paramName, candidateValue, referenceValue, highSuspicion: true,
    });
  }

}



