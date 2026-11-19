import type { Page, Request, Response } from 'playwright';
import type { HttpEventStore } from '../db/HttpEventStore';

export interface CapturedRequest {
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  postData?: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  contentType?: string;
  responseBody?: string;
  timestamp: string;
  pageUrl: string;   // the document's URL when this request happened; lets analysis replay a purely
                      // client-routed candidate (pushState, no real request) on the right page later
}

export interface NetworkStats {
  total: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  failed: number;
  skippedOffDomain: number;
}

export interface NetworkObserverOptions {
  origin: string;
  maxBodyBytes?: number;   // caps the saved response body; default 200KB
  store?: HttpEventStore;  // deduplicated persistence, shared across every tab exploring this site
  extraApiDomains?: string[];  // first-party API domains that don't share a base domain with `origin`
                                // (e.g. a CloudFront/API Gateway backend); matched the same way as origin itself
}

const DEFAULT_MAX_BODY_BYTES = 200_000;

/**
 * Captures same-site fetch/XHR traffic directly via Playwright, as a crawler-side counterpart to
 * RAPIDOR's in-page HTTPTracker. `attach` can be called on several pages (tabs): they all feed the
 * same snapshot, mirroring RAPIDOR's own cross-tab aggregation.
 */
export class NetworkObserver {
  private site: string;
  private allowedBaseDomains: Set<string>;
  private maxBodyBytes: number;
  private store?: HttpEventStore;
  // Only populated when there is NO `store` (store-less unit tests inspect it). In production a store
  // is always passed, so captures go straight to SQLite and nothing accumulates here — see handle().
  private requests: CapturedRequest[] = [];
  private stats: NetworkStats = {
    total: 0, byMethod: {}, byStatus: {}, failed: 0, skippedOffDomain: 0,
  };

  constructor({ origin, maxBodyBytes = DEFAULT_MAX_BODY_BYTES, store, extraApiDomains = [] }: NetworkObserverOptions) {
    this.site = new URL(origin).hostname;
    this.allowedBaseDomains = new Set([baseDomain(this.site), ...extraApiDomains.map(baseDomain)]);
    this.maxBodyBytes = maxBodyBytes;
    this.store = store;
  }

  attach(page: Page): void {
    page.on('requestfinished', (req) => { void this.handle(req, page); });
    // Some frameworks (observed with Next.js's RSC router) read a response fully, then cancel the
    // body stream once they have what they need; Chrome reports that as a failed/aborted request
    // even though a real response (status/headers) was received. req.response() still resolves in
    // that case, so these are handled identically to a finished request; only a response-less
    // failure (DNS, connection refused, truly aborted mid-flight) counts as `stats.failed`.
    page.on('requestfailed', (req) => { void this.handle(req, page); });
  }

  snapshot(): { requests: CapturedRequest[]; stats: NetworkStats } {
    return { requests: this.requests, stats: this.stats };
  }

  /**
   * Same-domain-or-subdomain check, mirroring HTTPAnalyzer.isAllowed/getBaseDomain in RAPIDOR, extended
   * with `extraApiDomains`: many real apps serve their API from a backend that shares no base domain
   * with the page (CloudFront, API Gateway, a separate SaaS domain, ...), which the plain RAPIDOR-style
   * check would otherwise discard outright.
   */
  private isSameSite(url: string): boolean {
    try {
      return this.allowedBaseDomains.has(baseDomain(new URL(url).hostname));
    } catch {
      return false;
    }
  }

  private async handle(req: Request, page: Page): Promise<void> {
    if (req.resourceType() !== 'fetch' && req.resourceType() !== 'xhr') return;
    if (!this.isSameSite(req.url())) { this.stats.skippedOffDomain++; return; }

    const res = await req.response().catch(() => null);
    if (!res) { this.stats.failed++; return; }   // a genuine failure: no response at all (DNS, connection refused, ...)

    const entry: CapturedRequest = {
      url: req.url(),
      method: req.method(),
      requestHeaders: await req.allHeaders().catch(() => ({})),
      postData: truncate(req.postData() ?? undefined, this.maxBodyBytes),
      timestamp: new Date().toISOString(),
      pageUrl: page.url(),
    };
    await this.fillResponse(entry, res);

    // when a store is present (always, in production) we record straight to SQLite and keep nothing in memory;
    // the in-memory buffer is only the fallback sink when there is no store 
    if (this.store) this.store.record({ site: this.site, request: entry });
    else this.requests.push(entry);
    this.stats.total++;
    this.stats.byMethod[entry.method] = (this.stats.byMethod[entry.method] ?? 0) + 1;
    if (entry.status !== undefined) {
      const key = String(entry.status);
      this.stats.byStatus[key] = (this.stats.byStatus[key] ?? 0) + 1;
    }
  }

  private async fillResponse(entry: CapturedRequest, res: Response): Promise<void> {
    entry.status = res.status();
    entry.responseHeaders = await res.allHeaders().catch(() => ({}));
    entry.contentType = entry.responseHeaders['content-type'];
    // binary bodies, or ones a client-side stream reader already cancelled (observed with Next.js's
    // RSC router: it reads what it needs, then cancels, which Chrome reports as a failed request
    // even though status/headers did arrive) just end up without a responseBody: best-effort only.
    const text = await res.text().catch(() => undefined);
    entry.responseBody = truncate(text, this.maxBodyBytes);
  }
}

function truncate(text: string | undefined, maxBytes: number): string | undefined {
  if (text === undefined) return undefined;
  return Buffer.byteLength(text) > maxBytes ? `${text.slice(0, maxBytes)}…[truncated]` : text;
}

/** Last two domain labels, e.g. "learn.pimsleur.com" -> "pimsleur.com" (same rule as RAPIDOR's). */
function baseDomain(hostname: string): string {
  return hostname.split('.').slice(-2).join('.');
}
