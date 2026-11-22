import type Database from 'better-sqlite3';

export interface AnalysisStatsRow {
  site: string;
  httpEvents: number;           // same-site requests captured (http_events rows for this site: includes re-fires)
  httpEventsUnique: number;     // distinct (method + canonical URL) among those — the paper's "HTTP events" input
  segmentsExtracted: number;    // URL path/query segments proposed as swap candidates
  reactStates: number;          // distinct React states captured (react_states for this site)
  matchesFound: number;         // preindexed-value hits for those segments
  candidatesFound: number;      // alternative component instances proposed from those matches
  requestsGenerated: number;    // candidate tasks dispatched (httpForged + clientProbes)
  httpForged: number;           // of those, HTTP GET forges (detection path 'http')
  clientProbes: number;         // of those, client-routing probes (detection path 'client-routing')
  vulnerabilitiesFlagged: number;   // rows written to `vulnerabilities` for this site
  vulnsHttp: number;            // of those, found by the HTTP forge
  vulnsClient: number;          // of those, found by the client-routing probe
  clickablesPerStateMean: number;   // mean clickable elements per captured UI state (app's GUI complexity)
  clickablesPerStateMedian: number; // median of the same, to weigh large apps (duolingo/busuu) against the set
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
    // tables created before a column existed: add it on the fly. Skipped on a read-only connection
    // (e.g. `npm run stats` / paperStats): a DB opened for reading can't be ALTERed, and all() below
    // reads every added column defensively (COALESCE / "0 AS …") when it is absent.
    const columns = (this.db.prepare('PRAGMA table_info(analysis_stats)').all() as { name: string }[]).map((c) => c.name);
    const addColumn = (name: string, ddl: string): void => {
      if (!this.db.readonly && !columns.includes(name)) this.db.exec(`ALTER TABLE analysis_stats ADD COLUMN ${ddl}`);
    };
    addColumn('exploration_ms', 'exploration_ms INTEGER NOT NULL DEFAULT 0');
    addColumn('analysis_ms', 'analysis_ms INTEGER NOT NULL DEFAULT 0');
    addColumn('infeasible', 'infeasible INTEGER NOT NULL DEFAULT 0');
    // paper-support columns (per-app): split counts, per-class findings, UI complexity
    addColumn('http_events_unique', 'http_events_unique INTEGER NOT NULL DEFAULT 0');
    addColumn('http_forged', 'http_forged INTEGER NOT NULL DEFAULT 0');
    addColumn('client_probes', 'client_probes INTEGER NOT NULL DEFAULT 0');
    addColumn('vulns_http', 'vulns_http INTEGER NOT NULL DEFAULT 0');
    addColumn('vulns_client', 'vulns_client INTEGER NOT NULL DEFAULT 0');
    addColumn('clickables_per_state_mean', 'clickables_per_state_mean REAL NOT NULL DEFAULT 0');
    addColumn('clickables_per_state_median', 'clickables_per_state_median REAL NOT NULL DEFAULT 0');
    if (clearOnStart) this.db.exec('DELETE FROM analysis_stats');
  }

  /** Removes every row for one site: used to overwrite a single domain's previous run without touching the others. */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM analysis_stats WHERE site = ?').run(site);
  }

  record(row: AnalysisStatsRow): void {
    this.db.prepare(`
      INSERT INTO analysis_stats (
        site, http_events, http_events_unique, segments_extracted, react_states, matches_found, candidates_found,
        requests_generated, http_forged, client_probes, vulnerabilities_flagged, vulns_http, vulns_client,
        clickables_per_state_mean, clickables_per_state_median, exploration_ms, analysis_ms, infeasible
      ) VALUES (
        @site, @httpEvents, @httpEventsUnique, @segmentsExtracted, @reactStates, @matchesFound, @candidatesFound,
        @requestsGenerated, @httpForged, @clientProbes, @vulnerabilitiesFlagged, @vulnsHttp, @vulnsClient,
        @clickablesPerStateMean, @clickablesPerStateMedian, @explorationMs, @analysisMs, @infeasible
      )
      ON CONFLICT(site) DO UPDATE SET
        http_events = @httpEvents, http_events_unique = @httpEventsUnique, segments_extracted = @segmentsExtracted,
        react_states = @reactStates, matches_found = @matchesFound, candidates_found = @candidatesFound,
        requests_generated = @requestsGenerated, http_forged = @httpForged, client_probes = @clientProbes,
        vulnerabilities_flagged = @vulnerabilitiesFlagged, vulns_http = @vulnsHttp, vulns_client = @vulnsClient,
        clickables_per_state_mean = @clickablesPerStateMean, clickables_per_state_median = @clickablesPerStateMedian,
        -- exploration_ms belongs to the CRAWL, not the analysis: a re-analysis of already-captured data
        -- (runAnalysisFromDb passes explorationMs:0, it never explores) must NOT wipe the crawl's real
        -- exploration time. Keep the stored value whenever the incoming one is 0 (a genuine crawl is >0).
        exploration_ms = CASE WHEN @explorationMs > 0 THEN @explorationMs ELSE exploration_ms END,
        analysis_ms = @analysisMs, infeasible = @infeasible
    `).run({ ...row, infeasible: row.infeasible ? 1 : 0 });
  }

  all(): AnalysisStatsRow[] {
    // Any column added by a later version may be absent on an older DB opened read-only (migration
    // skipped above): select it only when present, defaulting to 0 otherwise so older rows still read.
    const present = new Set((this.db.prepare('PRAGMA table_info(analysis_stats)').all() as { name: string }[]).map((c) => c.name));
    const col = (name: string): string => present.has(name) ? name : `0 AS ${name}`;
    const rows = this.db.prepare(`
      SELECT site, http_events, ${col('http_events_unique')}, segments_extracted, react_states, matches_found, candidates_found,
        requests_generated, ${col('http_forged')}, ${col('client_probes')}, vulnerabilities_flagged,
        ${col('vulns_http')}, ${col('vulns_client')}, ${col('clickables_per_state_mean')}, ${col('clickables_per_state_median')},
        exploration_ms, analysis_ms, ${col('infeasible')}
      FROM analysis_stats ORDER BY site ASC
    `).all() as {
      site: string; http_events: number; http_events_unique: number; segments_extracted: number; react_states: number;
      matches_found: number; candidates_found: number; requests_generated: number; http_forged: number; client_probes: number;
      vulnerabilities_flagged: number; vulns_http: number; vulns_client: number;
      clickables_per_state_mean: number; clickables_per_state_median: number;
      exploration_ms: number; analysis_ms: number; infeasible: number;
    }[];
    return rows.map((r) => ({
      site: r.site, httpEvents: r.http_events, httpEventsUnique: r.http_events_unique, segmentsExtracted: r.segments_extracted,
      reactStates: r.react_states, matchesFound: r.matches_found, candidatesFound: r.candidates_found,
      requestsGenerated: r.requests_generated, httpForged: r.http_forged, clientProbes: r.client_probes,
      vulnerabilitiesFlagged: r.vulnerabilities_flagged, vulnsHttp: r.vulns_http, vulnsClient: r.vulns_client,
      clickablesPerStateMean: r.clickables_per_state_mean, clickablesPerStateMedian: r.clickables_per_state_median,
      explorationMs: r.exploration_ms, analysisMs: r.analysis_ms, infeasible: r.infeasible === 1,
    }));
  }
}
