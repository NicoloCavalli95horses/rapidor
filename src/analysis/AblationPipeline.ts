import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { HttpEventStore, HttpEventRow } from '../db/HttpEventStore';
import type { CrawlStateStore } from '../db/CrawlStateStore';
import type { AblationVulnerabilityStore } from '../db/AblationVulnerabilityStore';
import type { AblationStatsStore } from '../db/AblationStatsStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { extractSegments, candidateUrlFor, type SegmentCandidate } from './segments';
import { buildJsonPreindex, findJsonCandidates, type JsonCandidate } from './jsonMatchFinder';
import { paramNameBlacklisted, isLocaleParam, isTrackingParam, sameIdShape, isNonSerializableMarker } from './candidateGenerator';
import { forgeRequestCached } from './requestForge';
import { applyAuthOverride, type AuthOverride } from './authSession';
import { runWithConcurrency, sleep } from '../utils/utils';
import { getServerResponseSimilarity, canonicalResponseKey, describeDiffs, isIdenticalResponse } from './responseEvaluate';
import type { AuthzClassifier } from './authzClassifier';
import { authzGateVerdict, httpContentGuardReason } from './httpGuards';
import { ForgeValueSensitivity, forgeTemplateKey } from './forgeValueSensitivity';
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
  // Same as AnalysisPipelineOptions.authOverride: re-points the forge at a re-authenticated session.
  authOverride?: AuthOverride;
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
 * a value inside a captured JSON body (buildJsonPreindex, the JSON analog of
 * PreindexedValueStore.findByValue), the "siblings" are the other elements of every enclosing array
 * (findJsonCandidates) — the JSON idiom for "multiple instances of the same kind of entity", playing
 * the role RAPIDOR's componentIndex plays for React nodes.
 *
 * Everything else is the main pipeline's: same generation filters, and the SAME decision code
 * (httpGuards: scoped authz gate + direction, content guards; plus isIdenticalResponse and the
 * value-insensitivity/dedup finalization). Only the React/DOM-bound steps are absent (chrome zone,
 * client-routing probes and the HTTP→client-routing fallback).
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
  // Same value-insensitivity guard as the main pipeline (forgeValueSensitivity.ts): findings are deferred
  // to the end of the run, since the colliding sibling forge may come later.
  private forgeValueSensitivity = new ForgeValueSensitivity();

  constructor(private deps: AblationPipelineDeps) {}

  async runForSite({ page, site }: { page: Page; site: string }): Promise<void> {
    const analysisStartedAt = Date.now();
    const { httpEventStore, crawlStateStore, vulnerabilityStore, statsStore, options } = this.deps;
    // Re-analysis hygiene, mirroring AnalysisPipeline (see config.analysis.overwriteFindingsPerSite):
    // a re-run's ablation findings REPLACE this site's previous ablation_vulnerabilities instead of
    // accumulating (record is INSERT OR IGNORE on a deterministic id). Reset the per-run guard sets too.
    if (options.overwriteFindingsPerSite !== false) vulnerabilityStore.clearSite({ site });
    this.recordedForgedBodyKeys = new Set<string>();
    this.forgeValueSensitivity.reset();
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
    // Forge references are 200 GETs only (same as AnalysisPipeline, and the GET-only invariant): `event` is
    // the splice target AND the forged request, so a non-GET would reach forgeRequest's refusal and a
    // 204/3xx/4xx has no usable reference body. One representative per CANONICAL url, as the main pipeline
    // (same candidates, comparable stats). Every event still fed the preindex and the history filter.
    const uniqueGets: typeof events = [];
    const seenEventUrls = new Set<string>();
    for (const event of events) {
      if (event.method.toUpperCase() !== 'GET' || event.status !== 200) continue;
      const canonical = normalizeUrl(event.url);
      if (seenEventUrls.has(canonical)) continue;
      seenEventUrls.add(canonical);
      uniqueGets.push(event);
    }

    generation:
    for (const event of uniqueGets) {
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
          for (const candidate of findJsonCandidates({ root: matchBody, path: hit.path, matchedValue: segment.value })) {
            // Blacklist applies in BOTH directions (as in the main pipeline): also skip a candidate whose
            // REPLACEMENT value is a blacklisted path-segment root (mutating an id INTO `/app` etc.).
            if (!segment.paramName && options.segmentBlacklist.includes(String(candidate.candidateValue).toLowerCase())) continue;
            // same as the main pipeline (a no-op on server JSON, kept so the two filters stay identical)
            if (isNonSerializableMarker({ value: String(candidate.candidateValue) })) continue;
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
            tasks.push(() => this.evaluateCandidate({ page, site, event, url, candidate, segment }));
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
    this.finalizeFindings();

    const analysisMs = Date.now() - analysisStartedAt;
    log.info(`AblationPipeline: ${site} — analysis ${formatDuration(analysisMs)}`);

    statsStore.record({
      site, httpEvents: events.length, segmentsExtracted, jsonMatchesFound, candidatesFound,
      requestsGenerated: tasks.length, vulnerabilitiesFlagged: vulnerabilityStore.count(site), analysisMs,
      infeasible: false,
    });
  }

  /**
   * Same decision sequence as CandidateEvaluator.evaluateHttpCandidate, minus what needs React/DOM (the
   * client-routing fallback): authz gate first (no forge without an entitlement diff), forge, identical-
   * response gate, shared content guards, then a DEFERRED record (value-insensitivity + cross-candidate
   * dedup in finalizeFindings, as finalizeHttpFindings).
   */
  private async evaluateCandidate({ page, site, event, url, candidate, segment }: {
    page: Page; site: string; event: HttpEventRow; url: string; candidate: JsonCandidate; segment: SegmentCandidate;
  }): Promise<void> {
    const { vulnerabilityStore, classifier, forgedRequestStore, httpEventStore, options } = this.deps;
    const context = `${event.method} ${event.url} -> ${url}`;

    // CHEAP FIRST, shared with the main pipeline: diff scoped to the swapped resource, swap diff excluded,
    // direction gate. The `props` prefix makes the JSON item play a React node's props (the helpers strip it).
    const verdict = await authzGateVerdict({
      referenceProps: candidate.referenceProps, candidateProps: candidate.candidateProps,
      swapPath: ['props', ...candidate.swapPath], classifier, directionGate: options.authzDirectionGate,
    });
    if (verdict.reject !== undefined) {
      log.debug(`AblationPipeline: candidate rejected (${verdict.reject}) — ${context} | ${describeDiffs(verdict.differences)}`);
      return;
    }
    const authz = verdict.authz;

    const forged = await forgeRequestCached({
      cache: forgedRequestStore, site, page, url, method: event.method,
      headers: applyAuthOverride({ headers: event.requestHeaders, override: options.authOverride }),
      postData: event.postData,
    });
    await sleep(options.timeBetweenRequestsMs);

    // Every forge is evidence about its request slot, accepted or not (see forgeValueSensitivity.ts).
    const template = forgeTemplateKey({ method: event.method, url: event.url, segment });
    const forgedKey = canonicalResponseKey({ status: forged.status, body: forged.body });
    this.forgeValueSensitivity.observe({ template, forgedKey, value: candidate.candidateValue });

    // event came from listMetaBySite (no body): fetch the reference body lazily, bounded by the concurrency.
    const referenceBody = event.id !== undefined ? httpEventStore.getResponseBody({ site, id: event.id }) : event.responseBody;
    const original = { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: referenceBody ?? '', contentType: event.contentType };
    const similarity = getServerResponseSimilarity(original, forged);
    if (!similarity.areSimilar) {
      log.debug(`AblationPipeline: candidate rejected (forged response not similar) — ${context}`);
      return;
    }
    // Server ignored the swapped value (identical to the original): nothing leaked. The main pipeline tries
    // its client-routing fallback here; the ablation has none, so it drops.
    if (isIdenticalResponse({ reference: original, candidate: forged })) {
      log.debug(`AblationPipeline: candidate rejected (forged response identical to the original: the server ignores the value) — ${context}`);
      return;
    }
    const reason = httpContentGuardReason({ forged, original, responseHistoryKeys: this.responseHistoryKeys });
    if (reason !== null) {
      log.debug(`AblationPipeline: candidate not flagged (${reason}) — ${context}`);
      return;
    }

    this.forgeValueSensitivity.defer({
      template, forgedKey, context,
      recordHttp: () => {
        let origin: string;
        try { origin = new URL(url).origin; } catch { origin = url; }
        const id = ablationVulnerabilityId({ site, origin, method: event.method, referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue, path: candidate.candidatePath });
        const inserted = vulnerabilityStore.record({
          id, site,
          referenceUrl: event.url, candidateUrl: url, method: event.method,
          referenceValue: String(candidate.referenceValue), candidateValue: candidate.candidateValue,
          motivation: describeDiffs(authz.differences),
          responseSimilarity: similarity, authzDiff: authz,
        });
        if (inserted) log.warning(`AblationPipeline: potential access control issue (http-json-ablation) — ${context}`);
      },
      onValueInsensitive: async () => {},   // no client-routing fallback in the ablation
    });
  }

  /**
   * Mirrors CandidateEvaluator.finalizeHttpFindings: in arrival order, (1) drop a finding whose forged
   * response another VALUE reproduced in the same request slot (server default), (2) dedup two swaps with
   * an identical forged response, then record.
   */
  private finalizeFindings(): void {
    for (const f of this.forgeValueSensitivity.drain()) {
      if (this.forgeValueSensitivity.isValueInsensitive({ template: f.template, forgedKey: f.forgedKey })) {
        log.debug(`AblationPipeline: candidate not flagged (another value forged in the same slot returned the identical response: the server falls back to a default) — ${f.context}`);
        continue;
      }
      if (f.forgedKey !== undefined) {
        if (this.recordedForgedBodyKeys.has(f.forgedKey)) {
          log.debug(`AblationPipeline: candidate not flagged (duplicate forged response of an already-recorded finding) — ${f.context}`);
          continue;
        }
        this.recordedForgedBodyKeys.add(f.forgedKey);
      }
      f.recordHttp();
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

/**
 * Mirrors AnalysisPipeline's vulnerabilityId (HTTP branch): keyed on the LAYER (`origin`+`method`) and
 * the swapped SIBLING PAIR, carrier-independent — the full `url` is EXCLUDED so one leak reached from two
 * carriers (promova's lesson 77 under two `/my-plan/<plan>/` segments, or differing only by `_rsc`)
 * collapses to one row, as it already does in the main pipeline. The JSON `referenceValue -> candidateValue`
 * + the candidate's array-path play the React node pair + `path` the main keys on (there is no node here).
 */
function ablationVulnerabilityId({ site, origin, method, referenceValue, candidateValue, path }: {
  site: string; origin: string; method: string; referenceValue: string; candidateValue: string; path: (string | number)[];
}): string {
  return createHash('sha256').update(`ablation::site::${site}:origin::${origin}:method::${method}:swap::${referenceValue}->${candidateValue}:path::${JSON.stringify(path)}`).digest('hex');
}
