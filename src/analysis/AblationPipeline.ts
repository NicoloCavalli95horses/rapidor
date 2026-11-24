import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { HttpEventStore, HttpEventRow } from '../db/HttpEventStore';
import type { CrawlStateStore } from '../db/CrawlStateStore';
import type { AblationVulnerabilityStore } from '../db/AblationVulnerabilityStore';
import type { AblationStatsStore } from '../db/AblationStatsStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { extractSegments, candidateUrlFor } from './segments';
import { buildJsonPreindex, findJsonCandidates, type JsonCandidate } from './jsonMatchFinder';
import { paramNameBlacklisted, isLocaleParam, isTrackingParam, sameIdShape } from './candidateGenerator';
import { forgeRequestCached } from './requestForge';
import { runWithConcurrency, sleep } from '../utils/utils';
import { getServerResponseSimilarity, canonicalResponseKey, compareObj, describeDiffs, isEmptyJsonResponse, isErrorEnvelopeResponse } from './responseEvaluate';
import { assessAuthZ, assessDirection, type AuthzClassifier } from './authzClassifier';
import { formatDuration } from '../core/duration';
import { normalizeUrl } from './findings';

export interface AblationPipelineOptions {
  maxConcurrentRequests: number;
  timeBetweenRequestsMs: number;
  // JSON analogs of the main pipeline's guards (same config values): a value matching more than this
  // many bodies (hit-cap) OR carried by more than this many distinct URLs (carrier-cap) is a generic
  // keyword, not an identifier, and is skipped (see config.analysis.maxSegmentMatches / runForSite).
  maxSegmentMatches: number;
  // per-site forge budget: above this many distinct candidates, generation early-aborts and the site is
  // flagged infeasible instead of dispatched (see config.analysis.maxGeneratedRequests).
  maxGeneratedRequests: number;
  // Same candidate-generation blacklists as the main pipeline (the ablation differs only in using JSON
  // siblings instead of React ones — every other analysis rule applies). A query param whose NAME (or a
  // token of it, via paramNameBlacklisted) is listed is never mutated (pagination/sorting controls like
  // `curPage`/`limit` are not object references); a path segment whose VALUE is blacklisted is never
  // mutated nor used as a replacement (app-shell/section roots). See config.analysis.paramBlacklist /
  // segmentBlacklist.
  paramBlacklist: string[];
  segmentBlacklist: string[];
  // Same direction gate as the main pipeline (assessDirection; off when undefined, see config.analysis.authzDirectionGate).
  authzDirectionGate?: boolean;
  // Mirrors config.analysis.overwriteFindingsPerSite for the ablation's own table: when not explicitly
  // false, a re-run clears this site's previous ablation_vulnerabilities before recording.
  overwriteFindingsPerSite?: boolean;
}

export interface AblationPipelineDeps {
  httpEventStore: HttpEventStore;
  crawlStateStore: CrawlStateStore;
  vulnerabilityStore: AblationVulnerabilityStore;
  statsStore: AblationStatsStore;
  // shared with AnalysisPipeline — see ForgedRequestStore's own doc comment
  forgedRequestStore: ForgedRequestStore;
  classifier: AuthzClassifier;
  options: AblationPipelineOptions;
}

/**
 * Ablation study: the same IDOR-detection oracle as AnalysisPipeline (forge the candidate request,
 * compare the real response, diff the two objects' properties, classify the diff for authz
 * relevance), but candidate generation NEVER touches React state at all — only the JSON bodies of
 * already-captured HTTP responses. The question this answers: how much of what AnalysisPipeline
 * finds actually required the React-state-derived signal (component siblings, client-side-only
 * query params, client-routed path segments — none of which exist here), versus how much was
 * sitting in plain sight in the JSON the site's own API already returned?
 *
 * Candidate generation, replacing matchFinder's componentIndex walk: for a URL segment that matches
 * a value inside that SAME request's own JSON response body (findJsonMatches, the JSON analog of
 * PreindexedValueStore.findByValue), the "siblings" are other elements of the nearest enclosing
 * array in that body (findJsonCandidates) — the JSON idiom for "multiple instances of the same kind
 * of entity", playing the role RAPIDOR's componentIndex plays for React nodes.
 *
 * Deliberately narrower than AnalysisPipeline by construction, not by omission: there is no
 * equivalent of the client-routing probes (checkClientSideRouting/checkClientSideRoutingForPath).
 * Those resolve their oracle from a DOM-mutation signal (did the app's own rendering react?), which
 * is inherently a browser-level observation with no network counterpart at all — feeding this
 * pipeline the URLs reached only via client-side routing would not help, since there would still be
 * no way to tell whether the app actually uses such a value without watching the DOM react to it.
 * Expect this pipeline to flag strictly fewer candidates than AnalysisPipeline on the same site; a
 * comparison script (see scripts/compareAblation.ts) reports by how much, over analysis_stats vs
 * ablation_stats, bucketed by the main pipeline's own detectionMethod so this exact gap is visible.
 *
 * Matching searches the WHOLE site's own corpus, not just "this URL's own response": the id a
 * request's own URL carries is often only ever RETURNED, alongside its siblings, by a completely
 * different endpoint (a list/listing call), not by the per-item endpoint whose own URL happens to
 * contain it (see buildJsonPreindex's own doc comment). Sibling-finding itself still never crosses
 * bodies — only the lookup does — since two different HTTP responses cannot be assumed to describe
 * related data just because a value happens to appear in both.
 */
export class AblationPipeline {
  // HTTP content guards, identical to AnalysisPipeline's (always on): the forged-response content keys
  // already recorded this run (dedup), and the content keys the crawler already collected legitimately
  // (history). Both reset at the start of runForSite so a per-site run never leaks state across sites.
  private recordedForgedBodyKeys = new Set<string>();
  private responseHistoryKeys = new Set<string>();

  constructor(private deps: AblationPipelineDeps) {}

  async runForSite({ page, site }: { page: Page; site: string }): Promise<void> {
    const analysisStartedAt = Date.now();
    const { httpEventStore, crawlStateStore, vulnerabilityStore, statsStore, options } = this.deps;
    // Re-analysis hygiene, mirroring AnalysisPipeline (see config.analysis.overwriteFindingsPerSite):
    // a re-run's ablation findings REPLACE this site's previous ablation_vulnerabilities instead of
    // accumulating (record is INSERT OR IGNORE on a deterministic id). Reset the per-run guard sets too.
    if (options.overwriteFindingsPerSite !== false) vulnerabilityStore.clearSite({ site });
    this.recordedForgedBodyKeys = new Set<string>();
    // Scoped to THIS site only: listMetaBySite/forEachResponse already filter by site, and both
    // `bodies`/`preindex` below are built fresh from exactly this stream on every call — never cached
    // across sites, so a JSON body captured for a different site can never leak into this one's index.
    // Metadata only (no response_body): the generation loop needs each event's URL/method and the
    // parsed JSON bodies, never the raw body strings all at once. On a body-rich site those are ~0.6 GB
    // (promova: 595 MB over 17k events) — materialising them in one array is what OOM'd here.
    const events = httpEventStore.listMetaBySite(site);
    // One streaming pass over the bodies (same id ASC order as events, so the Nth body aligns with
    // events[N]): fold the response-history guard key set (same as AnalysisPipeline — a forge that
    // returns data the crawler already collected legitimately is not flagged) AND keep only the parsed
    // JSON objects for the preindex/sibling walk. Non-JSON bodies (images/JS/CSS — the bulk of the
    // bytes) parse to undefined and cost nothing to retain, so what stays in memory is just the JSON
    // subset (promova: 2981 of 17k, ~106 MB), never the raw 0.6 GB.
    this.responseHistoryKeys = new Set<string>();
    const bodies = new Array<unknown>(events.length);
    let bodyIndex = 0;
    httpEventStore.forEachResponse({
      site,
      onRow: ({ status, body }) => {
        const k = canonicalResponseKey({ status: status ?? 0, body: body ?? '' });
        if (k) this.responseHistoryKeys.add(k);
        bodies[bodyIndex++] = parseJsonBody(body);
      },
    });
    // Every body walked exactly once; a segment is then looked up against the WHOLE corpus in O(1)
    // instead of being re-walked body-by-body — see buildJsonPreindex's own doc comment.
    const preindex = buildJsonPreindex({ bodies });

    // Same false-positive guard as AnalysisPipeline's own historyUrls (see its doc comment), built
    // WITHOUT react_states on purpose: this pipeline ignores React state entirely, so it should
    // never quietly lean on a React-derived signal even for this guard.
    const historyUrls = new Set<string>([
      ...events.map((e) => normalizeUrl(e.url)),
      ...crawlStateStore.listBySite(site).map((s) => normalizeUrl(s.url)),
    ]);

    // Carrier-count per matched value: how many DISTINCT (canonical) request URLs carry each value as a
    // segment. Only the handful of values that match the preindex at all are counted (promova: 77), so
    // this is cheap. It powers the carrier-cap below — the piece of the main pipeline's maxSegmentMatches
    // the JSON path cannot get for free: in React a generic value saturates the rendered DOM (> cap
    // nodes) and is skipped, but the sparser JSON corpus holds a low-entropy value ("1", "0", a page
    // number / version / flag — never an object reference) in only a few bodies, so the hit-cap never
    // fires; yet that same value is carried by thousands of URLs and fans out combinatorially (on
    // promova just 7 such values drive a 12x candidate blow-up). normalizeUrl strips volatile `_rsc`
    // tokens so RSC duplicates of one request count once.
    const carriersByValue = new Map<string, Set<string>>();
    for (const event of events) {
      for (const segment of extractSegments({ url: event.url })) {
        if (!preindex.has(segment.value)) continue;
        let set = carriersByValue.get(segment.value);
        if (!set) { set = new Set<string>(); carriersByValue.set(segment.value, set); }
        set.add(`${event.method} ${normalizeUrl(event.url)}`);
      }
    }

    const seen = new Set<string>();
    const tasks: (() => Promise<void>)[] = [];

    let segmentsExtracted = 0;
    let jsonMatchesFound = 0;
    let candidatesFound = 0;
    // Per-site forge budget: generation early-aborts the moment distinct forges exceed the budget, so a
    // combinatorially explosive site (promova's ablation wants ~4.8M GETs) is flagged infeasible without
    // ever materialising millions of tasks or firing them at a live site (see maxGeneratedRequests).
    let infeasible = false;

    // `event` provides the segment's own URL (the splice target and, via `evaluateCandidate`, the
    // baseline response to compare the forged candidate against) — NOT necessarily the body the
    // match/siblings were found in: that's `bodies[hit.bodyIndex]`, resolved independently per hit.
    generation:
    for (const event of events) {
      // Forge references are 200 GETs only (same as AnalysisPipeline, and the GET-only invariant):
      // `event` is the splice target AND the forged request, so a non-GET here would reach
      // forgeRequest's non-GET refusal (talkpal's roleplay POSTs carry roleplay ids, so they DID), and a
      // 204/3xx/4xx has no usable reference body. Every event's body still fed the JSON preindex above
      // (siblings come from any response); the history filter still used every event.
      if (event.method.toUpperCase() !== 'GET' || event.status !== 200) continue;
      for (const segment of extractSegments({ url: event.url })) {
        segmentsExtracted++;
        // Same blacklists as the main pipeline (candidateGenerator): a pagination/sorting query param
        // (`curPage`, `limit`, …) is not an object reference, and an app-shell/section path root is not a
        // user-scoped id — mutating either is a guaranteed false positive, so skip before any forge.
        if (segment.paramName && paramNameBlacklisted({ name: segment.paramName, blacklist: options.paramBlacklist })) continue;
        // Locale / UI-language params select the response's language, not its owner (see isLocaleParam):
        // shared with the main pipeline so the ablation differs from it ONLY in using JSON siblings.
        if (segment.paramName && isLocaleParam({ name: segment.paramName })) continue;
        // Marketing/attribution params (utm_*, refclmark, campaignId, click-ids) name the visit's
        // provenance, not a resource — shared with the main pipeline (see isTrackingParam).
        if (segment.paramName && isTrackingParam({ name: segment.paramName })) continue;
        if (!segment.paramName && options.segmentBlacklist.includes(segment.value.toLowerCase())) continue;
        const hits = preindex.get(segment.value) ?? [];
        // Two maxSegmentMatches guards (JSON analogs of the main pipeline's, see the carriersByValue
        // note above): skip a value that matches too many bodies (hit-cap) OR is carried by too many
        // distinct URLs (carrier-cap). Both are generic-keyword signals, not identifiers.
        if (hits.length > options.maxSegmentMatches) continue;
        if ((carriersByValue.get(segment.value)?.size ?? 0) > options.maxSegmentMatches) continue;
        jsonMatchesFound += hits.length;
        for (const hit of hits) {
          const matchBody = bodies[hit.bodyIndex];
          if (matchBody === undefined) continue;
          for (const candidate of findJsonCandidates({ root: matchBody, path: hit.path })) {
            // Blacklist applies in BOTH directions (as in the main pipeline): also skip a candidate whose
            // REPLACEMENT value is a blacklisted path-segment root (mutating an id INTO `/app` etc.).
            if (!segment.paramName && options.segmentBlacklist.includes(String(candidate.candidateValue).toLowerCase())) continue;
            // same type-shape rule as the main pipeline (see candidateGenerator.sameIdShape)
            if (!sameIdShape({ original: segment.value, replacement: String(candidate.candidateValue) })) continue;
            candidatesFound++;
            // keeps the event's other query params (see candidateUrlFor's doc comment)
            const url = candidateUrlFor({ url: event.url, segment, value: candidate.candidateValue });
            if (historyUrls.has(normalizeUrl(url))) continue;
            // dedup by the CANONICAL url (normalizeUrl strips volatile `_rsc` tokens, see findings.ts)
            const key = `${event.method}|${normalizeUrl(url)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            tasks.push(() => this.evaluateCandidate({ page, site, event, url, candidate }));
            if (seen.size > options.maxGeneratedRequests) { infeasible = true; break generation; }
          }
        }
      }
    }

    if (infeasible) {
      log.warning(`AblationPipeline: ${site} ABANDONED as infeasible — candidate generation exceeded the ${options.maxGeneratedRequests} forge budget (combinatorial explosion); nothing dispatched`);
      statsStore.record({
        site, httpEvents: events.length, segmentsExtracted, jsonMatchesFound, candidatesFound,
        requestsGenerated: seen.size, vulnerabilitiesFlagged: 0, analysisMs: Date.now() - analysisStartedAt,
        infeasible: true,
      });
      return;
    }

    if (tasks.length > 0) {
      log.info(`AblationPipeline: dispatching ${tasks.length} candidate request(s) for ${site}`);
      await runWithConcurrency({ tasks, limit: options.maxConcurrentRequests });
    }

    const analysisMs = Date.now() - analysisStartedAt;
    log.info(`AblationPipeline: ${site} — analysis ${formatDuration(analysisMs)}`);

    statsStore.record({
      site, httpEvents: events.length, segmentsExtracted, jsonMatchesFound, candidatesFound,
      requestsGenerated: tasks.length, vulnerabilitiesFlagged: vulnerabilityStore.count(site), analysisMs,
      infeasible: false,
    });
  }

  private async evaluateCandidate({ page, site, event, url, candidate }: {
    page: Page; site: string; event: HttpEventRow; url: string; candidate: JsonCandidate;
  }): Promise<void> {
    const { vulnerabilityStore, classifier, forgedRequestStore, httpEventStore, options } = this.deps;

    // event came from listMetaBySite (no body): fetch the reference body lazily, once, here — bounded by
    // maxConcurrentRequests, so only a handful of bodies are ever in memory at a time (not all 0.6 GB).
    const referenceBody = event.id !== undefined ? httpEventStore.getResponseBody({ site, id: event.id }) : event.responseBody;

    const forged = await forgeRequestCached({
      cache: forgedRequestStore, site, page, url, method: event.method, headers: event.requestHeaders, postData: event.postData,
    });
    await sleep(options.timeBetweenRequestsMs);

    const similarity = getServerResponseSimilarity(
      { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: referenceBody ?? '', contentType: event.contentType },
      forged,
    );
    if (!similarity.areSimilar) {
      log.debug(`AblationPipeline: candidate rejected (forged response not similar) — ${event.method} ${event.url} -> ${url}`);
      return;
    }
    // Error-status guard, same as AnalysisPipeline: a 4xx/5xx forge (access denied / error) never
    // reached the resource, so it is never a leak — even if two error responses look similar.
    if (forged.status >= 400) {
      log.debug(`AblationPipeline: candidate rejected (forged response status ${forged.status}: denied/error) — ${event.method} ${event.url} -> ${url}`);
      return;
    }
    // Empty-data guard: a forge that returns no actual data (`{}`, `[]`, or an all-empty wrapper like
    // ejoy's `search-new` -> {"data":{"data":[],"total":0}} for a mutated param) leaked nothing, however
    // much it differs from the reference — not a finding.
    if (isEmptyJsonResponse({ body: forged.body })) {
      log.debug(`AblationPipeline: candidate rejected (forged response carries no data: empty object/array) — ${event.method} ${event.url} -> ${url}`);
      return;
    }
    // Error-envelope guard, same as AnalysisPipeline: a 200 whose top-level JSON is an error/denial
    // envelope (`{"error":true}`, `success:false`, `status:"error"`) reached nothing, not a leak.
    if (isErrorEnvelopeResponse({ body: forged.body })) {
      log.debug(`AblationPipeline: candidate rejected (forged response is an error envelope despite 200) — ${event.method} ${event.url} -> ${url}`);
      return;
    }

    const differences = compareObj(candidate.referenceProps, candidate.candidateProps);
    const authz = await assessAuthZ({ differences, classifier });
    if (!authz.isAuthzRelevant) {
      log.debug(`AblationPipeline: candidate rejected (no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}) — ${event.method} ${event.url} -> ${url} | ${describeDiffs(differences)}`);
      return;
    }
    // Same direction gate as the main pipeline: the candidate must be the restricted side.
    if (options.authzDirectionGate) {
      const direction = await assessDirection({ authz, classifier });
      if (direction.lessRestricted) {
        log.debug(`AblationPipeline: candidate rejected (candidate less restricted than the reference, delta=${direction.delta.toFixed(2)}: ${direction.evidence.join(' ')}) — ${event.method} ${event.url} -> ${url}`);
        return;
      }
    }

    // Same always-on HTTP content guards as AnalysisPipeline: drop a forged response already present in
    // the crawler's own http_events (already-accessible data), and dedup two swaps that forge an
    // identical response. No body => no key => finding kept. There is no await between here and the
    // record below, so the check-and-add on recordedForgedBodyKeys is atomic under concurrent evaluation.
    const forgedKey = canonicalResponseKey({ status: forged.status, body: forged.body });
    // The reference event's own response is EXCLUDED from the history check: a forge returning the
    // original's body is the "server ignored the swapped value" case, not data accessible at another
    // URL. (This ablation deliberately lacks AnalysisPipeline's isIdenticalResponse gate, so such a
    // candidate stays flaggable here — the studied weakness; only a match with a DIFFERENT captured
    // response is suppressed.)
    const referenceKey = canonicalResponseKey({ status: event.status ?? 0, body: referenceBody ?? '' });
    if (forgedKey !== undefined) {
      if (forgedKey !== referenceKey && this.responseHistoryKeys.has(forgedKey)) {
        log.debug(`AblationPipeline: candidate not flagged (forged response already in http_events at a different URL — already-accessible data) — ${event.method} ${event.url} -> ${url}`);
        return;
      }
      if (this.recordedForgedBodyKeys.has(forgedKey)) {
        log.debug(`AblationPipeline: candidate not flagged (duplicate forged response of an already-recorded finding) — ${event.method} ${event.url} -> ${url}`);
        return;
      }
      this.recordedForgedBodyKeys.add(forgedKey);
    }

    const id = ablationVulnerabilityId({ candidateValue: candidate.candidateValue, path: candidate.candidatePath, method: event.method, url });
    const inserted = vulnerabilityStore.record({
      id, site,
      referenceUrl: event.url, candidateUrl: url, method: event.method,
      referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue,
      motivation: describeDiffs(differences),
      responseSimilarity: similarity, authzDiff: authz,
    });
    if (inserted) {
      log.warning(`AblationPipeline: potential access control issue (http-json-ablation) — ${event.method} ${event.url} -> ${url}`);
    }
  }
}

/** undefined for anything that isn't a parseable JSON object/array (not JSON, HTML, empty body, ...). */
function parseJsonBody(responseBody: string | undefined): unknown {
  if (!responseBody) return undefined;
  try {
    const parsed = JSON.parse(responseBody);
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Same dedup-id shape as AnalysisPipeline's vulnerabilityId, substituting the JSON candidate path
 * for a React nodeId (there is no node here, only a position inside a JSON array). */
function ablationVulnerabilityId({ candidateValue, path, method, url }: {
  candidateValue: string; path: (string | number)[]; method: string; url: string;
}): string {
  return createHash('sha256').update(`ablation::${candidateValue}:path:${JSON.stringify(path)}http::${method}:${url}`).digest('hex');
}
