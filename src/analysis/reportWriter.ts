import { mkdirSync, writeFileSync, renameSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { log } from 'crawlee';
import type { ReportRow } from '../db/VulnerabilityStore';
import type { FindingEvidence, StoredAuthz, ReproductionKind } from './reportEvidence';
import { renderReportMarkdown } from './reportMarkdown';
import { renderReportTest } from './reportTest';

/**
 * Writes a site's findings as self-contained folders and REPLACES the site's previous reports in one
 * atomic swap, so reports/<site>/ always mirrors the current DB (a now-rejected finding's folder simply
 * disappears) and an interrupted run never leaves a half-written tree. Each finding gets one subfolder
 * reports/<site>/<slug>/ holding report.md (the human-readable write-up), test.ts (the executable
 * oracle) and evidence.json (the regeneration payload); the test writes its screenshots into assets/.
 *
 * Shared by the end-of-run hook (AnalysisPipeline) and scripts/regenerateReports.ts: both call
 * writeSiteReports with the rows from VulnerabilityStore.listReportRows. A row with no `evidence`
 * (stored before that column existed, not yet backfilled) CANNOT be regenerated and is skipped — and if
 * NO row for the site has evidence, the swap is declined entirely so the existing folder is never wiped
 * to nothing (run scripts/backfillEvidence.ts first).
 */

export interface SiteReportResult {
  site: string;
  written: number;
  skipped: { id: string; reason: string }[];
  replaced: boolean;
}

/** Short, stable, filesystem-safe folder name for one finding: detection kind + a 12-char id prefix (idempotent across runs). */
function findingSlug({ row, kind }: { row: ReportRow; kind: ReproductionKind }): string {
  const typeSlug = kind.type === 'http' ? 'http' : kind.type === 'client-routing-query' ? 'client-query' : 'client-path';
  return `${typeSlug}_${row.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
}

function siteSlug(site: string): string {
  return site.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Removes report folders under `reportsDir` that no longer correspond to a current finding site, so a
 * site whose findings all disappeared (or that is no longer analysed) does not leave a stale tree
 * behind. Only DIRECTORIES are removed, and only those not in `keepSites`; top-level files (e.g. the
 * paper CSVs) and any transient `.tmp`/`.old` entry are left untouched. Returns the removed folder names.
 */
export function pruneStaleSiteReports({ reportsDir, keepSites }: { reportsDir: string; keepSites: string[] }): string[] {
  if (!existsSync(reportsDir)) return [];
  const keep = new Set(keepSites.map(siteSlug));
  const removed: string[] = [];
  for (const entry of readdirSync(reportsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;   // skip files and transient .tmp/.old dirs
    if (keep.has(entry.name)) continue;
    rmSync(join(reportsDir, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
}

/** Builds one finding's folder under `parentDir`. Returns the slug used, or throws (the caller aborts the whole site). */
function writeFinding({ parentDir, row, seedUrl }: { parentDir: string; row: ReportRow; seedUrl?: string }): string {
  const evidence = row.evidence as FindingEvidence;
  const authz = (row.authzDiff as StoredAuthz) ?? { isAuthzRelevant: false, differences: [], sensitiveKeys: [] };
  const slug = findingSlug({ row, kind: evidence.kind });
  const dir = join(parentDir, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.md'), renderReportMarkdown({ row, evidence, authz, seedUrl }));
  writeFileSync(join(dir, 'test.ts'), renderReportTest({ row, evidence }));
  writeFileSync(join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  return slug;
}

/**
 * Regenerates every report for `site` and atomically replaces reports/<site>/. Never throws: a failure
 * is logged and leaves the existing folder untouched (returns replaced:false).
 */
export function writeSiteReports({ reportsDir, site, rows, seedUrl }: { reportsDir: string; site: string; rows: ReportRow[]; seedUrl?: string }): SiteReportResult {
  const skipped: { id: string; reason: string }[] = [];
  const writable = rows.filter((r) => {
    if (r.evidence === undefined) { skipped.push({ id: r.id, reason: 'no evidence payload (run backfillEvidence.ts)' }); return false; }
    return true;
  });

  const finalDir = join(reportsDir, siteSlug(site));
  // Never wipe an existing folder to nothing: if the site has findings but none can be regenerated, keep
  // whatever is on disk and tell the caller to backfill first.
  if (writable.length === 0) {
    if (rows.length > 0) log.warning(`writeSiteReports: ${site} — ${rows.length} finding(s) but none has an evidence payload; folder left untouched (run scripts/backfillEvidence.ts)`);
    return { site, written: 0, skipped, replaced: false };
  }

  const tmpDir = join(reportsDir, `.${siteSlug(site)}.tmp-${process.pid}-${Date.now()}`);
  const oldDir = `${finalDir}.old-${process.pid}-${Date.now()}`;
  try {
    mkdirSync(tmpDir, { recursive: true });
    for (const row of writable) writeFinding({ parentDir: tmpDir, row, seedUrl });
    // Atomic-ish swap: stash the old tree aside, move the new one in, then drop the old. A rename within
    // one filesystem is atomic; moving the old out first avoids ENOTEMPTY on renaming onto a non-empty dir.
    const hadOld = existsSync(finalDir);
    if (hadOld) renameSync(finalDir, oldDir);
    try {
      renameSync(tmpDir, finalDir);
    } catch (err) {
      if (hadOld) renameSync(oldDir, finalDir);   // put the previous reports back on failure
      throw err;
    }
    if (hadOld) rmSync(oldDir, { recursive: true, force: true });
    return { site, written: writable.length, skipped, replaced: true };
  } catch (err) {
    rmSync(tmpDir, { recursive: true, force: true });
    log.warning(`writeSiteReports: ${site} failed, existing reports kept: ${(err as Error).message}`);
    return { site, written: 0, skipped, replaced: false };
  }
}
