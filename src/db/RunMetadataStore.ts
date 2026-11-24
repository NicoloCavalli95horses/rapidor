import type Database from 'better-sqlite3';
import type { ExplorationStopReason } from '../core/types';

export interface RunMetadataRow {
  site: string;
  startUrl: string;             // the seed exactly as given (START_URL/START_URLS), before redirects
  startedAt: string;            // ISO, exploration start
  endedAt: string;              // ISO, exploration end (the end-of-crawl analysis starts right after)
  explorationMs: number;
  stopReason: ExplorationStopReason;
  config: string;               // effective CrawlConfig as JSON (env overrides applied), see runConfigSnapshot
  // No code revision on purpose: the DB is published alongside an ANONYMOUS repository for peer review.
}

export interface RunMetadataStoreOptions {
  db: Database.Database;
  clearOnStart: boolean;
}

/**
 * One row per site describing HOW its crawl data was produced: when, from which seed, with which effective
 * config, and why the exploration stopped (a truncated crawl reads differently from a complete one).
 * Written at the end of the exploration (RunMetadataHooks); a re-crawl replaces it.
 */
export class RunMetadataStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: RunMetadataStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS run_metadata (
        site TEXT PRIMARY KEY,
        start_url TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        exploration_ms INTEGER NOT NULL,
        stop_reason TEXT NOT NULL,
        config TEXT NOT NULL
      )
    `);
    if (clearOnStart) this.db.exec('DELETE FROM run_metadata');
  }

  record(row: RunMetadataRow): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO run_metadata (site, start_url, started_at, ended_at, exploration_ms, stop_reason, config)
      VALUES (@site, @startUrl, @startedAt, @endedAt, @explorationMs, @stopReason, @config)
    `).run(row);
  }

  get({ site }: { site: string }): RunMetadataRow | undefined {
    return this.db.prepare(`
      SELECT site, start_url AS startUrl, started_at AS startedAt, ended_at AS endedAt, exploration_ms AS explorationMs,
             stop_reason AS stopReason, config
      FROM run_metadata WHERE site = ?
    `).get(site) as RunMetadataRow | undefined;
  }

  /** Removes one site's row: used to overwrite a single domain's previous run without touching the others. */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM run_metadata WHERE site = ?').run(site);
  }
}
