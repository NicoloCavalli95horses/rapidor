import { openDatabase } from './openDatabase';
import { HttpEventStore } from './HttpEventStore';
import { ReactStateStore } from './ReactStateStore';
import { PreindexedValueStore } from './PreindexedValueStore';
import { CrawlStateStore } from './CrawlStateStore';
import { ForgedRequestStore } from './ForgedRequestStore';
import { AuthzClassificationStore } from './AuthzClassificationStore';
import { VulnerabilityStore } from './VulnerabilityStore';
import { AnalysisStatsStore } from './AnalysisStatsStore';

export interface DemoExportResult {
  site: string;
  counts: Record<string, number>;   // rows copied into the demo, per table
  sourceHttpFindings: number;       // HTTP findings the source currently has for the site (what the demo should re-derive)
}

/**
 * Copies one site's HTTP-detection inputs from a full crawler DB into a small, self-contained demo DB,
 * so the offline demo analysis (AnalysisPipelineOptions.offline, see scripts/runDemo.ts) re-derives the
 * same findings deterministically without ever touching the network.
 *
 * Overwrites only the given site's rows in the destination (other sites already in the demo are kept),
 * so re-running it after a fresh crawl/analysis simply refreshes that site's snapshot.
 *
 * Copied: `http_events`, `react_states`, `preindexed_values` (via its `state_id` link to react_states),
 * `crawl_states`, `forged_requests` (the recorded live responses the offline forge replays), and
 * `authz_classifications` (global, a pure function of the key string — copied whole). Deliberately NOT
 * copied: `vulnerabilities`/`analysis_stats` (the demo regenerates those when it runs) and anything the
 * client-routing phase needs (the demo is HTTP-only — see demo/README.md). The destination's own
 * `vulnerabilities`/`analysis_stats` tables are created (empty) so the offline run has somewhere to write.
 */
export function exportSiteToDemoDb({ sourceDbPath, destDbPath, site }: {
  sourceDbPath: string; destDbPath: string; site: string;
}): DemoExportResult {
  if (sourceDbPath === destDbPath) throw new Error('exportSiteToDemoDb: source and destination must differ');

  const db = openDatabase({ path: destDbPath });
  // Create every table the demo needs, reusing each store's own `CREATE TABLE IF NOT EXISTS` DDL so the
  // schema can never drift from the real one. clearOnStart:false — we only add/replace the site's rows.
  new HttpEventStore({ db, clearOnStart: false });
  new ReactStateStore({ db, clearOnStart: false });
  new PreindexedValueStore({ db, clearOnStart: false });
  new CrawlStateStore({ db, clearOnStart: false });
  new ForgedRequestStore({ db, clearOnStart: false });
  new AuthzClassificationStore({ db, clearOnStart: false });
  new VulnerabilityStore({ db, clearOnStart: false });     // written by the offline run, created here
  new AnalysisStatsStore({ db, clearOnStart: false });     // written by the offline run, created here

  // ATTACH the source read-only: a just-finished (or concurrent, WAL) crawl writing it is never disturbed.
  db.prepare("ATTACH DATABASE ? AS src").run(sourceDbPath);
  try {
    const copy = db.transaction(() => {
      // Clear this site's existing rows first (preindexed_values before react_states, since it is
      // filtered through react_states' ids — same ordering as PreindexedValueStore.clearSite).
      db.prepare('DELETE FROM preindexed_values WHERE state_id IN (SELECT id FROM react_states WHERE site = ?)').run(site);
      db.prepare('DELETE FROM http_events WHERE site = ?').run(site);
      db.prepare('DELETE FROM react_states WHERE site = ?').run(site);
      db.prepare('DELETE FROM crawl_states WHERE site = ?').run(site);
      db.prepare('DELETE FROM forged_requests WHERE site = ?').run(site);

      // react_states first: its autoincrement ids are preserved (SELECT *), so preindexed_values.state_id
      // keeps pointing at the right rows.
      db.prepare('INSERT INTO react_states SELECT * FROM src.react_states WHERE site = ?').run(site);
      db.prepare('INSERT INTO http_events SELECT * FROM src.http_events WHERE site = ?').run(site);
      db.prepare('INSERT INTO preindexed_values SELECT * FROM src.preindexed_values WHERE state_id IN (SELECT id FROM src.react_states WHERE site = ?)').run(site);
      db.prepare('INSERT INTO crawl_states SELECT * FROM src.crawl_states WHERE site = ?').run(site);
      db.prepare('INSERT INTO forged_requests SELECT * FROM src.forged_requests WHERE site = ?').run(site);
      // Global classifier cache: a pure function of the key string, independent of site/run. Copied whole
      // (small), OR IGNORE so re-running never duplicates or overwrites existing rows.
      db.prepare('INSERT OR IGNORE INTO authz_classifications SELECT * FROM src.authz_classifications').run();
    });
    copy();

    const countSite = (table: string): number =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE site = ?`).get(site) as { n: number }).n;
    const counts: Record<string, number> = {
      http_events: countSite('http_events'),
      react_states: countSite('react_states'),
      preindexed_values: (db.prepare('SELECT COUNT(*) AS n FROM preindexed_values WHERE state_id IN (SELECT id FROM react_states WHERE site = ?)').get(site) as { n: number }).n,
      crawl_states: countSite('crawl_states'),
      forged_requests: countSite('forged_requests'),
      authz_classifications: (db.prepare('SELECT COUNT(*) AS n FROM authz_classifications').get() as { n: number }).n,
    };
    const sourceHttpFindings = (db.prepare(
      "SELECT COUNT(*) AS n FROM src.vulnerabilities WHERE site = ? AND detection_method = 'http'",
    ).get(site) as { n: number }).n;

    return { site, counts, sourceHttpFindings };
  } finally {
    db.exec('DETACH DATABASE src');
    db.close();
  }
}
