// Re-examines ONLY the findings already stored in `vulnerabilities` for one site with the CURRENT
// analysis engine (AnalysisPipeline.recheckFindings): forged response vs original for http findings
// (from the forged_requests cache), probe + DOM content guards for client-routing ones. Prints, per
// finding, whether it would still be flagged and, if not, which guard drops it.
//
// A targeted regression check for a change to the decision logic: minutes instead of a full
// runAnalysisFromDb pass (which regenerates and probes every candidate of the site). It writes
// NOTHING — no vulnerabilities, no stats, no reports — so the stored findings stay the baseline and
// the check can be re-run as often as needed. It cannot find NEW findings (or a real finding that a
// change would newly reject but that was never flagged): for that, runAnalysisFromDb is still needed.
//
// Usage:
//   npx tsx scripts/recheckFindings.ts <START_URL>
//
// SITE is derived from START_URL's hostname (the same label main.ts stores rows under). Needs the
// authenticated browser profile the crawl used (config.userDataDir), like runAnalysisFromDb. Runs one
// site at a time: the profile cannot be opened by two Chromium instances at once.
import { chromium } from 'playwright';
import { log, LogLevel } from 'crawlee';
import { openDatabase } from '../src/db/openDatabase';
import { HttpEventStore } from '../src/db/HttpEventStore';
import { PreindexedValueStore } from '../src/db/PreindexedValueStore';
import { ReactStateStore } from '../src/db/ReactStateStore';
import { CrawlStateStore } from '../src/db/CrawlStateStore';
import { VulnerabilityStore } from '../src/db/VulnerabilityStore';
import { AnalysisStatsStore } from '../src/db/AnalysisStatsStore';
import { ForgedRequestStore } from '../src/db/ForgedRequestStore';
import { AuthzClassificationStore } from '../src/db/AuthzClassificationStore';
import { AuthzClassifier } from '../src/analysis/authzClassifier';
import { AnalysisPipeline } from '../src/analysis/AnalysisPipeline';
import { installParamUsageTracking } from '../src/browser/paramUsageTracker';
import { config } from '../src/config';

log.setLevel(process.env.LOG_LEVEL?.toLowerCase() === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

const START_URL = process.argv[2] ?? process.env.START_URL;
if (!START_URL) {
  console.error('Usage: npx tsx scripts/recheckFindings.ts <START_URL>');
  process.exit(1);
}
const SITE = new URL(START_URL).hostname;
if (!config.userDataDir) throw new Error('USER_DATA_DIR is not set: the recheck needs the authenticated profile the crawl used');

const db = openDatabase({ path: config.db.path });
// clearOnStart:false everywhere — and recheckFindings never writes to these stores anyway
const httpEventStore = new HttpEventStore({ db, clearOnStart: false });
const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: false });
const pipeline = new AnalysisPipeline({
  httpEventStore,
  preindexStore: new PreindexedValueStore({ db, clearOnStart: false }),
  reactStateStore: new ReactStateStore({ db, clearOnStart: false }),
  crawlStateStore: new CrawlStateStore({ db, clearOnStart: false }),
  vulnerabilityStore,
  statsStore: new AnalysisStatsStore({ db, clearOnStart: false }),
  forgedRequestStore: new ForgedRequestStore({ db, clearOnStart: false }),
  classifier: new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false })),
  options: {
    maxConcurrentRequests: config.analysis.maxConcurrentRequests,
    maxGeneratedRequests: config.analysis.maxGeneratedRequests,
    timeBetweenRequestsMs: config.analysis.timeBetweenRequestsMs,
    dbPath: config.db.path,
    userDataDir: config.userDataDir,
    reportsDir: config.analysis.reportsDir,
    clientRoutingProbe: config.analysis.clientRoutingProbe,
    maxSegmentMatches: config.analysis.maxSegmentMatches,
    clientRoutingConcurrency: config.analysis.clientRoutingConcurrency,
    notFoundDomMaxDiff: config.analysis.notFoundDomMaxDiff,
    segmentBlacklist: config.analysis.segmentBlacklist,
    paramBlacklist: config.analysis.paramBlacklist,
    clientRoutingFullNavigationEscalation: config.analysis.clientRoutingFullNavigationEscalation,
    clientRoutingEscalationAttempts: config.analysis.clientRoutingEscalationAttempts,
    clientRoutingPathCoherence: config.analysis.clientRoutingPathCoherence,
  },
});

// RECHECK_LIMIT=N re-examines only the first N stored findings: a quick look at a large FP class.
const limit = Number(process.env.RECHECK_LIMIT) || undefined;
const findings = vulnerabilityStore.listBySite(SITE).slice(0, limit);
console.log(`Rechecking ${findings.length} stored finding(s) for ${SITE} (nothing is written)`);
if (findings.length === 0) process.exit(0);

const context = await chromium.launchPersistentContext(config.userDataDir, { headless: true, channel: 'chromium' });
const page = context.pages()[0] ?? (await context.newPage());
await installParamUsageTracking(page);   // init script: before the first navigation (the query probe reads __accessedParams)

const startedAt = Date.now();
const results = await pipeline.recheckFindings({ page, site: SITE, findings });
await context.close();

for (const { finding, kept, reason } of results) {
  console.log(`\n[${kept ? 'KEPT    ' : 'REJECTED'}] ${finding.detectionMethod} ${finding.method}  ${finding.referenceValue} -> ${finding.candidateValue}`);
  console.log(`  ${finding.referenceUrl}`);
  console.log(`  ${finding.candidateUrl}`);
  if (!kept) console.log(`  reason: ${reason}`);
}
const kept = results.filter((r) => r.kept).length;
console.log(`\n=== ${SITE}: ${kept}/${results.length} still flagged, ${results.length - kept} rejected (${((Date.now() - startedAt) / 1000).toFixed(0)}s) ===`);
process.exit(0);
