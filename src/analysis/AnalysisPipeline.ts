import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { PreindexedValueStore } from '../db/PreindexedValueStore';
import type { ReactStateStore, RapidorGraph } from '../db/ReactStateStore';
import type { CrawlStateStore } from '../db/CrawlStateStore';
import type { VulnerabilityStore, StoredFinding } from '../db/VulnerabilityStore';
import type { AnalysisStatsStore } from '../db/AnalysisStatsStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { extractSegments, spliceSegment, type SegmentCandidate } from './segments';
import { findCandidates } from './matchFinder';
import { forgeRequestCached } from './requestForge';
import { runWithConcurrency, sleep, Semaphore, safePath, sameRoutePath, withParam } from '../utils/utils';
import { getServerResponseSimilarity, isIdenticalResponse, compareObj, describeDiffs, type PropDiff } from './responseEvaluate';
import { assessAuthZ, type AuthzClassifier, type AuthzAssessment } from './authzClassifier';
import { checkClientSideRouting, checkClientSideRoutingForPath, type ClientRoutingResult } from './clientRouting';
import { captureRouteByNavigation, captureDomSnapshot, diffDomSnapshots, domNoise, maskValue, makeGarbageValue, type DomSnapshot, type DomNoise } from './domSnapshot';
import { PagePool } from './PagePool';
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
  // per route template: the garbage-id render (the app's not-found page) and the garbage value itself,
  // so that value can be masked out of the baseline exactly as the candidate's own value is
  private notFoundBaselines = new Map<string, Promise<{ snapshot: DomSnapshot; value: string } | undefined>>();

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

  async runForSite({ page, site, explorationMs }: { page?: Page; site: string; explorationMs: number }): Promise<void> {
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

    // Client-routing candidates (seeded from the crawler's own page URLs) are probed live — a
    // pushState+popstate against the real app, plus a not-found screenshot. Neither is deterministically
    // replayable offline, so the offline demo skips this whole phase and stays HTTP-only (see
    // AnalysisPipelineOptions.offline and demo/README.md).
    for (const pageUrl of options.offline ? [] : pageUrls) {
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
      // App-shell / section prefixes ("app", "speak", ...) are route roots, not user-scoped ids:
      // mutating one only switches the app's section, which renders a different DOM and so masquerades
      // as a client-routing finding. Skip them wholesale (config.analysis.segmentBlacklist). Query
      // params carry no blacklisted value here (paramName is set only for them), so this only ever
      // gates path segments.
      if (!segment.paramName && this.deps.options.segmentBlacklist.includes(segment.value.toLowerCase())) continue;
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
          // Blacklist applies to the swap in BOTH directions: skip not only a blacklisted segment as
          // the value being mutated (above), but also any candidate whose REPLACEMENT value is
          // blacklisted — otherwise a non-shell segment gets mutated INTO an app-shell prefix
          // (ejoy's /website-directory -> /app), which is the same section-swap false positive seen
          // from the other side.
          if (this.deps.options.segmentBlacklist.includes(String(candidate.candidateValue).toLowerCase())) continue;
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
      const { clientRoutingProbe } = options;
      const clientRouting = await this.enqueueClientRoutingCheck({
        pageUrl: event.pageUrl,
        run: (p) => checkClientSideRouting({ page: p, paramName, paramValue: candidate.candidateValue, ...clientRoutingProbe }),
      });
      const clientCandidateUrl = withParam({ url: event.pageUrl, name: paramName, value: candidate.candidateValue });
      // highSuspicion: the authz gate at the top of this method already passed, so a full-navigation
      // escalation (clientSideConfirmed stage 3) is licensed if the cheap pushState stage is inconclusive.
      const reason = await this.clientSideConfirmed({ pageUrl: event.pageUrl, candidateUrl: clientCandidateUrl, candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), clientRouting, highSuspicion: true });
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

    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl,
      run: (p) => checkClientSideRouting({ page: p, paramName, paramValue: candidate.candidateValue, ...clientRoutingProbe }),
    });
    const reason = await this.clientSideConfirmed({ pageUrl, candidateUrl, candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), clientRouting, highSuspicion: true });
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
    const { clientRoutingProbe } = this.deps.options;
    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl,
      run: (p) => checkClientSideRoutingForPath({ page: p, targetUrl: candidateUrl, candidateValue: candidate.candidateValue, ...clientRoutingProbe }),
    });
    return this.clientSideConfirmed({ pageUrl, candidateUrl, candidateValue: candidate.candidateValue, referenceValue: String(candidate.referenceValue), clientRouting, highSuspicion });
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
    this.notFoundBaselines.clear();
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
      const clientRouting = await this.enqueueClientRoutingCheck({
        pageUrl: referenceUrl, run: (p) => checkClientSideRouting({ page: p, paramName, paramValue: candidateValue, ...probe }),
      });
      return this.clientSideConfirmed({ pageUrl: referenceUrl, candidateUrl, candidateValue, referenceValue: ref.searchParams.get(paramName) ?? referenceValue, clientRouting, highSuspicion: true });
    }
    // path segment: the stored reference value is not always the bare segment, so take the segment
    // that actually differs between the two paths (used only for masking the reference render)
    const refSegs = ref.pathname.split('/');
    const candSegs = cand.pathname.split('/');
    const i = candSegs.findIndex((seg, k) => seg !== refSegs[k]);
    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl: referenceUrl, run: (p) => checkClientSideRoutingForPath({ page: p, targetUrl: candidateUrl, candidateValue, ...probe }),
    });
    return this.clientSideConfirmed({ pageUrl: referenceUrl, candidateUrl, candidateValue, referenceValue: i >= 0 ? decodeURIComponent(refSegs[i] ?? '') : referenceValue, clientRouting, highSuspicion: true });
  }

  /** The http path's client-routing fallback, rebuilt from a stored finding: same param, swapped on the event's own page. */
  private async recheckQueryFallback({ pageUrl, referenceUrl, referenceValue, candidateValue, probe }: {
    pageUrl: string; referenceUrl: string; referenceValue: string; candidateValue: string;
    probe: { minWaitMs: number; idleMs: number; maxWaitMs: number };
  }): Promise<string | null> {
    const paramName = [...new URL(referenceUrl).searchParams.entries()].find(([, v]) => v === referenceValue)?.[0];
    // a path-segment candidate gets no client-routing fallback on the http path (see evaluateHttpCandidate)
    if (!paramName) return 'no client-routing fallback for a path-segment http candidate';
    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl, run: (p) => checkClientSideRouting({ page: p, paramName, paramValue: candidateValue, ...probe }),
    });
    const candidateUrl = withParam({ url: pageUrl, name: paramName, value: candidateValue });
    return this.clientSideConfirmed({ pageUrl, candidateUrl, candidateValue, referenceValue, clientRouting, highSuspicion: true });
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
    return this.pagePool.withPage({ pageUrl, run: async (page) => {
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
   * point for this fallback: confirm the app consumed the mutated value). A content guard then
   * compares normalized DOM snapshots (domSnapshot.ts: text nodes + <img> src + element count, keyed by
   * structural path, with the route's remount noise calibrated out, see renderGuardDecision) to decide
   * whether the swapped value actually changed what the page shows:
   *
   * - **Inert value** (always, even when corroborated): the candidate's render equals the reference's.
   *   The app read the value (or even sent it to a backend that answered 2xx) and ignored it. The
   *   lingualeo false positive that motivated this: `buy/...?refclmark=2 -> refclmark=1`, a tracking
   *   param Next.js re-fetches through `_next/data/...json?refclmark=1` (a 2xx carrying the value, so
   *   the network "confirmed" it) while the page renders exactly the same. A DOM mutation alone is not
   *   new content: a framework re-render or a re-mounted widget mutates the DOM without showing anything
   *   new, which is why the probe's `hasMutatedDom` is not enough on its own.
   * - **Not found** (only when nothing corroborates): the candidate's render matches the app's own
   *   not-found page, see looksLikeNotFound.
   *
   * The guard runs in two passes (see the body): pushState first (cheap, the mechanism for a genuinely
   * client-routed app), and a real navigation only as a fallback when pushState left the candidate
   * identical to the reference (the SSR case). Each side is masked with its own value first (maskValue),
   * so a page that only echoes the id it was given compares equal. A `4xx` on an incidental request does
   * not reject on its own. Returns a rejection reason (for the debug log) or null to accept.
   */
  private async clientSideConfirmed({ pageUrl, candidateUrl, candidateValue, referenceValue, clientRouting, highSuspicion }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string;
    clientRouting: ClientRoutingResult; highSuspicion: boolean;
  }): Promise<string | null> {
    // Use the probe's ceiling, not its floor: a snapshot wants the fully-settled render of the route,
    // so give it the most generous window (the floor only bounds how early the DOM probe may report a
    // reaction, which is not what a content comparison needs).
    const settleMs = this.deps.options.clientRoutingProbe.maxWaitMs;
    const corroborated = clientRouting.appReadParam || networkConfirmsCandidate(clientRouting.probeRequests);
    const common = { pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, settleMs };

    // The stages run CHEAPEST-FIRST; the first to reach a verdict wins, an inconclusive stage falls
    // through to the next, and the costliest (a real page load) is always last and runs only when every
    // cheaper stage could not decide.

    // STAGE 1 — pushState digestion (no reload, the cheapest mechanism and the one a genuinely
    // client-routed SPA honours). Meaningful only when the app rendered the candidate's OWN route and
    // stayed on it; busuu/pimsleur decide entirely here, paying for nothing below.
    if (clientRouting.hasMutatedDom && clientRouting.stayedOnRoute) {
      const viaPush = await this.renderGuardDecision({ ...common, navigate: false });
      if (viaPush !== INERT) return viaPush; // accept, or a concrete reject (not-found)

      // STAGE 2 — SSR navigation fallback (LENIENT). pushState rendered nothing new, but a server-rendered
      // route (lingualeo's /en/training/<type>) produces its content only on a real load (0 vs ~96
      // differing nodes). The app ALREADY proved it digests this route in stage 1, so a failed capture
      // KEEPS (the pre-guard policy — never lose a find on a flaky load).
      const viaNav = await this.renderGuardDecision({ ...common, navigate: true });
      return viaNav === INERT ? INERT_CONTENT_REASON : viaNav;
    }

    // The app did NOT digest the value under pushState (no DOM reaction, or it redirected away). The cheap
    // probe is inconclusive. STAGE 3 — STRICT full navigation — is the only way left to tell a real
    // client-trusting IDOR (ejoy: Next.js ignores a synthetic popstate for a sibling lesson, so stage 1
    // sees nothing, yet a real load renders the sibling) from noise. It runs ONLY for a HIGH-SUSPICION
    // candidate (its props diff already crossed an authorization boundary — the caller's authz gate),
    // since it has no prior client-routing signal to lean on, and it re-imposes the pushState gate's
    // safety on the real load (a redirect-away or a failed capture is a REJECT, unlike stage 2). Kill
    // switch: config.analysis.clientRoutingFullNavigationEscalation.
    if (!highSuspicion || !this.deps.options.clientRoutingFullNavigationEscalation) {
      return describeClientRoutingRejection(clientRouting);
    }
    return this.confirmByFullNavigation({ ...common });
  }

  /**
   * STAGE 3 of clientSideConfirmed: a real page load (page.goto), run only for a high-suspicion candidate
   * whose cheaper pushState stage was inconclusive (no reaction / redirect-away). STRICT, because there is
   * no prior client-routing signal to lean on — unlike the lenient SSR fallback in stage 2:
   *  - a failed capture is a REJECT (not a "keep");
   *  - a goto the app redirected AWAY from the candidate's own path is a REJECT (the pushState gate's
   *    `stayedOnRoute`, re-imposed on the real load — this is what keeps busuu's dashboard/review ->
   *    dashboard/timeline redirect from flagging here);
   *  - otherwise the SHARED content guard decides (inert -> reject; distinct and not the not-found page ->
   *    accept), identical to every other stage.
   */
  private async confirmByFullNavigation({ pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, settleMs }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string; corroborated: boolean; settleMs: number;
  }): Promise<string | null> {
    const renders = await this.pagePool.withPage({ pageUrl, run: (page) => this.captureAroundCandidate({ page, pageUrl, candidateUrl, navigate: true, settleMs }) });
    if (!renders) return 'full-navigation capture failed (strict escalation needs a decisive render)';
    if (renders.candidateFinalUrl && !sameRoutePath(renders.candidateFinalUrl, candidateUrl)) {
      return `full navigation redirected away from the candidate route (${safePath(renders.candidateFinalUrl)} != ${safePath(candidateUrl)})`;
    }
    const verdict = await this.judgeRenderedContent({ renders, pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate: true, settleMs });
    return verdict === INERT ? INERT_CONTENT_REASON : verdict;
  }

  /**
   * One pass of the content guard with a given capture mechanism (pushState when `navigate` is false,
   * a real navigation when true). Captures reference -> candidate -> reference on one held page,
   * calibrates the route's remount noise from the two reference renders, and returns:
   *  - `INERT` when the candidate's DOM equals the reference's (nothing to see) — the caller decides
   *    whether to stop (nav pass) or try the costlier mechanism (push pass);
   *  - a rejection string when it renders the app's not-found page;
   *  - `null` to ACCEPT (a real, distinct render), also when the capture failed and it cannot decide
   *    (keep — the pre-guard policy).
   */
  private async renderGuardDecision({ pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate, settleMs }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string;
    corroborated: boolean; navigate: boolean; settleMs: number;
  }): Promise<string | null | typeof INERT> {
    const renders = await this.pagePool.withPage({ pageUrl, run: (page) => this.captureAroundCandidate({ page, pageUrl, candidateUrl, navigate, settleMs }) });
    // No snapshot: cannot decide with this mechanism. On the push pass, fall through to the fallback
    // (INERT); on the nav pass the caller turns INERT into "keep", the pre-guard policy.
    if (!renders) return navigate ? null : INERT;
    return this.judgeRenderedContent({ renders, pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate, settleMs });
  }

  /**
   * The SHARED content guard, independent of HOW the three renders were captured: masks both the
   * reference and candidate value out of every side (so a page that only echoes the id it was given
   * compares equal), calibrates the route's remount noise from the two bracketing reference renders,
   * then classifies the candidate's render — INERT (equals the reference, the swap changed nothing), the
   * app's own not-found page (a rejection string), or a genuinely distinct render (null → accept). Every
   * stage runs this verbatim, so the accept bar is identical whether the capture was a pushState or a
   * real navigation.
   */
  private async judgeRenderedContent({ renders, pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate, settleMs }: {
    renders: { before: DomSnapshot; candidate: DomSnapshot; after: DomSnapshot };
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string;
    corroborated: boolean; navigate: boolean; settleMs: number;
  }): Promise<string | null | typeof INERT> {
    // Mask BOTH values out of every side. Masking each side with only its own value breaks on a stale
    // render: a pushState to an SSR route leaves the candidate showing the REFERENCE's value in its
    // content (it never re-rendered), and masking that candidate with only the candidate value leaves
    // the reference value in place, so it reads as "different" from the (masked) reference and even
    // matches the equally-stale not-found baseline — a route that is actually inert under pushState and
    // should fall through to the navigation fallback. Masking both values makes a stale render read
    // identical to the reference (-> INERT -> fallback), while a genuine leak still differs by its own
    // data (another user's name), which neither value masks.
    const mask = (snapshot: DomSnapshot): DomSnapshot =>
      maskValue({ snapshot: maskValue({ snapshot, value: referenceValue }), value: candidateValue });
    const candidateSnap = mask(renders.candidate);
    const before = mask(renders.before);
    const after = mask(renders.after);
    // Remount noise: what the reference route shows differently between its two renders with the value
    // unchanged (randomized quiz words, a carousel, a clock). Paths where the second reference render
    // shows the CANDIDATE's content are not noise but a stale render (the SPA did not re-render back):
    // counting them as noise could absorb exactly the leaking nodes.
    const noise = domNoise({ a: before, b: after, candidate: candidateSnap });

    const diff = diffDomSnapshots({ a: before, b: candidateSnap, noise });
    if (diff.changed.length === 0 && diff.nodeDelta === 0) return INERT;
    // what made it differ: the first thing to look at when a kept candidate looks wrong
    log.debug(`AnalysisPipeline: ${candidateUrl} differs from the reference (${navigate ? 'navigation' : 'pushState'}) by ${diff.changed.length} text node(s), ${diff.nodeDelta} element(s) (remount noise: ${noise.keys.size} path(s)): ${diff.changed.slice(0, 3).map((c) => `${c.key.split('/').slice(-3).join('/')} ${JSON.stringify(c.a)?.slice(0, 60)} -> ${JSON.stringify(c.b)?.slice(0, 60)}`).join(' | ')}`);

    if (!corroborated && await this.looksLikeNotFound({ pageUrl, candidateUrl, candidateValue, candidateSnap, referenceSnap: before, noise, navigate, settleMs })) {
      return "renders the app's not-found page";
    }
    return null;
  }

  /**
   * Reference -> candidate -> reference, on one exclusively-held page. `navigate` picks the mechanism:
   * a real page load (captureRouteByNavigation) or a pushState+popstate (captureDomSnapshot). Per
   * candidate, not cached per page: the two reference renders must bracket THIS candidate's render, so
   * whatever the route shows differently on every render is measured under the same conditions the
   * candidate was rendered in — lingualeo's training pages draw random quiz words every time, so
   * without the bracketing a genuinely different candidate route could not be told from that churn.
   * Undefined when any capture failed.
   */
  private async captureAroundCandidate({ page, pageUrl, candidateUrl, navigate, settleMs }: {
    page: Page; pageUrl: string; candidateUrl: string; navigate: boolean; settleMs: number;
  }): Promise<{ before: DomSnapshot; candidate: DomSnapshot; after: DomSnapshot; candidateFinalUrl?: string } | undefined> {
    const capture = navigate ? captureRouteByNavigation : captureDomSnapshot;
    const before = await capture({ page, testUrl: pageUrl, settleMs });
    const candidate = await capture({ page, testUrl: candidateUrl, settleMs });
    // The real load leaves the page on the candidate's FINAL url (after any app-side redirect); read it
    // now, before the `after` capture below navigates away. Only meaningful for the navigate mechanism
    // (pushState captures roll the url back) — the strict stage-3 redirect-away guard consumes it.
    const candidateFinalUrl = navigate ? page.url() : undefined;
    const after = await capture({ page, testUrl: pageUrl, settleMs });
    return before && candidate && after ? { before, candidate, after, candidateFinalUrl } : undefined;
  }

  /**
   * Not-found guard for a client-routing candidate that has no decisive network signal (no backend
   * response carried its value, or none was 2xx): compares the candidate's normalized DOM against the
   * app's own not-found page — calibrated once per route template by rendering a garbage id in the
   * same slot, with the SAME mechanism the candidate was captured with (pushState vs a real load give
   * different baselines, so they are cached separately). Unlike the inert guard this one is a
   * THRESHOLD, not equality: a not-found page often varies a little with the id beyond a plain echo (a
   * "did you mean" list, a tracking pixel). Both the text-node fraction and the element-count fraction
   * must be within `notFoundDomMaxDiff`.
   *
   * The baseline is used only when it is itself a USABLE not-found signal — meaningfully different from
   * the known-good reference page (`referenceSnap`). If rendering a garbage id looks like the real
   * reference, "looks like garbage" proves nothing: that happens for a soft-404 app (every id renders
   * the same shell) and, critically, when a capture failed to render the route at all (pimsleur behind
   * a cookie wall rendered the same consent shell for the reference AND the garbage id). Rejecting a
   * candidate for matching such a baseline would drop real findings on a flaky load, so the guard backs
   * off (returns false) instead. Returns false (keep the candidate) whenever it cannot decide.
   */
  private async looksLikeNotFound({ pageUrl, candidateUrl, candidateValue, candidateSnap, referenceSnap, noise, navigate, settleMs }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; candidateSnap: DomSnapshot; referenceSnap: DomSnapshot; noise?: DomNoise; navigate: boolean; settleMs: number;
  }): Promise<boolean> {
    const template = `${navigate ? 'nav' : 'push'}\u0000${candidateUrl.split(candidateValue).join('\u0000')}`;   // id slot blanked out, keyed by mechanism
    // Calibrate once per template, deduping concurrent probes: store the in-flight promise so parallel
    // candidates on the same template await the same garbage-value render instead of each doing one.
    let calibration = this.notFoundBaselines.get(template);
    if (!calibration) {
      const garbageValue = makeGarbageValue(candidateValue);
      const garbageUrl = candidateUrl.split(candidateValue).join(garbageValue);
      const capture = navigate ? captureRouteByNavigation : captureDomSnapshot;
      calibration = this.pagePool.withPage({ pageUrl, run: async (page) => {
        const snapshot = await capture({ page, testUrl: garbageUrl, settleMs });
        return snapshot ? { snapshot, value: garbageValue } : undefined;
      } });
      this.notFoundBaselines.set(template, calibration);
    }
    const baseline = await calibration;
    if (!baseline) return false;
    const maxDiff = this.deps.options.notFoundDomMaxDiff;

    // Is the garbage render actually a distinct "not found" page, or does it look like the real
    // reference (soft-404 / a failed render)? If the latter, it cannot tell a leak from a miss — back off.
    const vsReference = diffDomSnapshots({ a: maskValue({ snapshot: baseline.snapshot, value: baseline.value }), b: referenceSnap, noise });
    if (vsReference.textFraction <= maxDiff && vsReference.nodeFraction <= maxDiff) return false;

    const diff = diffDomSnapshots({ a: maskValue({ snapshot: baseline.snapshot, value: baseline.value }), b: candidateSnap, noise });
    return diff.textFraction <= maxDiff && diff.nodeFraction <= maxDiff;
  }
}

/** Sentinel: the content guard found the candidate's render identical to the reference's. */
const INERT = Symbol('inert');

/** The rejection reason a content guard returns for an inert render (the swapped value changed nothing). */
const INERT_CONTENT_REASON = 'renders the same page as the reference (the swapped value has no effect on the DOM content)';

/** True if the app answered the candidate's own fetch with a success status: trust it, skip the visual guard. */
function networkConfirmsCandidate(probeRequests: { status: number }[]): boolean {
  return probeRequests.some((r) => r.status >= 200 && r.status < 300);
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
