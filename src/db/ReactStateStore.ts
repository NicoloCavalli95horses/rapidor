import type Database from 'better-sqlite3';

/** Loose on purpose: the graph's shape is owned by RAPIDOR, not the crawler. */
export interface RapidorGraph {
  fingerprint: string;
  nodes?: Record<string, { id: string; componentId?: number; key?: unknown; tag?: number; name?: string; props?: unknown }>;
  relations?: Record<string, unknown>;
  componentIndex?: Record<string, string[]>;
  [key: string]: unknown;
}

export interface ReactStateStoreOptions {
  db: Database.Database;   // shared connection (opened once per crawler run via openDatabase)
  clearOnStart: boolean;   // wipe react_states once, at construction
}

/**
 * Deduplicated persistence for React state graphs captured via window.__RAPIDOR__getLatestState,
 * keyed by the exact URL (including query params) they were observed at, so the same shape at two
 * different URLs is kept twice while a repeat at the same URL just bumps seen_count.
 */
export class ReactStateStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: ReactStateStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS react_states (
        id INTEGER PRIMARY KEY,
        site TEXT NOT NULL,
        url TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        graph TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        seen_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(url, fingerprint)
      )
    `);
    if (clearOnStart) this.db.exec('DELETE FROM react_states');
  }

  /** Removes every row for one site: used to overwrite a single domain's previous run without touching the others. */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM react_states WHERE site = ?').run(site);
  }

  /**
   * No-ops (returns undefined) when `graph` has no fingerprint: nothing usable to dedupe/store
   * (extension absent or not yet settled). Otherwise returns the row's id, via RETURNING, so a
   * caller (ReactStateHooks) can (re)index it without a separate lookup.
   *
   * On a repeat (same url, same RAPIDOR fingerprint — e.g. StateNavigator.restore() remounting the
   * same route while backtracking the DFS), `graph`/`captured_at` are overwritten too, not just
   * `seen_count` bumped: the fingerprint is RAPIDOR's own structural hash of the component tree, so
   * two captures that share it can still carry different data (a page whose siblings/props finished
   * loading later, a cache warming up, ...). PreindexedValueStore.reindex() is always called by the
   * caller with this same fresh `graph`, replacing that state's indexed rows every time regardless
   * of whether this was a fresh insert or a repeat — so if the stored graph here stayed frozen at
   * the first capture, a later reindex would point AnalysisPipeline.findUrlCandidates' getById(id)
   * read at a stale, mismatched node graph (even referencing nodeIds that don't exist in it, since
   * every remount gets fresh RAPIDOR-assigned ids), silently losing whatever that later, possibly
   * more complete, capture actually saw. Always keeping the latest graph guarantees the opposite:
   * redundant captures are harmless, never a source of lost coverage.
   */
  record({ site, url, graph }: { site: string; url: string; graph: RapidorGraph | null | undefined }): number | undefined {
    if (!graph?.fingerprint) return undefined;
    const row = this.db.prepare(`
      INSERT INTO react_states (site, url, fingerprint, graph, captured_at)
      VALUES (@site, @url, @fingerprint, @graph, @capturedAt)
      ON CONFLICT(url, fingerprint) DO UPDATE SET
        seen_count = seen_count + 1, graph = @graph, captured_at = @capturedAt
      RETURNING id
    `).get({
      site, url, fingerprint: graph.fingerprint, graph: JSON.stringify(graph), capturedAt: new Date().toISOString(),
    }) as { id: number } | undefined;
    return row?.id;
  }

  getById(stateId: number): RapidorGraph | undefined {
    const row = this.db.prepare('SELECT graph FROM react_states WHERE id = ?').get(stateId) as { graph: string } | undefined;
    return row ? (JSON.parse(row.graph) as RapidorGraph) : undefined;
  }

  count(url?: string): number {
    const row = url
      ? this.db.prepare('SELECT COUNT(*) AS n FROM react_states WHERE url = ?').get(url)
      : this.db.prepare('SELECT COUNT(*) AS n FROM react_states').get();
    return (row as { n: number }).n;
  }

  countBySite(site: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM react_states WHERE site = ?').get(site) as { n: number }).n;
  }

  /**
   * Every distinct URL a React state was captured at, for this site: the crawler's own page
   * navigations/client-side route changes, as opposed to httpEventStore's server requests. Lets
   * AnalysisPipeline seed candidates from query params the SPA only ever reads itself (never sent
   * to the backend), which would otherwise never be extracted at all.
   */
  listUrlsBySite(site: string): string[] {
    const rows = this.db.prepare('SELECT DISTINCT url FROM react_states WHERE site = ?').all(site) as { url: string }[];
    return rows.map((r) => r.url);
  }

  /**
   * The structural fingerprints captured at one exact URL for a site — the seed set of the entry-point
   * auth-freshness gate (checkEntryPointFresh). Exact-URL match: the crawl stores the entry state under
   * START_URL verbatim, and an authenticated internal page's structure is what the gate compares against.
   */
  fingerprintsForUrl({ site, url }: { site: string; url: string }): string[] {
    const rows = this.db.prepare('SELECT DISTINCT fingerprint FROM react_states WHERE site = ? AND url = ?')
      .all(site, url) as { fingerprint: string }[];
    return rows.map((r) => r.fingerprint);
  }

  /**
   * Streams every captured React graph for a site one row at a time (never materialising them all at
   * once — a site can hold a few hundred, each a non-trivial component tree). Used to build the
   * client-routing novelty corpus (reactContentKey of each already-collected state) with bounded memory,
   * the React analog of HttpEventStore.forEachResponse.
   */
  forEachGraphBySite({ site, onGraph }: { site: string; onGraph: (graph: RapidorGraph) => void }): void {
    const stmt = this.db.prepare('SELECT graph FROM react_states WHERE site = ? ORDER BY id ASC');
    for (const r of stmt.iterate(site) as IterableIterator<{ graph: string }>) {
      try { onGraph(JSON.parse(r.graph) as RapidorGraph); } catch { /* a malformed stored graph is skipped, not fatal */ }
    }
  }
}
