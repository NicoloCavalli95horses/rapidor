import type Database from 'better-sqlite3';
import type { ResponseLike } from '../analysis/requestForge';

export interface ForgedRequestStoreOptions {
  db: Database.Database;
  clearOnStart: boolean;
}

/**
 * Shared cache of forged (site, method, url, request body) -> response, consulted by BOTH
 * AnalysisPipeline and AblationPipeline before dispatching a live request to the site under test.
 * The two pipelines often propose the exact same candidate from two different sources — a React
 * sibling and a JSON sibling can legitimately be the same underlying id swap, especially since the
 * ablation study exists specifically to compare them on the same data — so forging it twice would
 * double the live traffic against the target for no benefit: the server's answer does not depend on
 * which analysis proposed the candidate. Whichever pipeline runs first (AnalysisHooks before
 * AblationHooks, see buildExplorer's own ordering comment) populates this; the other reuses it.
 *
 * The request body is part of the key, not just method+url: two POSTs to the same URL with
 * different bodies are different requests and must never be conflated (`postData` is coalesced to
 * `''` so "no body" compares equal to itself, not to a body that happens to be the empty string).
 */
export class ForgedRequestStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: ForgedRequestStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS forged_requests (
        site TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        post_data TEXT NOT NULL,
        status INTEGER NOT NULL,
        headers TEXT NOT NULL,
        body TEXT NOT NULL,
        content_type TEXT,
        forged_at TEXT NOT NULL,
        PRIMARY KEY (site, method, url, post_data)
      )
    `);
    if (clearOnStart) this.db.exec('DELETE FROM forged_requests');
  }

  /** Removes every row for one site: used to overwrite a single domain's previous run without touching the others. */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM forged_requests WHERE site = ?').run(site);
  }

  get({ site, method, url, postData }: { site: string; method: string; url: string; postData?: string }): ResponseLike | undefined {
    const row = this.db.prepare(
      'SELECT status, headers, body, content_type AS contentType FROM forged_requests WHERE site = ? AND method = ? AND url = ? AND post_data = ?',
    ).get(site, method, url, postData ?? '') as { status: number; headers: string; body: string; contentType: string | null } | undefined;
    if (!row) return undefined;
    return { status: row.status, headers: JSON.parse(row.headers), body: row.body, contentType: row.contentType ?? undefined };
  }

  /** URLs (no bodies) forged for one site+method under an origin: recheck's sibling-forge lookup (value-insensitivity guard). */
  listUrlsByOrigin({ site, method, origin }: { site: string; method: string; origin: string }): string[] {
    const prefix = `${origin}/`;
    return (this.db.prepare(
      'SELECT url FROM forged_requests WHERE site = ? AND method = ? AND post_data = \'\' AND substr(url, 1, ?) = ?',
    ).all(site, method, prefix.length, prefix) as { url: string }[]).map((r) => r.url);
  }

  record({ site, method, url, postData, response }: {
    site: string; method: string; url: string; postData?: string; response: ResponseLike;
  }): void {
    this.db.prepare(`
      INSERT INTO forged_requests (site, method, url, post_data, status, headers, body, content_type, forged_at)
      VALUES (@site, @method, @url, @postData, @status, @headers, @body, @contentType, @forgedAt)
      ON CONFLICT(site, method, url, post_data) DO UPDATE SET
        status = @status, headers = @headers, body = @body, content_type = @contentType, forged_at = @forgedAt
    `).run({
      site, method, url, postData: postData ?? '',
      status: response.status, headers: JSON.stringify(response.headers), body: response.body,
      contentType: response.contentType ?? null, forgedAt: new Date().toISOString(),
    });
  }
}
