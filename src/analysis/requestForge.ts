import type { Page } from 'playwright';
import type { ForgedRequestStore } from '../db/ForgedRequestStore';

export interface ResponseLike {
  status: number;
  headers: Record<string, string>;
  body: string;
  contentType?: string;
}

/**
 * Dispatches a forged request via Playwright's APIRequestContext (page.request), which reuses the
 * browsing context's cookies but, unlike the page's own fetch/XHR, never fires page.on('request'/
 * 'requestfinished') — verified directly before building this. That means NetworkObserver never
 * sees or stores this probe traffic in http_events, so (unlike RAPIDOR, whose HTTPTracker sees
 * everything the page does) no _requestId/ignore tagging is needed here.
 */
export async function forgeRequest({ page, url, method, headers, postData }: {
  page: Page; url: string; method: string; headers?: Record<string, string>; postData?: string;
}): Promise<ResponseLike> {
  // Hard safety backstop: this detector only ever READS, so it forges GET and nothing else. A
  // non-GET forge would replay a state-changing request against the live target — never acceptable
  // for an authz probe. Callers already filter to GET; this refuses anything that slips through.
  if (method.toUpperCase() !== 'GET') {
    throw new Error(`forgeRequest refuses non-GET method "${method}" (IDOR probing is read-only)`);
  }
  // HTTP/2 responses surface pseudo-headers (:authority, :method, :path, :scheme) via
  // Playwright's allHeaders(); APIRequestContext.fetch rejects them as invalid HTTP tokens.
  const filteredHeaders = headers
    ? Object.fromEntries(Object.entries(headers).filter(([name]) => !name.startsWith(':')))
    : headers;
  const res = await page.request.fetch(url, {
    method,
    headers: filteredHeaders,
    data: postData,
    failOnStatusCode: false,
  });
  const body = await res.text().catch(() => '');
  const responseHeaders = res.headers();
  return { status: res.status(), headers: responseHeaders, body, contentType: responseHeaders['content-type'] };
}

/**
 * forgeRequest, but checking a shared ForgedRequestStore first: if either pipeline — AnalysisPipeline
 * (React-informed) or AblationPipeline (HTTP-JSON-only) — already forged this exact (site, method,
 * url, body) candidate, the other reuses that response instead of hitting the live site again. See
 * ForgedRequestStore's own doc comment for why this matters specifically for the ablation study, and
 * for why the body is part of the cache key too (two POSTs to the same URL with different bodies are
 * different requests).
 */
export async function forgeRequestCached({ cache, site, page, url, method, headers, postData, requireCache }: {
  cache: ForgedRequestStore; site: string; page?: Page; url: string; method: string;
  headers?: Record<string, string>; postData?: string;
  // Offline/replay (the deterministic demo): the response MUST come from the cache. A miss throws
  // instead of forging live, so an offline run can never silently hit the network — see
  // AnalysisPipelineOptions.offline and demo/README.md.
  requireCache?: boolean;
}): Promise<ResponseLike> {
  const cached = cache.get({ site, method, url, postData });
  if (cached) return cached;
  if (requireCache) {
    throw new Error(`forgeRequestCached: no cached response for ${method} ${url} (offline mode refuses to hit the network)`);
  }
  if (!page) throw new Error('forgeRequestCached: a live forge needs a page (none given, and no cached response)');
  const response = await forgeRequest({ page, url, method, headers, postData });
  cache.record({ site, method, url, postData, response });
  return response;
}
