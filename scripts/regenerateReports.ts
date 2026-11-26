// Regenerates the human-readable reports and executable tests for findings ALREADY in the DB, WITHOUT
// re-crawling or re-analysing. Reads each site's stored findings (with their evidence payload) and
// rewrites reports/<site>/ in one atomic swap — one subfolder per finding holding report.md, test.ts and
// evidence.json. A finding with no evidence payload is skipped (run scripts/backfillEvidence.ts first).
// Writes nothing to the DB.
//
// Usage:
//   npx tsx scripts/regenerateReports.ts <START_URL>     # one site
//   npx tsx scripts/regenerateReports.ts --all           # every site with findings
import { log, LogLevel } from 'crawlee';
import { openDatabase } from '../src/db/openDatabase';
import { VulnerabilityStore } from '../src/db/VulnerabilityStore';
import { RunMetadataStore } from '../src/db/RunMetadataStore';
import { writeSiteReports, pruneStaleSiteReports } from '../src/analysis/reportWriter';
import { config } from '../src/config';

log.setLevel(process.env.LOG_LEVEL?.toLowerCase() === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

const args = process.argv.slice(2);
const all = args.includes('--all');
const startArg = args.find((a) => !a.startsWith('--'));
if (!all && !startArg) {
  console.error('Usage: npx tsx scripts/regenerateReports.ts <START_URL|--all>');
  process.exit(1);
}

const db = openDatabase({ path: config.db.path });
const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: false });
const runMetadataStore = new RunMetadataStore({ db, clearOnStart: false });

const sites = all ? vulnerabilityStore.sitesWithFindings() : [new URL(startArg!).hostname];
log.info(`regenerateReports: ${sites.length} site(s) -> ${config.analysis.reportsDir}/`);
let totWritten = 0, totSkipped = 0;
for (const site of sites) {
  const rows = vulnerabilityStore.listReportRows(site);
  const seedUrl = runMetadataStore.get({ site })?.startUrl;
  const result = writeSiteReports({ reportsDir: config.analysis.reportsDir, site, rows, seedUrl });
  totWritten += result.written; totSkipped += result.skipped.length;
  const status = result.replaced ? `wrote ${result.written}` : 'unchanged';
  log.info(`  ${site}: ${status}${result.skipped.length ? ` (${result.skipped.length} skipped: no evidence)` : ''}`);
  for (const s of result.skipped) log.info(`      SKIPPED ${s.id.slice(0, 12)} — ${s.reason}`);
}
// --all mirrors the DB exactly: drop any site folder left over from a finding that no longer exists
// (a removed site, or one whose findings were all rejected). Only in --all, so a single-site run never
// deletes another site's reports. Single-site cleanup is already handled by the per-site atomic swap.
if (all) {
  const removed = pruneStaleSiteReports({ reportsDir: config.analysis.reportsDir, keepSites: sites });
  if (removed.length > 0) log.info(`regenerateReports: pruned ${removed.length} stale site folder(s): ${removed.join(', ')}`);
}
log.info(`regenerateReports: total ${totWritten} written, ${totSkipped} skipped`);
process.exit(0);
