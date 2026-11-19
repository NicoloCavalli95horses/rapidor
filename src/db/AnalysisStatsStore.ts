import type Database from 'better-sqlite3';

export interface AnalysisStatsRow {
  site: string;
  httpEvents: number;           // distinct same-site requests captured (http_events for this site)
  segmentsExtracted: number;    // URL path/query segments proposed as swap candidates
  reactStates: number;          // distinct React states captured (react_states for this site)
  matchesFound: number;         // preindexed-value hits for those segments
  candidatesFound: number;      // alternative component instances proposed from those matches
  requestsGenerated: number;    // forged requests actually dispatched
  vulnerabilitiesFlagged: number;   // rows written to `vulnerabilities` for this site
  explorationMs: number;        // wall-clock time DfsExplorer spent clicking around (before AnalysisPipeline ever runs)
  analysisMs: number;           // wall-clock time this very runForSite() call took, start to finish
  infeasible?: boolean;         // true: candidate generation exceeded maxGeneratedRequests, the site was abandoned (nothing dispatched, requestsGenerated is the over-budget count)
}

export interface AnalysisStatsStoreOptions {
  db: Database.Database;   // shared connection (opened once per crawler run via openDatabase)
  clearOnStart: boolean;   // wipe analysis_stats once, at construction
}

/**
 * One consolidated row per site with every number the user wants averaged across a run, so a
 * `SELECT AVG(...) FROM analysis_stats` is enough — no need to join http_events/react_states/
 * vulnerabilities separately just to compute an average.
 */
export class AnalysisStatsStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: AnalysisStatsStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_stats (
        site TEXT PRIMARY KEY,
        http_events INTEGER NOT NULL,
        segments_extracted INTEGER NOT NULL,
        react_states INTEGER NOT NULL,
        matches_found INTEGER NOT NULL,
        candidates_found INTEGER NOT NULL,
        requests_generated INTEGER NOT NULL,
        vulnerabilities_flagged INTEGER NOT NULL
      )
    `);
    // tables created before timing was tracked
    const columns = (this.db.prepare('PRAGMA table_info(analysis_stats)').all() as { name: string }[]).map((c) => c.name);
    if (!columns.includes('exploration_ms')) this.db.exec('ALTER TABLE analysis_stats ADD COLUMN exploration_ms INTEGER NOT NULL DEFAULT 0');
    if (!columns.includes('analysis_ms')) this.db.exec('ALTER TABLE analysis_stats ADD COLUMN analysis_ms INTEGER NOT NULL DEFAULT 0');
    // Skip the one-time migration on a read-only connection (e.g. `npm run stats`): a DB opened for
    // reading can't be ALTERed, and all() below reads `infeasible` defensively when the column is absent.
    if (!this.db.readonly && !columns.includes('infeasible')) this.db.exec('ALTER TABLE analysis_stats ADD COLUMN infeasible INTEGER NOT NULL DEFAULT 0');
    if (clearOnStart) this.db.exec('DELETE FROM analysis_stats');
  }

  /** Removes every row for one site: used to overwrite a single domain's previous run without touching the others. */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM analysis_stats WHERE site = ?').run(site);
  }

  record(row: AnalysisStatsRow): void {
    this.db.prepare(`
      INSERT INTO analysis_stats (
        site, http_events, segments_extracted, react_states, matches_found, candidates_found, requests_generated, vulnerabilities_flagged,
        exploration_ms, analysis_ms, infeasible
      ) VALUES (
        @site, @httpEvents, @segmentsExtracted, @reactStates, @matchesFound, @candidatesFound, @requestsGenerated, @vulnerabilitiesFlagged,
        @explorationMs, @analysisMs, @infeasible
      )
      ON CONFLICT(site) DO UPDATE SET
        http_events = @httpEvents, segments_extracted = @segmentsExtracted, react_states = @reactStates,
        matches_found = @matchesFound, candidates_found = @candidatesFound,
        requests_generated = @requestsGenerated, vulnerabilities_flagged = @vulnerabilitiesFlagged,
        exploration_ms = @explorationMs, analysis_ms = @analysisMs, infeasible = @infeasible
    `).run({ ...row, infeasible: row.infeasible ? 1 : 0 });
  }

  all(): AnalysisStatsRow[] {
    // `infeasible` may be absent on an older DB opened read-only (migration skipped above): default it.
    const hasInfeasible = (this.db.prepare('PRAGMA table_info(analysis_stats)').all() as { name: string }[]).some((c) => c.name === 'infeasible');
    const rows = this.db.prepare(`
      SELECT site, http_events, segments_extracted, react_states, matches_found, candidates_found, requests_generated, vulnerabilities_flagged,
        exploration_ms, analysis_ms, ${hasInfeasible ? 'infeasible' : '0 AS infeasible'}
      FROM analysis_stats ORDER BY site ASC
    `).all() as {
      site: string; http_events: number; segments_extracted: number; react_states: number;
      matches_found: number; candidates_found: number; requests_generated: number; vulnerabilities_flagged: number;
      exploration_ms: number; analysis_ms: number; infeasible: number;
    }[];
    return rows.map((r) => ({
      site: r.site, httpEvents: r.http_events, segmentsExtracted: r.segments_extracted, reactStates: r.react_states,
      matchesFound: r.matches_found, candidatesFound: r.candidates_found,
      requestsGenerated: r.requests_generated, vulnerabilitiesFlagged: r.vulnerabilities_flagged,
      explorationMs: r.exploration_ms, analysisMs: r.analysis_ms, infeasible: r.infeasible === 1,
    }));
  }
}
