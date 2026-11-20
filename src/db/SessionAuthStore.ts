import type Database from 'better-sqlite3';
import type { AuthOverride } from '../analysis/authSession';

/**
 * Per-site refreshed auth material, captured at analysis time (t2) when the originally-captured (t1)
 * session had expired. Written by scripts/refreshAuth.ts after a manual re-login; read by
 * runAnalysisFromDb, which overlays it onto every forged request (see applyAuthOverride).
 *
 * Deliberately NOT wiped by clearOnStart (it takes no such flag): it mirrors the live browser profile's
 * session, which also survives a DB reset — wiping it would force a needless re-login on every run. One
 * row per site; refreshAuth overwrites it each time.
 */
export class SessionAuthStore {
  private db: Database.Database;

  constructor({ db }: { db: Database.Database }) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_auth (
        site TEXT PRIMARY KEY,
        headers TEXT NOT NULL,
        strip_cookie INTEGER NOT NULL,
        captured_at TEXT NOT NULL
      )
    `);
  }

  get({ site }: { site: string }): AuthOverride | undefined {
    const row = this.db.prepare('SELECT headers, strip_cookie AS stripCookie FROM session_auth WHERE site = ?')
      .get(site) as { headers: string; stripCookie: number } | undefined;
    if (!row) return undefined;
    return { stripCookie: !!row.stripCookie, freshHeaders: JSON.parse(row.headers) };
  }

  set({ site, override }: { site: string; override: AuthOverride }): void {
    this.db.prepare(`
      INSERT INTO session_auth (site, headers, strip_cookie, captured_at)
      VALUES (@site, @headers, @stripCookie, @capturedAt)
      ON CONFLICT(site) DO UPDATE SET headers = @headers, strip_cookie = @stripCookie, captured_at = @capturedAt
    `).run({
      site, headers: JSON.stringify(override.freshHeaders),
      stripCookie: override.stripCookie ? 1 : 0, capturedAt: new Date().toISOString(),
    });
  }

  clear({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM session_auth WHERE site = ?').run(site);
  }
}
