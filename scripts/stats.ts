/**
 * Prints crawl and analysis-pipeline statistics — straight from the single SQLite file every
 * store writes into — plus an AGGREGATED summary of the flagged vulnerabilities (counts by
 * site / detection method / distinct endpoint), NOT a dump of every flag. To inspect individual
 * findings, query the `vulnerabilities` table directly.
 *
 *   npm run stats
 *   npm run stats -- --db storage/crawler.db
 */
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';
import { AnalysisStatsStore, type AnalysisStatsRow } from '../src/db/AnalysisStatsStore';
import { CrawlStateStore } from '../src/db/CrawlStateStore';
import { CrawlEdgeStore } from '../src/db/CrawlEdgeStore';
import { config } from '../src/config';

const { values: args } = parseArgs({ options: { db: { type: 'string', default: config.db.path } } });

const NUMERIC_FIELDS = [
  'httpEvents', 'segmentsExtracted', 'reactStates', 'matchesFound', 'candidatesFound', 'requestsGenerated', 'vulnerabilitiesFlagged',
] as const satisfies readonly (keyof AnalysisStatsRow)[];

const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
const fmt = (n: number | null): string => (n === null ? '-' : String(n));

const db = new Database(args.db!, { readonly: true });
const rows = new AnalysisStatsStore({ db, clearOnStart: false }).all();
const crawlStates = new CrawlStateStore({ db, clearOnStart: false });
const crawlEdges = new CrawlEdgeStore({ db, clearOnStart: false });

console.log(`${rows.length} site(s) analysed, from ${args.db}`);
console.table(rows.map((r) => ({
  site: r.site,
  states: crawlStates.count(r.site),
  edges: crawlEdges.count(r.site),
  ...Object.fromEntries(NUMERIC_FIELDS.map((f) => [f, r[f]])),
})));

console.log('\nAverage per site (where available):');
console.table({
  states: fmt(mean(rows.map((r) => crawlStates.count(r.site)))),
  edges: fmt(mean(rows.map((r) => crawlEdges.count(r.site)))),
  ...Object.fromEntries(NUMERIC_FIELDS.map((f) => [f, fmt(mean(rows.map((r) => r[f])))])),
});

// --- Flagged vulnerabilities: aggregated only (counts, never the full list) ---
// We pivot by detection method and also report the number of DISTINCT reference endpoints per
// site: a handful of endpoints each exploding into many sibling candidates (the typical shape)
// reads very differently from many independent endpoints, and that distinction is what matters
// when triaging false positives — far more than a wall of individual rows ever did.
const perMethod = db.prepare(`
  SELECT site, COALESCE(detection_method, '?') AS det, COUNT(*) AS n
  FROM vulnerabilities GROUP BY site, det
`).all() as { site: string; det: string; n: number }[];

if (perMethod.length) {
  const methods = [...new Set(perMethod.map((r) => r.det))].sort();
  const refsBySite = new Map(
    (db.prepare(`SELECT site, COUNT(DISTINCT reference_url) AS refs FROM vulnerabilities GROUP BY site`)
      .all() as { site: string; refs: number }[]).map((r) => [r.site, r.refs]),
  );

  const bySite = new Map<string, Record<string, number>>();
  for (const { site, det, n } of perMethod) {
    const e = bySite.get(site) ?? {};
    e[det] = (e[det] ?? 0) + n;
    bySite.set(site, e);
  }

  const row = (site: string, counts: Record<string, number>, refs: number | string) => ({
    site,
    ...Object.fromEntries(methods.map((m) => [m, counts[m] ?? 0])),
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    endpoints: refs,
  });

  const summary = [...bySite.entries()]
    .map(([site, counts]) => row(site, counts, refsBySite.get(site) ?? 0))
    .sort((a, b) => b.total - a.total);

  const allCounts = Object.fromEntries(methods.map((m) => [m, perMethod.filter((r) => r.det === m).reduce((s, r) => s + r.n, 0)]));
  const totalRefs = (db.prepare(`SELECT COUNT(DISTINCT reference_url) AS refs FROM vulnerabilities`).get() as { refs: number }).refs;
  const total = summary.reduce((s, r) => s + r.total, 0);

  console.log(`\n${total} flagged vulnerabilit${total === 1 ? 'y' : 'ies'} across ${summary.length} site(s) — summary by detection method:`);
  console.table([...summary, row('ALL', allCounts, totalRefs)]);
} else {
  console.log('\nNo flagged vulnerabilities.');
}
