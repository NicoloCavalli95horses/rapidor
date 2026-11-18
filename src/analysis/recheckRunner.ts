import type { Page } from 'playwright';
import type { HttpEventStore } from '../db/HttpEventStore';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';
import type { StoredFinding } from '../db/VulnerabilityStore';
import { forgeRequestCached } from './requestForge';
import { getServerResponseSimilarity, isIdenticalResponse } from './responseEvaluate';
import { CLIENT_ROUTING_METHOD } from './findings';
import { withParam } from '../utils/utils';
import type { PagePool } from './PagePool';
import type { ClientRoutingVerifier } from './clientRoutingVerifier';

export interface RecheckRunnerDeps {
  httpEventStore: HttpEventStore;
  forgedRequestStore: ForgedRequestStore;
  pagePool: PagePool;
  clientRoutingVerifier: ClientRoutingVerifier;
  options: { clientRoutingConcurrency: number };
}

/**
 * The recheck entry point, kept apart from the discovery pipeline because it answers a different
 * question: not "what can we find on this site" but "would the findings we already stored still be
 * flagged by today's guards". scripts/recheckFindings.ts drives it; it writes nothing.
 */
export class RecheckRunner {
  constructor(private deps: RecheckRunnerDeps) {}

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
   * - `client-routing`: the probe + the DOM content guards (ClientRoutingVerifier). The page URL and the
   *   swapped param/segment are recovered from the stored reference/candidate URLs (for a finding that
   *   came from the http fallback, the page URL is the captured event's own page_url).
   * The authz-relevance step is not re-run: it depends only on the React props, which this change does
   * not touch, so the stored finding already passed it.
   */
  async recheckFindings({ page, site, findings }: {
    page: Page; site: string; findings: StoredFinding[];
  }): Promise<{ finding: StoredFinding; kept: boolean; reason: string }[]> {
    this.deps.clientRoutingVerifier.reset();
    const events = this.deps.httpEventStore.listBySite(site);
    await this.deps.pagePool.setup({ page, size: Math.max(1, this.deps.options.clientRoutingConcurrency) });
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
      await this.deps.pagePool.teardown();
    }
  }

  /** One finding of recheckFindings: a rejection reason, or null if it would still be flagged. */
  private async recheckOne({ site, finding, events, page }: {
    site: string; finding: StoredFinding; events: ReturnType<HttpEventStore['listBySite']>; page: Page;
  }): Promise<string | null> {
    const { referenceUrl, candidateUrl, referenceValue, candidateValue } = finding;
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
        const fallback = await this.recheckQueryFallback({ pageUrl: event.pageUrl, referenceUrl, referenceValue, candidateValue });
        return fallback === null ? null : `${why}; client-routing fallback: ${fallback}`;
      }
      return this.recheckQueryFallback({ pageUrl: event.pageUrl, referenceUrl, referenceValue, candidateValue });
    }

    // A pure client-routing finding: reference_url is the page, candidate_url its mutated route.
    const ref = new URL(referenceUrl);
    const cand = new URL(candidateUrl);
    if (ref.pathname === cand.pathname) {
      const paramName = [...cand.searchParams.keys()].find((k) => cand.searchParams.get(k) === candidateValue && ref.searchParams.get(k) !== candidateValue);
      if (!paramName) return 'cannot tell which query param was swapped';
      return this.deps.clientRoutingVerifier.verifyQueryParam({
        pageUrl: referenceUrl, candidateUrl, paramName, candidateValue,
        referenceValue: ref.searchParams.get(paramName) ?? referenceValue, highSuspicion: true,
      });
    }
    // path segment: the stored reference value is not always the bare segment, so take the segment
    // that actually differs between the two paths (used only for masking the reference render)
    const refSegs = ref.pathname.split('/');
    const candSegs = cand.pathname.split('/');
    const i = candSegs.findIndex((seg, k) => seg !== refSegs[k]);
    return this.deps.clientRoutingVerifier.verifyPathSegment({
      pageUrl: referenceUrl, candidateUrl, candidateValue,
      referenceValue: i >= 0 ? decodeURIComponent(refSegs[i] ?? '') : referenceValue, highSuspicion: true,
    });
  }

  /** The http path's client-routing fallback, rebuilt from a stored finding: same param, swapped on the event's own page. */
  private async recheckQueryFallback({ pageUrl, referenceUrl, referenceValue, candidateValue }: {
    pageUrl: string; referenceUrl: string; referenceValue: string; candidateValue: string;
  }): Promise<string | null> {
    const paramName = [...new URL(referenceUrl).searchParams.entries()].find(([, v]) => v === referenceValue)?.[0];
    // a path-segment candidate gets no client-routing fallback on the http path (see evaluateHttpCandidate)
    if (!paramName) return 'no client-routing fallback for a path-segment http candidate';
    const candidateUrl = withParam({ url: pageUrl, name: paramName, value: candidateValue });
    return this.deps.clientRoutingVerifier.verifyQueryParam({
      pageUrl, candidateUrl, paramName, candidateValue, referenceValue, highSuspicion: true,
    });
  }
}
