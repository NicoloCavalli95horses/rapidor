import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { PreindexedValueStore } from '../db/PreindexedValueStore';
import type { ReactStateStore, RapidorGraph } from '../db/ReactStateStore';
import type { CrawlStateStore } from '../db/CrawlStateStore';
import type { VulnerabilityStore } from '../db/VulnerabilityStore';
import type { AnalysisStatsStore } from '../db/AnalysisStatsStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { extractSegments, spliceSegment, type SegmentCandidate } from './segments';
import { findCandidates } from './matchFinder';
import { forgeRequestCached, runWithConcurrency, sleep } from './requestForge';
import { getServerResponseSimilarity, compareObj, describeDiffs, type PropDiff } from './responseEvaluate';
import { assessAuthZ, type AuthzClassifier } from './authzClassifier';
import { checkClientSideRouting, checkClientSideRoutingForPath, type ClientRoutingResult } from './clientRouting';
import { captureRouteScreenshot, screenshotDiffFraction, makeGarbageValue } from './routeScreenshot';
import { installParamUsageTracking } from '../browser/paramUsageTracker';
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
  notFoundScreenshotMaxDiff: number; // a client-routing candidate whose rendered screenshot differs from the calibrated not-found page by no more than this fraction of pixels is the app's own not-found page, not a real resource — rejected (see config.analysis.notFoundScreenshotMaxDiff)
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

/** Marks a vulnerability/finding as tested purely client-side: no HTTP verb ever applied. */
const CLIENT_ROUTING_METHOD = 'CLIENT';

// enqueueClientRoutingCheck: a negative client-routing probe is retried this many times in total
// (1 + this many extra attempts) before being trusted as a genuine "no" — see that method's own
// comment for why a single attempt is unreliable. CLIENT_ROUTING_RETRY_DELAY_MS gives the previous
// probe's un-awaited rollback render a moment to actually finish before the retry starts its own.
const MAX_CLIENT_ROUTING_ATTEMPTS = 3;
const CLIENT_ROUTING_RETRY_DELAY_MS = 250;

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

/** Minimal counting semaphore: bounds how many `run`s are in flight at once (used for forged HTTP). */
class Semaphore {
  private permits: number;
  private waiters: (() => void)[] = [];
  constructor(permits: number) { this.permits = Math.max(1, permits); }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.permits > 0) this.permits--;
    else await new Promise<void>((resolve) => this.waiters.push(resolve));
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.permits++;
    }
  }
}

export class AnalysisPipeline {
  // checkClientSideRouting mutates the shared page's live location/DOM; serialized so concurrent
  // candidate evaluations (bounded by maxConcurrentRequests) never race on it, mirroring RAPIDOR's
  // own enqueueNavigation() around the same operation.
  // Pool of pages the client-routing phase runs its probes/screenshots on, in parallel. Each probe
  // mutates a page's live DOM (pushState) and screenshots it, so a probe owns a page exclusively while
  // it runs; `freePages` are the idle ones and `pageWaiters` are tasks blocked waiting for one.
  // `extraPages` are the pages this pipeline created from the caller's context (to close at the end);
  // the caller's own page stays in the pool but is never closed here. Sized by clientRoutingConcurrency.
  private freePages: Page[] = [];
  private pageWaiters: ((page: Page) => void)[] = [];
  private extraPages: Page[] = [];
  // Bounds concurrent forged HTTP requests independently of the page pool (the forge uses
  // page.request.fetch, which needs no page DOM, so it is not gated by the pool). Mirrors
  // maxConcurrentRequests. Re-created per run.
  private forgeSemaphore: Semaphore = new Semaphore(1);

  // Per-run cache of React graphs parsed from the DB. findUrlCandidates looks a state's graph up
  // once per preindex match (tens of thousands of times for a rich site), but there are only as
  // many DISTINCT graphs as captured react_states (a couple hundred at most): without this, the
  // candidate-generation phase spent most of its time re-running JSON.parse on the SAME ~150KB graph
  // strings over and over. Cleared at the start of each runForSite so it never grows across sites or
  // goes stale against a later re-run.
  private graphCache = new Map<number, RapidorGraph | undefined>();

  // Per-run cache of the app's "not found" screenshot for each route template (the candidate URL with
  // its id slot blanked out): calibrated once per template by rendering a garbage value, then reused
  // to recognize any candidate on that template whose render is just the not-found page. `undefined`
  // means calibration was attempted but produced no usable shot, so don't keep retrying it. Holds the
  // in-flight PROMISE, not the resolved buffer, so concurrent probes on the same template (now that
  // the pool runs them in parallel) share one calibration instead of each rendering the garbage value.
  private notFoundBaselines = new Map<string, Promise<Buffer | undefined>>();

  // Finding ids this analysis run has already logged. The WARN for a confirmed finding must reflect
  // what THIS run determined, not whether the row happens to be new to the DB: vulnerabilityStore
  // dedups with INSERT OR IGNORE, so a re-run on a DB that already holds the finding (runAnalysisFromDb
  // never clears) would otherwise log nothing while `vulnerabilitiesFlagged` still reports it. We log
  // on confirmation regardless of DB novelty, deduped per run by this set so the same finding reached
  // from two reference events is not logged twice. Cleared at the start of each runForSite.
  private loggedFindingIds = new Set<string>();

  constructor(private deps: AnalysisPipelineDeps) {}

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

  async runForSite({ page, site, explorationMs }: { page: Page; site: string; explorationMs: number }): Promise<void> {
    const analysisStartedAt = Date.now();
    this.graphCache.clear();
    this.notFoundBaselines.clear();
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
    this.warnOnMissingReactStateCoverage({ site, crawledStates, pageUrls });
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
      const found = this.findUrlCandidates({ url: event.url });
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

    for (const pageUrl of pageUrls) {
      const found = this.findUrlCandidates({ url: pageUrl });
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
      log.info(`AnalysisPipeline: dispatching ${tasks.length} candidate request(s) for ${site} (${poolSize} client-routing page(s), ${options.maxConcurrentRequests} forge slot(s))`);
      this.forgeSemaphore = new Semaphore(options.maxConcurrentRequests);
      await this.setupPagePool({ page, size: poolSize });
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
        await this.teardownPagePool();
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

  /** Runs the preindex -> matchFinder steps for one URL (an http_event's or a crawled page's). */
  private findUrlCandidates({ url }: { url: string }): {
    segments: number;
    matches: number;
    items: { segment: SegmentCandidate; candidate: ReturnType<typeof findCandidates>[number] }[];
  } {
    const { preindexStore } = this.deps;
    let segments = 0;
    let matches = 0;
    const items: { segment: SegmentCandidate; candidate: ReturnType<typeof findCandidates>[number] }[] = [];

    for (const segment of extractSegments({ url })) {
      segments++;
      // A value carried by thousands of React nodes is a generic keyword (a DOM tag/role/category
      // word that also happens to be a URL segment), not a user-scoped identifier: swapping it is
      // pure noise, and the fan-out (every match x its component siblings, across every URL that
      // shares the word) is what made candidate generation explode. Identifiers appear a bounded
      // handful of times, well under this cap, so this skips only the noise. countByValue never
      // materializes the rows, so an over-cap segment costs a single COUNT, not a huge fetch.
      if (preindexStore.countByValue(segment.value) > this.deps.options.maxSegmentMatches) continue;
      for (const match of preindexStore.findByValue(segment.value)) {
        matches++;
        const graph = this.getGraph(match.stateId);
        if (!graph) continue;
        for (const candidate of findCandidates({ stateId: match.stateId, graph, nodeId: match.nodeId, path: match.path })) {
          items.push({ segment, candidate });
        }
      }
    }
    return { segments, matches, items };
  }

  /** reactStateStore.getById, memoized for this run: each distinct graph is read + JSON.parsed once. */
  private getGraph(stateId: number): RapidorGraph | undefined {
    let graph = this.graphCache.get(stateId);
    if (graph === undefined && !this.graphCache.has(stateId)) {
      graph = this.deps.reactStateStore.getById(stateId);
      this.graphCache.set(stateId, graph);
    }
    return graph;
  }

  /**
   * Minimum coverage requirement: every URL the DFS actually visited (crawl_states — the ground
   * truth of "the crawler was on this page") should have at least one captured React state
   * (react_states) at that exact URL — query params included, since a different query string is
   * legitimately a different state (and may well add more than one). A URL with none went through
   * beforeAction/afterAction without ReactStateHooks ever getting usable data back (not settled in
   * time, extension not injected on that tab, or an exception — see its own onEnd stats log for
   * which), which means every candidate hiding on that page's own state was silently never indexed,
   * so this pipeline run had no chance of ever proposing it. Logged as a warning, never thrown: this
   * is a coverage gap to go investigate (start from ReactStateHooks' onEnd log for this run), not a
   * reason to abort an otherwise-successful analysis pass.
   */
  private warnOnMissingReactStateCoverage({ site, crawledStates, pageUrls }: {
    site: string;
    crawledStates: { url: string }[];
    pageUrls: string[];
  }): void {
    const covered = new Set(pageUrls);
    const missing = new Set(crawledStates.map((s) => s.url).filter((url) => !covered.has(url)));
    if (missing.size === 0) return;
    log.warning(
      `AnalysisPipeline: ${missing.size}/${new Set(crawledStates.map((s) => s.url)).size} crawled URL(s) for ${site} have ` +
      `NO captured React state (coverage gap — these pages' own candidates were never indexed): ${[...missing].join(', ')}`,
    );
  }

  private async evaluateHttpCandidate({ page, site, event, url, candidate, segment }: {
    page: Page; site: string;
    event: ReturnType<HttpEventStore['listBySite']>[number];
    url: string;
    candidate: ReturnType<typeof findCandidates>[number];
    segment: SegmentCandidate;
  }): Promise<void> {
    const { vulnerabilityStore, classifier, forgedRequestStore, options } = this.deps;

    const forged = await this.forgeSemaphore.run(async () => {
      const res = await forgeRequestCached({
        cache: forgedRequestStore, site, page, url, method: event.method, headers: event.requestHeaders, postData: event.postData,
      });
      await sleep(options.timeBetweenRequestsMs);
      return res;
    });

    const similarity = getServerResponseSimilarity(
      { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: event.responseBody ?? '', contentType: event.contentType },
      forged,
    );

    let detectionMethod: 'http' | 'client-routing' = 'http';
    if (!similarity.areSimilar) {
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
      const { clientRoutingProbe } = options;
      const clientRouting = await this.enqueueClientRoutingCheck({
        pageUrl: event.pageUrl,
        run: (p) => checkClientSideRouting({ page: p, paramName, paramValue: candidate.candidateValue, ...clientRoutingProbe }),
      });
      const clientCandidateUrl = withParam({ url: event.pageUrl, name: paramName, value: candidate.candidateValue });
      const reason = await this.clientSideConfirmed({ pageUrl: event.pageUrl, candidateUrl: clientCandidateUrl, candidateValue: candidate.candidateValue, clientRouting });
      if (reason) {
        log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${event.pageUrl} ?${paramName}=${candidate.candidateValue}`);
        return;
      }
      detectionMethod = 'client-routing';
    }

    const differences = compareObj(candidate.referenceProps, candidate.candidateProps);
    const authz = await assessAuthZ({ differences, classifier });
    if (!authz.isAuthzRelevant) {
      log.debug(`AnalysisPipeline: candidate rejected (no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}) — ${event.method} ${event.url} -> ${url} | ${describeDiffs(differences)}`);
      return;
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
    const { vulnerabilityStore, classifier, options } = this.deps;
    const { clientRoutingProbe } = options;

    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl,
      run: (p) => checkClientSideRouting({ page: p, paramName, paramValue: candidate.candidateValue, ...clientRoutingProbe }),
    });
    const reason = await this.clientSideConfirmed({ pageUrl, candidateUrl, candidateValue: candidate.candidateValue, clientRouting });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${pageUrl} ?${paramName}=${candidate.candidateValue}`);
      return;
    }

    const differences = compareObj(candidate.referenceProps, candidate.candidateProps);
    const authz = await assessAuthZ({ differences, classifier });
    if (!authz.isAuthzRelevant) {
      log.debug(`AnalysisPipeline: candidate rejected (no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}) — ${pageUrl} -> ${candidateUrl} | ${describeDiffs(differences)}`);
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
    const { vulnerabilityStore, classifier, options } = this.deps;
    const { clientRoutingProbe } = options;

    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl,
      run: (p) => checkClientSideRoutingForPath({ page: p, targetUrl: candidateUrl, candidateValue: candidate.candidateValue, ...clientRoutingProbe }),
    });
    const reason = await this.clientSideConfirmed({ pageUrl, candidateUrl, candidateValue: candidate.candidateValue, clientRouting });
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${pageUrl} -> ${candidateUrl}`);
      return;
    }

    const differences = compareObj(candidate.referenceProps, candidate.candidateProps);
    const authz = await assessAuthZ({ differences, classifier });
    if (!authz.isAuthzRelevant) {
      log.debug(`AnalysisPipeline: candidate rejected (no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}) — ${pageUrl} -> ${candidateUrl} | ${describeDiffs(differences)}`);
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
   * Builds the page pool for one analysis run: the caller's own page plus `size - 1` fresh pages from
   * the SAME browser context (so they share the authenticated cookies), each with the param-usage init
   * script installed (the query probe reads window.__accessedParams). All start free.
   */
  private async setupPagePool({ page, size }: { page: Page; size: number }): Promise<void> {
    this.extraPages = [];
    const pages: Page[] = [page];
    for (let i = 1; i < size; i++) {
      const extra = await page.context().newPage();
      await installParamUsageTracking(extra);
      this.extraPages.push(extra);
      pages.push(extra);
    }
    this.freePages = pages;
    this.pageWaiters = [];
  }

  /** Closes the pages this run created (never the caller's own page) and resets the pool. */
  private async teardownPagePool(): Promise<void> {
    const toClose = this.extraPages;
    this.extraPages = [];
    this.freePages = [];
    this.pageWaiters = [];
    for (const extra of toClose) await extra.close().catch(() => undefined);
  }

  /** Takes a free page, or waits until one is released. */
  private acquirePage(): Promise<Page> {
    const free = this.freePages.pop();
    if (free) return Promise.resolve(free);
    return new Promise<Page>((resolve) => this.pageWaiters.push(resolve));
  }

  /** Returns a page to the pool, handing it straight to the next waiter if there is one. */
  private releasePage(page: Page): void {
    const waiter = this.pageWaiters.shift();
    if (waiter) waiter(page);
    else this.freePages.push(page);
  }

  /** Runs `run` on an exclusively-held pool page, navigated to `pageUrl` first; always releases it. */
  private async withPooledPage<T>({ pageUrl, run }: { pageUrl: string; run: (page: Page) => Promise<T> }): Promise<T> {
    const page = await this.acquirePage();
    try {
      if (page.url() !== pageUrl) {
        await page.goto(pageUrl, { waitUntil: 'load', timeout: 10_000 }).catch(() => undefined);
      }
      return await run(page);
    } finally {
      this.releasePage(page);
    }
  }

  /**
   * Runs checkClientSideRouting* on a pool page (parallel across candidates, exclusive per page), and
   * retries a negative result up to MAX_CLIENT_ROUTING_ATTEMPTS times.
   *
   * The probe itself (clientRouting.ts) now AWAITS its own rollback re-render to settle before
   * resolving, so it leaves the shared pool page quiet for the next candidate — this is what removed
   * the order-dependent cross-candidate pollution that used to make *some* probe miss in the first
   * round or two (confirmed empirically via scripts/debugClientRoutingFlakiness.ts). This retry is
   * now only a secondary backstop for a genuinely slow FIRST render (a route whose render is gated on
   * a network fetch slower than the probe's own ceiling): it costs nothing when the first attempt
   * already succeeds, and a bounded re-run recovers that rare case — the same "redundant capture beats
   * a silent loss" tradeoff already made for react-state capture (see ReactStateStore.record()). The
   * retry loop stays on one page, and each attempt is itself self-cleaning.
   */
  private enqueueClientRoutingCheck({ pageUrl, run }: {
    pageUrl: string; run: (page: Page) => Promise<ClientRoutingResult>;
  }): Promise<ClientRoutingResult> {
    return this.withPooledPage({ pageUrl, run: async (page) => {
      let attempt: ClientRoutingResult = { hasMutatedDom: false, isUsingNewParams: false, appReadParam: false, stayedOnRoute: false, finalUrl: pageUrl, probeRequests: [] };
      for (let i = 0; i < MAX_CLIENT_ROUTING_ATTEMPTS; i++) {
        attempt = await run(page);
        // A decisive positive ends the retries: the app rendered the candidate's OWN route (client
        // digestion), or the backend answered its fetch with a 2xx. The final accept/reject (incl. the
        // not-found guard) is decided later in clientSideConfirmed.
        if ((attempt.hasMutatedDom && attempt.stayedOnRoute) || networkConfirmsCandidate(attempt.probeRequests)) return attempt;
        if (i < MAX_CLIENT_ROUTING_ATTEMPTS - 1) await sleep(CLIENT_ROUTING_RETRY_DELAY_MS);
      }
      return attempt; // every attempt came back negative: a genuine "no", not a retry left on the table
    } });
  }

  /**
   * Decides whether a client-routing probe is evidence of an access-control issue. The primary signal
   * is CLIENT DIGESTION — the SPA rendered the candidate's own route and stayed on it (`hasMutatedDom
   * && stayedOnRoute`); a query param (or path segment) honoured entirely client-side, with no network
   * traffic at all, is a real finding, so the network is a filter here, never a veto (RAPIDOR's whole
   * point for this fallback: confirm the app consumed the mutated value). When the app provably read
   * the param (`appReadParam`) or the backend answered the candidate's own fetch with a `2xx`, that is
   * corroboration strong enough to accept directly. Otherwise the only thing that can still reject it
   * is the visual not-found baseline — the app rendering its generic not-found page for every id. A
   * `4xx` on an incidental request no longer rejects on its own: a route that renders a real, distinct
   * page (not the not-found one) is a client-side finding regardless of what some request returned.
   * Returns a rejection reason (for the debug log) or null to accept.
   */
  private async clientSideConfirmed({ pageUrl, candidateUrl, candidateValue, clientRouting }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; clientRouting: ClientRoutingResult;
  }): Promise<string | null> {
    if (!(clientRouting.hasMutatedDom && clientRouting.stayedOnRoute)) {
      return describeClientRoutingRejection(clientRouting);
    }
    const corroborated = clientRouting.appReadParam || networkConfirmsCandidate(clientRouting.probeRequests);
    if (!corroborated && await this.looksLikeNotFound({ pageUrl, candidateUrl, candidateValue })) {
      return "renders the app's not-found page";
    }
    return null;
  }

  /**
   * Visual not-found guard for a client-routing candidate that has no decisive network signal (no
   * backend response carried its value, or none was 2xx): screenshots the candidate's rendered route
   * and compares it against the app's own not-found page — calibrated once per route template by
   * rendering a garbage id in the same slot. A near-identical render (within
   * `notFoundScreenshotMaxDiff`) means the route only produced the not-found page, a false positive,
   * so it is rejected. Returns false (keep the candidate) whenever it cannot decide: calibration or
   * capture produced no shot, or the two could not be diffed.
   */
  private async looksLikeNotFound({ pageUrl, candidateUrl, candidateValue }: {
    pageUrl: string; candidateUrl: string; candidateValue: string;
  }): Promise<boolean> {
    // Use the probe's ceiling, not its floor: a screenshot wants the fully-settled render of the
    // route, so give it the most generous window (the floor only bounds how early the DOM probe may
    // report a reaction, which is not what a visual baseline needs).
    const settleMs = this.deps.options.clientRoutingProbe.maxWaitMs;
    const template = candidateUrl.split(candidateValue).join('\u0000');   // id slot blanked out
    // Calibrate once per template, deduping concurrent probes: store the in-flight promise so parallel
    // candidates on the same template await the same garbage-value render instead of each doing one.
    let calibration = this.notFoundBaselines.get(template);
    if (!calibration) {
      const garbageUrl = candidateUrl.split(candidateValue).join(makeGarbageValue(candidateValue));
      calibration = this.withPooledPage({ pageUrl, run: (page) => captureRouteScreenshot({ page, testUrl: garbageUrl, settleMs }) });
      this.notFoundBaselines.set(template, calibration);
    }
    const baseline = await calibration;
    if (!baseline) return false;

    const candidateShot = await this.withPooledPage({ pageUrl, run: (page) => captureRouteScreenshot({ page, testUrl: candidateUrl, settleMs }) });
    if (!candidateShot) return false;

    const frac = await screenshotDiffFraction({ a: candidateShot, b: baseline });
    return frac !== undefined && frac <= this.deps.options.notFoundScreenshotMaxDiff;
  }
}

/** True if the app answered the candidate's own fetch with a success status: trust it, skip the visual guard. */
function networkConfirmsCandidate(probeRequests: { status: number }[]): boolean {
  return probeRequests.some((r) => r.status >= 200 && r.status < 300);
}

/** The URL with one query param set to `value` (used to build a query candidate's own route for the visual guard). */
function withParam({ url, name, value }: { url: string; name: string; value: string }): string {
  try {
    const u = new URL(url);
    u.searchParams.set(name, value);
    return u.href;
  } catch {
    return url;
  }
}

/** Same dedup id RAPIDOR's responseEvaluator.js computes (sha256 of candidate value + node id + method + url). */
function vulnerabilityId({ candidateValue, nodeId, method, url }: {
  candidateValue: string; nodeId: string; method: string; url: string;
}): string {
  return createHash('sha256').update(`current::${candidateValue}:nodeId:${nodeId}http::${method}:${url}`).digest('hex');
}

/**
 * Canonical form of a URL for the "is this already in the crawler's own history" check: origin +
 * decoded path (no trailing slash) + query params sorted by key (also decoded, so %20 and a literal
 * space compare equal). Query values are NOT sorted among themselves — a candidate differs from
 * history by its path or by one param's value, never by param order, so comparing by sorted keys
 * only would risk conflating two genuinely different URLs that happen to share key names.
 * Malformed input (never expected, since every caller already round-tripped it through `new URL`)
 * falls back to the raw string rather than throwing: a failed normalization should just miss this
 * optimization, not break the pipeline.
 */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    const search = params.map(([key, value]) => `${key}=${decodeURIComponent(value)}`).join('&');
    return `${url.origin}${path}${search ? `?${search}` : ''}`;
  } catch {
    return raw;
  }
}

/**
 * Explains a negative client-routing probe for the debug log: distinguishes "the app never reacted
 * at all" from "the app DID mutate the DOM, but it redirected away from the candidate's own path" —
 * the busuu false positive (dashboard/review -> dashboard/dashboard, silently redirected by the
 * app's own router to dashboard/timeline) that motivated checkClientSideRouting*'s own redirect
 * guard. Without this distinction a rejected-by-redirect candidate logs identically to one the app
 * genuinely ignored, hiding exactly the case worth double-checking by hand.
 */
/**
 * Human-readable description of which extracted segment produced a finding and how it was mutated:
 * the segment's location (a named query param, or a path segment) plus the original value swapped
 * for the sibling candidate value. Makes the warning say *why* two URLs are being compared, instead
 * of leaving the reader to diff the two URLs by eye to spot the one part that changed.
 */
function describeExtractedSegment({ segment, candidate }: {
  segment: SegmentCandidate;
  candidate: ReturnType<typeof findCandidates>[number];
}): string {
  const location = segment.paramName ? `query param "${segment.paramName}"` : 'path segment';
  return `${location}: ${String(candidate.referenceValue)} -> ${candidate.candidateValue}`;
}

function describeClientRoutingRejection(result: ClientRoutingResult): string {
  return result.hasMutatedDom
    ? `DOM mutated but the app redirected away to ${result.finalUrl}`
    : 'no client-side DOM reaction';
}
