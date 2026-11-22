import type Database from 'better-sqlite3';
import type { StateRecord } from '../core/types';

export interface CrawlStateStoreOptions {
  db: Database.Database;   // shared connection (opened once per crawler run via openDatabase)
  clearOnStart: boolean;   // wipe crawl_states once, at construction
}

/**
 * The exploration's own output (one row per distinct UI state), replacing the old states.json: a
 * state is keyed by (site, id) since fingerprints are only unique within a site. Screenshots, when
 * enabled, are stored as a BLOB column rather than a separate PNG file.
 */
export class CrawlStateStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: CrawlStateStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crawl_states (
        site TEXT NOT NULL,
        id TEXT NOT NULL,
        url TEXT NOT NULL,
        depth INTEGER NOT NULL,
        path TEXT NOT NULL,
        clickables TEXT NOT NULL,
        texts TEXT NOT NULL,
        screenshot BLOB,
        created_at TEXT NOT NULL,
        PRIMARY KEY (site, id)
      )
    `);
    if (clearOnStart) this.db.exec('DELETE FROM crawl_states');
  }

  /** Removes every row for one site: used to overwrite a single domain's previous run without touching the others. */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM crawl_states WHERE site = ?').run(site);
  }

  has(site: string, id: string): boolean {
    return this.db.prepare('SELECT 1 FROM crawl_states WHERE site = ? AND id = ?').get(site, id) !== undefined;
  }

  count(site: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM crawl_states WHERE site = ?').get(site) as { n: number };
    return row.n;
  }

  /**
   * Number of clickable elements captured in each state of `site` (one entry per state). Fed to the
   * per-app mean/median the paper reports on UI complexity — computed from the stored `clickables`
   * JSON array via SQLite's json_array_length, so no row is materialized.
   */
  clickableCountsBySite(site: string): number[] {
    const rows = this.db.prepare(
      'SELECT json_array_length(clickables) AS n FROM crawl_states WHERE site = ?',
    ).all(site) as { n: number }[];
    return rows.map((r) => r.n);
  }

  /** All states for a site, for inspection (tests, future tooling): parsed back into a StateRecord. */
  listBySite(site: string): (StateRecord & { hasScreenshot: boolean })[] {
    const rows = this.db.prepare('SELECT * FROM crawl_states WHERE site = ? ORDER BY id ASC').all(site) as {
      id: string; url: string; depth: number; path: string; clickables: string; texts: string; screenshot: Buffer | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      depth: r.depth,
      path: JSON.parse(r.path),
      clickables: JSON.parse(r.clickables),
      texts: JSON.parse(r.texts),
      hasScreenshot: r.screenshot !== null,
    }));
  }

  record({ site, record, screenshot }: { site: string; record: StateRecord; screenshot?: Buffer }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO crawl_states (site, id, url, depth, path, clickables, texts, screenshot, created_at)
      VALUES (@site, @id, @url, @depth, @path, @clickables, @texts, @screenshot, @createdAt)
    `).run({
      site,
      id: record.id,
      url: record.url,
      depth: record.depth,
      path: JSON.stringify(record.path),
      clickables: JSON.stringify(record.clickables),
      texts: JSON.stringify(record.texts),
      screenshot: screenshot ?? null,
      createdAt: new Date().toISOString(),
    });
  }
}
