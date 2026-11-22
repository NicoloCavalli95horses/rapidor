/**
 * Paper-support statistics, straight from storage/crawler.db — the numbers behind the evaluation
 * figures/tables of the write-up (Fig. 3 funnel, Fig. 4 identifier position, Table IV cost). It reads
 * the per-app rows of `analysis_stats` and the `vulnerabilities` table and prints:
 *
 *   1. a per-app table (one row per application) with every stored count + a derived cost split;
 *   2. a cross-app aggregate (mean / median / mode, plus min–max) for each metric, so the 17-app set
 *      can be summarized while still showing how the large apps (duolingo, busuu) weigh on the mean;
 *   3. the Fig. 4 breakdown: confirmed findings by mutated-segment position × value type.
 *
 * It also writes two CSVs under reports/ (per-app and the Fig. 4 matrix) for pgfplots. Read-only:
 * opens the DB read-only and writes nothing to it.
 *
 *   npm run paper-stats
 *   npm run paper-stats -- --db storage/crawler.db --out reports
 *
 * NOTE ON TP: the DB holds FLAGGED findings; "true positives" require the manual verification the
 * paper describes. This script reports over the flagged set and labels it as such — swap in a TP
 * filter once the manual labels exist.
 */
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AnalysisStatsStore, type AnalysisStatsRow } from '../src/db/AnalysisStatsStore';
import { normalizeUrl } from '../src/analysis/findings';
import { mean, median, mode } from '../src/utils/utils';
import { config } from '../src/config';

const { values: args } = parseArgs({ options: {
  db: { type: 'string', default: config.db.path },
  out: { type: 'string', default: 'reports' },
} });

const db = new Database(args.db!, { readonly: true });
const rows = new AnalysisStatsStore({ db, clearOnStart: false }).all();
if (!rows.length) { console.log(`No analysis_stats rows in ${args.db}.`); process.exit(0); }

// --- Derived cost split (Table IV). Waiting is dominated by the deterministic forge pacing: each
// forge sleeps timeBetweenRequestsMs, and maxConcurrentRequests of them run at once. The remainder of
// the measured analysis_ms (probe settle + network RTT) is attributed to compute. Approximate by
// construction — documented as such in the paper's cost section.
const rate = config.analysis.timeBetweenRequestsMs;
const forgeSlots = Math.max(1, config.analysis.maxConcurrentRequests);
const waitMs = (r: AnalysisStatsRow): number => Math.round((r.httpForged * rate) / forgeSlots);
const computeMs = (r: AnalysisStatsRow): number => Math.max(0, r.analysisMs - waitMs(r));

// --- 1. Per-application table ---
const perApp = rows.map((r) => ({
  site: r.site,
  http: r.httpEvents,
  httpUniq: r.httpEventsUnique,
  segments: r.segmentsExtracted,
  matches: r.matchesFound,
  cand: r.candidatesFound,
  forged: r.httpForged,
  probes: r.clientProbes,
  vHttp: r.vulnsHttp,
  vClient: r.vulnsClient,
  vuln: r.vulnerabilitiesFlagged,
  clickMean: round(r.clickablesPerStateMean),
  clickMed: round(r.clickablesPerStateMedian),
  explS: round(r.explorationMs / 1000),
  compS: round(computeMs(r) / 1000),
  waitS: round(waitMs(r) / 1000),
  anlS: round(r.analysisMs / 1000),
  infeasible: r.infeasible ? 'YES' : '',
}));
console.log(`${rows.length} application(s) from ${args.db}\n`);
console.table(perApp);

// --- 2. Cross-app aggregate (mean / median / mode / min–max) ---
// Each metric's per-app values are aggregated across the applications. For the within-app clickables
// distribution we aggregate the per-app MEANS and MEDIANS separately (both are stored per app).
const metrics: { label: string; values: number[] }[] = [
  { label: 'HTTP events', values: rows.map((r) => r.httpEvents) },
  { label: 'HTTP events (unique)', values: rows.map((r) => r.httpEventsUnique) },
  { label: 'URI segments', values: rows.map((r) => r.segmentsExtracted) },
  { label: 'Pre-index matches', values: rows.map((r) => r.matchesFound) },
  { label: 'Candidates', values: rows.map((r) => r.candidatesFound) },
  { label: 'HTTP forged', values: rows.map((r) => r.httpForged) },
  { label: 'Client probes', values: rows.map((r) => r.clientProbes) },
  { label: 'Forged+probes', values: rows.map((r) => r.requestsGenerated) },
  { label: 'Flagged (total)', values: rows.map((r) => r.vulnerabilitiesFlagged) },
  { label: 'Flagged (HTTP)', values: rows.map((r) => r.vulnsHttp) },
  { label: 'Flagged (client)', values: rows.map((r) => r.vulnsClient) },
  { label: 'Clickables/state (app mean)', values: rows.map((r) => r.clickablesPerStateMean) },
  { label: 'Clickables/state (app median)', values: rows.map((r) => r.clickablesPerStateMedian) },
  { label: 'Exploration (s)', values: rows.map((r) => r.explorationMs / 1000) },
  { label: 'Compute (s)', values: rows.map((r) => computeMs(r) / 1000) },
  { label: 'Wait (s)', values: rows.map((r) => waitMs(r) / 1000) },
  { label: 'Analysis (s)', values: rows.map((r) => r.analysisMs / 1000) },
];
console.log(`\nAcross the ${rows.length} applications (mean / median / mode / min–max — for Fig. 3 whiskers use median, min, max):`);
console.table(Object.fromEntries(metrics.map((m) => [m.label, {
  mean: round(mean(m.values)), median: round(median(m.values)), mode: round(mode(m.values)),
  min: round(Math.min(...m.values)), max: round(Math.max(...m.values)),
}])));

// --- 3. Fig. 4: mutated-identifier position × value type over the flagged findings ---
// segment_location/segment_index are recorded on new findings; for rows captured before that column
// existed, derive the position by diffing reference_url and candidate_url (the one part that changed).
type FindingRow = { reference_url: string; candidate_url: string; reference_value: string; segment_location: string | null; segment_index: number | null };
const hasPosCols = (db.prepare('PRAGMA table_info(vulnerabilities)').all() as { name: string }[]).some((c) => c.name === 'segment_location');
const findings = db.prepare(
  `SELECT reference_url, candidate_url, reference_value,
     ${hasPosCols ? 'segment_location' : 'NULL AS segment_location'}, ${hasPosCols ? 'segment_index' : 'NULL AS segment_index'}
   FROM vulnerabilities`,
).all() as FindingRow[];

const POS_BUCKETS = ['Index 0', 'Index 1', 'Index >=2', 'Query'] as const;
const TYPES = ['integer', 'uuid/hash', 'string/slug'] as const;
const matrix: Record<string, Record<string, number>> = Object.fromEntries(POS_BUCKETS.map((p) => [p, Object.fromEntries(TYPES.map((t) => [t, 0]))]));
for (const f of findings) {
  const pos = positionBucket(f);
  const type = valueType(f.reference_value);
  if (pos) matrix[pos][type]++;
}
console.log(`\nFig. 4 — mutated identifier position × value type over ${findings.length} flagged finding(s) (TP needs manual labels):`);
console.table(matrix);

// --- CSV output for the paper's plots ---
mkdirSync(args.out!, { recursive: true });
const perAppCsv = [Object.keys(perApp[0]).join(','), ...perApp.map((r) => Object.values(r).join(','))].join('\n');
writeFileSync(join(args.out!, 'paper_per_app.csv'), perAppCsv + '\n');
const matrixCsv = ['position,' + TYPES.join(','), ...POS_BUCKETS.map((p) => `${p},${TYPES.map((t) => matrix[p][t]).join(',')}`)].join('\n');
writeFileSync(join(args.out!, 'paper_id_location.csv'), matrixCsv + '\n');
console.log(`\nWrote ${join(args.out!, 'paper_per_app.csv')} and ${join(args.out!, 'paper_id_location.csv')}.`);

// --- helpers ---
function round(n: number): number { return Math.round(n * 100) / 100; }

/** integer (^\d+$) / uuid-or-hash (UUID or >=16 hex chars) / string-slug (anything else). */
function valueType(value: string): typeof TYPES[number] {
  if (/^\d+$/.test(value)) return 'integer';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{16,}$/i.test(value)) return 'uuid/hash';
  return 'string/slug';
}

/** The Fig. 4 bucket for a finding: prefer the stored position, else derive it from the two URLs. */
function positionBucket(f: FindingRow): typeof POS_BUCKETS[number] | null {
  let location = f.segment_location;
  let index = f.segment_index;
  if (location == null) { const d = deriveSegmentPosition(f.reference_url, f.candidate_url); location = d.location; index = d.index; }
  if (location === 'query') return 'Query';
  if (location === 'path' && index != null) return index === 0 ? 'Index 0' : index === 1 ? 'Index 1' : 'Index >=2';
  return null;
}

/**
 * Fallback for findings stored before the position columns existed: find the single part that differs
 * between the reference and candidate URLs. A differing query param -> 'query'; otherwise the differing
 * path segment, as an index from the right (last = 0). URLs are canonicalized first (volatile tokens).
 */
function deriveSegmentPosition(referenceUrl: string, candidateUrl: string): { location: 'path' | 'query' | null; index: number | null } {
  try {
    const a = new URL(normalizeUrl(referenceUrl));
    const b = new URL(normalizeUrl(candidateUrl));
    for (const [k, v] of a.searchParams) if (b.searchParams.get(k) !== v) return { location: 'query', index: null };
    const as = a.pathname.split('/').filter(Boolean);
    const bs = b.pathname.split('/').filter(Boolean);
    if (as.length === bs.length) {
      for (let i = as.length - 1; i >= 0; i--) {
        if (stripExt(as[i]) !== stripExt(bs[i])) return { location: 'path', index: as.length - 1 - i };
      }
    }
  } catch { /* fall through */ }
  return { location: null, index: null };
}
function stripExt(s: string): string { const dot = s.lastIndexOf('.'); return dot > 0 ? s.slice(0, dot) : s; }
