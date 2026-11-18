import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { HttpEventStore, HttpEventRow } from '../db/HttpEventStore';
import type { CrawlStateStore } from '../db/CrawlStateStore';
import type { AblationVulnerabilityStore } from '../db/AblationVulnerabilityStore';
import type { AblationStatsStore } from '../db/AblationStatsStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import { extractSegments, spliceSegment } from './segments';
import { buildJsonPreindex, findJsonCandidates, type JsonCandidate } from './jsonMatchFinder';
import { forgeRequestCached } from './requestForge';
import { runWithConcurrency, sleep } from '../utils/utils';
import { getServerResponseSimilarity, compareObj, describeDiffs } from './responseEvaluate';
import { assessAuthZ, type AuthzClassifier } from './authzClassifier';
import { formatDuration } from '../core/duration';
import { normalizeUrl } from './AnalysisPipeline';

export interface AblationPipelineOptions {
  maxConcurrentRequests: number;
  timeBetweenRequestsMs: number;
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
  constructor(private deps: AblationPipelineDeps) {}

  async runForSite({ page, site }: { page: Page; site: string }): Promise<void> {
    const analysisStartedAt = Date.now();
    const { httpEventStore, crawlStateStore, vulnerabilityStore, statsStore, options } = this.deps;
    // Scoped to THIS site only: listBySite already filters by site, and both `bodies`/`preindex`
    // below are built fresh from exactly this array on every call — never cached across sites, so a
    // JSON body captured for a different site can never leak into this one's index.
    const events = httpEventStore.listBySite(site);
    // Parsed once, same order/indices as `events`; undefined for a non-JSON/unparseable body.
    const bodies = events.map((e) => parseJsonBody(e.responseBody));
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

    const seen = new Set<string>();
    const tasks: (() => Promise<void>)[] = [];

    let segmentsExtracted = 0;
    let jsonMatchesFound = 0;
    let candidatesFound = 0;

    // `event` provides the segment's own URL (the splice target and, via `evaluateCandidate`, the
    // baseline response to compare the forged candidate against) — NOT necessarily the body the
    // match/siblings were found in: that's `bodies[hit.bodyIndex]`, resolved independently per hit.
    for (const event of events) {
      for (const segment of extractSegments({ url: event.url })) {
        segmentsExtracted++;
        const hits = preindex.get(segment.value) ?? [];
        jsonMatchesFound += hits.length;
        for (const hit of hits) {
          const matchBody = bodies[hit.bodyIndex];
          if (matchBody === undefined) continue;
          for (const candidate of findJsonCandidates({ root: matchBody, path: hit.path })) {
            candidatesFound++;
            const url = spliceSegment({ parts: segment.parts, index: segment.index, value: candidate.candidateValue, query: segment.query });
            if (historyUrls.has(normalizeUrl(url))) continue;
            const key = `${event.method}|${url}`;
            if (seen.has(key)) continue;
            seen.add(key);
            tasks.push(() => this.evaluateCandidate({ page, site, event, url, candidate }));
          }
        }
      }
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
    });
  }

  private async evaluateCandidate({ page, site, event, url, candidate }: {
    page: Page; site: string; event: HttpEventRow; url: string; candidate: JsonCandidate;
  }): Promise<void> {
    const { vulnerabilityStore, classifier, forgedRequestStore, options } = this.deps;

    const forged = await forgeRequestCached({
      cache: forgedRequestStore, site, page, url, method: event.method, headers: event.requestHeaders, postData: event.postData,
    });
    await sleep(options.timeBetweenRequestsMs);

    const similarity = getServerResponseSimilarity(
      { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: event.responseBody ?? '', contentType: event.contentType },
      forged,
    );
    if (!similarity.areSimilar) {
      log.debug(`AblationPipeline: candidate rejected (forged response not similar) — ${event.method} ${event.url} -> ${url}`);
      return;
    }

    const differences = compareObj(candidate.referenceProps, candidate.candidateProps);
    const authz = await assessAuthZ({ differences, classifier });
    if (!authz.isAuthzRelevant) {
      log.debug(`AblationPipeline: candidate rejected (no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}) — ${event.method} ${event.url} -> ${url} | ${describeDiffs(differences)}`);
      return;
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
