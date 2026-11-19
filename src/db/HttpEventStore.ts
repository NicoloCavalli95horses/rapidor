import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { CapturedRequest } from '../browser/NetworkObserver';

export interface HttpEventStoreOptions {
  db: Database.Database;   // shared connection (opened once per crawler run via openDatabase)
  clearOnStart: boolean;   // wipe http_events once, at construction
}

export interface HttpEventRow {
  id?: number;             // row id, present on rows read back from the DB; lets a caller fetch the body lazily
  method: string;
  url: string;
  pageUrl: string;
  status?: number;
  contentType?: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  postData?: string;
  responseBody?: string;   // undefined on rows from listMetaBySite — fetch it lazily with getResponseBody
}

/**
 * Deduplicated, cross-tab persistence for HTTP events captured by NetworkObserver, so later
 * analysis (match-finding, request-forging) sees each distinct exchange exactly once, tagged with
 * the app (site) it came from.
 */
export class HttpEventStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: HttpEventStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS http_events (
        id INTEGER PRIMARY KEY,
        site TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        method TEXT,
        url TEXT,
        page_url TEXT,
        status INTEGER,
        content_type TEXT,
        request_headers TEXT,
        response_headers TEXT,
        post_data TEXT,
        response_body TEXT,
        first_seen_at TEXT,
        seen_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(site, fingerprint)
      )
    `);
    if (clearOnStart) this.db.exec('DELETE FROM http_events');
  }

  /** Removes every row for one site: used to overwrite a single domain's previous run without touching the others. */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM http_events WHERE site = ?').run(site);
  }

  /**
   * Inserts the request, or bumps seen_count if the same (site, fingerprint) was already stored:
   * the only place duplicates across tabs/reloads get collapsed.
   */
  record({ site, request }: { site: string; request: CapturedRequest }): void {
    this.db.prepare(`
      INSERT INTO http_events (
        site, fingerprint, method, url, page_url, status, content_type,
        request_headers, response_headers, post_data, response_body, first_seen_at
      ) VALUES (
        @site, @fingerprint, @method, @url, @pageUrl, @status, @contentType,
        @requestHeaders, @responseHeaders, @postData, @responseBody, @firstSeenAt
      )
      ON CONFLICT(site, fingerprint) DO UPDATE SET seen_count = seen_count + 1
    `).run({
      site,
      fingerprint: fingerprintOf(request),
      method: request.method,
      url: request.url,
      pageUrl: request.pageUrl,
      status: request.status ?? null,
      contentType: request.contentType ?? null,
      requestHeaders: JSON.stringify(request.requestHeaders),
      responseHeaders: request.responseHeaders ? JSON.stringify(request.responseHeaders) : null,
      postData: request.postData ?? null,
      responseBody: request.responseBody ?? null,
      firstSeenAt: request.timestamp,
    });
  }

  count(site?: string): number {
    const row = site
      ? this.db.prepare('SELECT COUNT(*) AS n FROM http_events WHERE site = ?').get(site)
      : this.db.prepare('SELECT COUNT(*) AS n FROM http_events').get();
    return (row as { n: number }).n;
  }

  /** All distinct events for a site, WITH bodies, in capture order. Heavy on body-rich sites: prefer
   *  listMetaBySite + getResponseBody/forEachResponse unless every body is genuinely needed at once. */
  listBySite(site: string): HttpEventRow[] {
    const rows = this.db.prepare('SELECT * FROM http_events WHERE site = ? ORDER BY id ASC').all(site) as {
      id: number; method: string; url: string; page_url: string; status: number | null; content_type: string | null;
      request_headers: string | null; response_headers: string | null; post_data: string | null; response_body: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      method: r.method,
      url: r.url,
      pageUrl: r.page_url,
      status: r.status ?? undefined,
      contentType: r.content_type ?? undefined,
      requestHeaders: r.request_headers ? JSON.parse(r.request_headers) : {},
      responseHeaders: r.response_headers ? JSON.parse(r.response_headers) : undefined,
      postData: r.post_data ?? undefined,
      responseBody: r.response_body ?? undefined,
    }));
  }

  /** Same as listBySite but WITHOUT response_body (the one big column): the analysis iterates all events
   *  for metadata/URLs and only needs the body of the few it actually compares, fetched lazily below.
   *  Keeps a body-rich site (promova: 17k events, ~568 MB of bodies) from being materialised in one array. */
  listMetaBySite(site: string): HttpEventRow[] {
    const rows = this.db.prepare(
      'SELECT id, method, url, page_url, status, content_type, request_headers, response_headers, post_data FROM http_events WHERE site = ? ORDER BY id ASC',
    ).all(site) as {
      id: number; method: string; url: string; page_url: string; status: number | null; content_type: string | null;
      request_headers: string | null; response_headers: string | null; post_data: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      method: r.method,
      url: r.url,
      pageUrl: r.page_url,
      status: r.status ?? undefined,
      contentType: r.content_type ?? undefined,
      requestHeaders: r.request_headers ? JSON.parse(r.request_headers) : {},
      responseHeaders: r.response_headers ? JSON.parse(r.response_headers) : undefined,
      postData: r.post_data ?? undefined,
      responseBody: undefined,
    }));
  }

  /** One event's response body, by row id — the lazy counterpart to listMetaBySite. */
  getResponseBody({ site, id }: { site: string; id: number }): string | undefined {
    const row = this.db.prepare('SELECT response_body AS body FROM http_events WHERE site = ? AND id = ?').get(site, id) as { body: string | null } | undefined;
    return row?.body ?? undefined;
  }

  /** Streams (status, body) for every event of a site one row at a time (never materialising all bodies),
   *  so a caller can fold them — e.g. build the response-history key set — with bounded memory. */
  forEachResponse({ site, onRow }: { site: string; onRow: (row: { status?: number; body?: string }) => void }): void {
    const stmt = this.db.prepare('SELECT status, response_body AS body FROM http_events WHERE site = ? ORDER BY id ASC');
    for (const r of stmt.iterate(site) as IterableIterator<{ status: number | null; body: string | null }>) {
      onRow({ status: r.status ?? undefined, body: r.body ?? undefined });
    }
  }
}

/** Same method+url with a different body counts as a distinct event; an identical repeat dedupes. */
function fingerprintOf(request: CapturedRequest): string {
  const bodyHash = createHash('sha1').update(request.postData ?? '').digest('hex');
  return `${request.method}|${request.url}|${bodyHash}`;
}
