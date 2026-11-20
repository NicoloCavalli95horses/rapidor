import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { PreindexedValueStore } from '../db/PreindexedValueStore';
import type { ReactStateStore } from '../db/ReactStateStore';
import type { CrawlStateStore } from '../db/CrawlStateStore';
import type { VulnerabilityStore, StoredFinding } from '../db/VulnerabilityStore';
import type { AnalysisStatsStore } from '../db/AnalysisStatsStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { spliceSegment, candidateUrlFor } from './segments';
import { runWithConcurrency } from '../utils/utils';
import type { AuthzClassifier } from './authzClassifier';
import { PagePool } from './PagePool';
import { CandidateGenerator } from './candidateGenerator';
import { normalizeUrl } from './findings';
import { ClientRoutingVerifier } from './clientRoutingVerifier';
import { RecheckRunner } from './recheckRunner';
import { CandidateEvaluator } from './candidateEvaluator';
import type { AuthOverride } from './authSession';
import { formatDuration } from '../core/duration';

export interface AnalysisPipelineOptions {
  maxConcurrentRequests: number;
  timeBetweenRequestsMs: number;
  dbPath: string;          // so a generated reproduction script can re-read the exact React snapshot a finding came from
  userDataDir?: string;    // so it can reopen the same (authenticated, if persistent) browser profile
  reportsDir: string;      // reproduction scripts land in <reportsDir>/<site>/<findingId>.repro.ts
  clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };  // see config.analysis.clientRoutingProbe's own comment
  clientRoutingConcurrency: number; // pages the client-routing phase probes on in parallel (see config.analysis.clientRoutingConcurrency)
  maxSegmentMatches: number; // skip a URL segment whose value appears in more preindexed nodes than this: a generic keyword, not an identifier (see config.analysis.maxSegmentMatches)
  maxGeneratedRequests: number; // per-site forge budget: if candidate generation exceeds this, the site is abandoned as infeasible instead of dispatched (see config.analysis.maxGeneratedRequests)
  notFoundDomMaxDiff: number; // a client-routing candidate whose normalized DOM differs from the calibrated not-found page by no more than this fraction (of text nodes AND of element count) is the app's own not-found page, not a real resource — rejected (see config.analysis.notFoundDomMaxDiff)
  segmentBlacklist: string[]; // path-segment values never mutated: app-shell/section prefixes, not identifiers (see config.analysis.segmentBlacklist)
  paramBlacklist: string[]; // query-param NAMES never mutated: pagination/sorting controls, not object references (see config.analysis.paramBlacklist)
  clientRoutingFullNavigationEscalation: boolean; // allow clientSideConfirmed's strict stage-3 real-navigation escalation for high-suspicion candidates (see config.analysis.clientRoutingFullNavigationEscalation)
  clientRoutingEscalationAttempts: number; // total stage-3 attempts (1 = no retry); a retry recovers a flaky false-negative (see config.analysis.clientRoutingEscalationAttempts)
  clientRoutingPathCoherence: boolean; // retry a rejected high-suspicion path candidate once with its query stripped, for routes that infer params from the path (see config.analysis.clientRoutingPathCoherence)
  // Offline/replay mode (the deterministic demo, see scripts/runDemo.ts). When true the analysis is
  // pure HTTP and never touches the network: every forged request must already be in the
  // forged_requests cache (a miss throws instead of forging live), the client-routing phase is
  // skipped entirely (its pushState probe + not-found screenshot are live-only and not deterministically
  // replayable — see demo/README.md), and no browser/page is needed. Default false (normal live run).
  offline?: boolean;
  // When not explicitly false, runForSite deletes this site's previous `vulnerabilities` rows before
  // recording, so the table reflects the current engine's output rather than the union of every past
  // run (VulnerabilityStore.record is INSERT OR IGNORE on a deterministic id, so a stale now-rejected
  // finding would otherwise linger). See config.analysis.overwriteFindingsPerSite. Only `vulnerabilities`
  // is cleared — never the capture tables or the shared forged_requests cache; analysis_stats
  // self-overwrites per site. Undefined => clear (the safe default for a re-analysis).
  overwriteFindingsPerSite?: boolean;
  // Refreshed auth material for a re-analysis run whose captured (t1) session expired: re-points the
  // HTTP forge at the re-authenticated session (strip stale cookie / overlay fresh bearer). Undefined
  // on the common path (token never expired) => forge replays the captured headers verbatim, unchanged.
  authOverride?: AuthOverride;
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

  // Per-run cache of React graphs parsed from the DB. findUrlCandidates looks a state's graph up
  // once per preindex match (tens of thousands of times for a rich site), but there are only as
  // many DISTINCT graphs as captured react_states (a couple hundred at most): without this, the


  // The preindex -> matchFinder half (pure, no browser); reset() per run clears its graph cache.
  private candidateGenerator: CandidateGenerator;

  // The client-side-routing DOM verification subsystem (probe + stage ladder + content guards).
  private clientRoutingVerifier: ClientRoutingVerifier;

  // Turns one proposed swap into a finding or a rejection (authz gate -> forge/probe -> record).
  private candidateEvaluator: CandidateEvaluator;

  // The recheck entry point: replays today's decision over already-stored findings, writes nothing.
  private recheckRunner: RecheckRunner;

  constructor(private deps: AnalysisPipelineDeps) {
    this.candidateGenerator = new CandidateGenerator({
      preindexStore: deps.preindexStore,
      reactStateStore: deps.reactStateStore,
      maxSegmentMatches: deps.options.maxSegmentMatches,
      segmentBlacklist: deps.options.segmentBlacklist,
      paramBlacklist: deps.options.paramBlacklist,
    });
    this.clientRoutingVerifier = new ClientRoutingVerifier({
      pagePool: this.pagePool,
      options: {
        clientRoutingProbe: deps.options.clientRoutingProbe,
        notFoundDomMaxDiff: deps.options.notFoundDomMaxDiff,
        clientRoutingFullNavigationEscalation: deps.options.clientRoutingFullNavigationEscalation,
        clientRoutingEscalationAttempts: deps.options.clientRoutingEscalationAttempts,
      },
    });
    this.candidateEvaluator = new CandidateEvaluator({
      httpEventStore: deps.httpEventStore,
      reactStateStore: deps.reactStateStore,
      vulnerabilityStore: deps.vulnerabilityStore,
      forgedRequestStore: deps.forgedRequestStore,
      classifier: deps.classifier,
      clientRoutingVerifier: this.clientRoutingVerifier,
      options: {
        maxConcurrentRequests: deps.options.maxConcurrentRequests,
        timeBetweenRequestsMs: deps.options.timeBetweenRequestsMs,
        offline: deps.options.offline,
        userDataDir: deps.options.userDataDir,
        reportsDir: deps.options.reportsDir,
        clientRoutingProbe: deps.options.clientRoutingProbe,
        authOverride: deps.options.authOverride,
        clientRoutingPathCoherence: deps.options.clientRoutingPathCoherence,
      },
    });
    this.recheckRunner = new RecheckRunner({
      httpEventStore: deps.httpEventStore,
      forgedRequestStore: deps.forgedRequestStore,
      pagePool: this.pagePool,
      clientRoutingVerifier: this.clientRoutingVerifier,
      options: { clientRoutingConcurrency: deps.options.clientRoutingConcurrency },
    });
  }


  async runForSite({ page, site, explorationMs }: { page?: Page; site: string; explorationMs: number }): Promise<void> {
    const analysisStartedAt = Date.now();
    this.candidateGenerator.reset();
    this.clientRoutingVerifier.reset();
    this.candidateEvaluator.reset();
    const { httpEventStore, reactStateStore, crawlStateStore, vulnerabilityStore, statsStore, options } = this.deps;
    // Re-analysis hygiene (see config.analysis.overwriteFindingsPerSite): this run's findings REPLACE
    // this site's previous ones. VulnerabilityStore.record is INSERT OR IGNORE on a deterministic id,
    // so without this a false positive the current engine now rejects would survive from an older run.
    // Cleared here, before any recording, per site, and ONLY vulnerabilities: the capture tables and
    // the shared forged_requests cache are untouched, and analysis_stats self-overwrites on its PK.
    if (options.overwriteFindingsPerSite !== false) vulnerabilityStore.clearSite({ site });
    // Metadata only (no response bodies): the candidate loop needs URLs/methods, and the few reference
    // bodies it actually compares are fetched lazily per candidate (see listMetaBySite / getResponseBody).
    const events = httpEventStore.listMetaBySite(site);
    // Response-history guard, built by streaming the bodies one row at a time (no full-corpus copy).
    this.candidateEvaluator.primeResponseHistory({ site });
    this.candidateEvaluator.primeReactHistory({ site });   // client-routing novelty corpus (reactContentKey of every collected state)
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
    let chromeZoneSkipped = 0;   // matches dropped because their node sits in nav/footer chrome (domZone)

    for (const event of events) {
      // Only GET is ever forged. Replaying a captured POST/PUT/PATCH/DELETE with a swapped id would
      // re-trigger a state change on the target site (record progress, mutate/delete another user's
      // resource) — unsafe and unethical for an authz probe, which must only READ. Non-GET events are
      // skipped here; forgeRequest also refuses them as a hard backstop.
      if (event.method.toUpperCase() !== 'GET') continue;
      const found = this.candidateGenerator.findUrlCandidates({ url: event.url });
      segmentsExtracted += found.segments;
      matchesFound += found.matches;
      chromeZoneSkipped += found.chromeSkipped;
      for (const { segment, candidate } of found.items) {
        candidatesFound++;
        // candidateUrlFor, not spliceSegment: a query-param candidate must keep the event's OTHER
        // params (see its doc comment — dropping them forged a different request entirely).
        const url = candidateUrlFor({ url: event.url, segment, value: candidate.candidateValue });
        if (historyUrls.has(normalizeUrl(url))) continue;
        // Dedup by the CANONICAL url (normalizeUrl strips volatile `_rsc`-style tokens): two carrier
        // events differing only by an RSC token forge the same logical request, so probe it once and
        // record one finding (promova's main dropped ~20 duplicate findings this way).
        const key = `http|${event.method}|${normalizeUrl(url)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tasks.push(() => this.candidateEvaluator.evaluateHttpCandidate({ page, site, event, url, candidate, segment }));
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
      chromeZoneSkipped += found.chromeSkipped;
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
          tasks.push(() => this.candidateEvaluator.evaluateClientRoutingCandidate({ site, pageUrl, paramName, candidateUrl: candidateUrl.href, candidate }));
        } else {
          // path segment of the page's own route (e.g. busuu's objective_<uuid>): no matching
          // http_event exists for it, so the only probe available is the page's own client-side
          // routing (see checkClientSideRoutingForPath).
          const candidateUrl = spliceSegment({ parts: segment.parts, index: segment.index, value: candidate.candidateValue, query: segment.query });
          if (historyUrls.has(normalizeUrl(candidateUrl))) continue;
          const key = `client|${pageUrl}|path|${candidateUrl}`;
          if (seen.has(key)) continue;
          seen.add(key);
          tasks.push(() => this.candidateEvaluator.evaluateClientRoutingPathCandidate({ site, pageUrl, candidateUrl, candidate }));
        }
      }
    }

    // Per-site forge budget: candidate generation produced more distinct forges than we will fire at a
    // live site (see config.analysis.maxGeneratedRequests). Abandon the site as infeasible — the
    // combinatorial-explosion outcome — instead of dispatching thousands of extra live requests. The
    // main pipeline is bounded by the React preindex so it rarely trips this; it is the shared budget
    // the far more explosive ablation leans on.
    if (tasks.length > options.maxGeneratedRequests) {
      log.warning(`AnalysisPipeline: ${site} ABANDONED as infeasible — ${tasks.length} candidate requests exceed the ${options.maxGeneratedRequests} budget; nothing dispatched`);
      statsStore.record({
        site, httpEvents: events.length, segmentsExtracted, reactStates: reactStateStore.countBySite(site),
        matchesFound, candidatesFound, requestsGenerated: tasks.length, vulnerabilitiesFlagged: 0,
        explorationMs, analysisMs: Date.now() - analysisStartedAt, infeasible: true,
      });
      return;
    }

    if (chromeZoneSkipped > 0) {
      log.info(`AnalysisPipeline: ${site} — ${chromeZoneSkipped} preindex match(es) skipped as navigation/footer chrome (domZone), out of ${matchesFound} (${(100 * chromeZoneSkipped / Math.max(1, matchesFound)).toFixed(1)}%)`);
    }

    if (tasks.length > 0) {
      const poolSize = Math.max(1, options.clientRoutingConcurrency);
      log.info(options.offline
        ? `AnalysisPipeline: dispatching ${tasks.length} candidate request(s) for ${site} (offline/replay — HTTP only, ${options.maxConcurrentRequests} forge slot(s), no browser)`
        : `AnalysisPipeline: dispatching ${tasks.length} candidate request(s) for ${site} (${poolSize} client-routing page(s), ${options.maxConcurrentRequests} forge slot(s))`);
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
    log.info(`AnalysisPipeline: ${site} — ${flagged} vulnerabilit${flagged === 1 ? 'y' : 'ies'} flagged (${this.candidateEvaluator.confirmedCount} confirmed this run), exploration ${formatDuration(explorationMs)}, analysis ${formatDuration(analysisMs)}`);

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
      infeasible: false,
    });
  }



  /**
   * The regression-check entry point (scripts/recheckFindings.ts): re-runs today's accept/reject
   * decision on findings ALREADY stored, writing nothing. Delegates to RecheckRunner — see its doc
   * comment for exactly which part of the normal path is replayed.
   */
  recheckFindings(args: { page: Page; site: string; findings: StoredFinding[] }): Promise<{ finding: StoredFinding; kept: boolean; reason: string }[]> {
    return this.recheckRunner.recheckFindings(args);
  }
}



