// Runs the REAL AnalysisPipeline against a site's already-captured data in storage/crawler.db
// (http_events / react_states / preindexed_values / crawl_states) WITHOUT any new exploration and
// WITHOUT clearing anything (clearOnStart:false everywhere, and it never calls overwriteDomainRows).
// It writes only to forged_requests / vulnerabilities / analysis_stats, exactly as the end-of-crawl
// AnalysisHooks would. Use when an exploration finished (or was interrupted) and you want to (re)run
// just the analysis on whatever data is in the DB now.
//
// Usage:
//   npx tsx scripts/runAnalysisFromDb.ts <START_URL>
//   START_URL=https://www.busuu.com/dashboard/timeline/a1 npx tsx scripts/runAnalysisFromDb.ts
//
// SITE is derived from START_URL's hostname (the same label main.ts stores rows under). Needs the
// same authenticated browser profile the crawl used (config.userDataDir), so forged requests and
// client-routing probes run as the logged-in user. Not committed — ad-hoc runner.
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
  console.error('Usage: npx tsx scripts/runAnalysisFromDb.ts <START_URL>   (or set START_URL in the environment)');
  process.exit(1);
}
let SITE: string;
try {
  SITE = new URL(START_URL).hostname;   // same label main.ts stores a site's rows under
} catch {
  console.error(`Not a valid URL: ${START_URL}`);
  process.exit(1);
}
if (!config.userDataDir) throw new Error('USER_DATA_DIR is not set: analysis needs the authenticated profile the crawl used');

const DB_PATH = config.db.path;
const db = openDatabase({ path: DB_PATH });
// every store opened with clearOnStart:false — nothing already in the DB is removed
const httpEventStore = new HttpEventStore({ db, clearOnStart: false });
const preindexStore = new PreindexedValueStore({ db, clearOnStart: false });
const reactStateStore = new ReactStateStore({ db, clearOnStart: false });
const crawlStateStore = new CrawlStateStore({ db, clearOnStart: false });
const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: false });
const statsStore = new AnalysisStatsStore({ db, clearOnStart: false });
const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: false });
const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false }));

const pipeline = new AnalysisPipeline({
  httpEventStore, preindexStore, reactStateStore, crawlStateStore, vulnerabilityStore, statsStore,
  forgedRequestStore, classifier,
  options: {
    maxConcurrentRequests: config.analysis.maxConcurrentRequests,
    timeBetweenRequestsMs: config.analysis.timeBetweenRequestsMs,
    dbPath: DB_PATH,
    userDataDir: config.userDataDir,
    reportsDir: config.analysis.reportsDir,
    clientRoutingProbe: config.analysis.clientRoutingProbe,
    maxSegmentMatches: config.analysis.maxSegmentMatches,
    clientRoutingConcurrency: config.analysis.clientRoutingConcurrency,
    notFoundDomMaxDiff: config.analysis.notFoundDomMaxDiff,
    segmentBlacklist: config.analysis.segmentBlacklist,
    paramBlacklist: config.analysis.paramBlacklist,
    clientRoutingFullNavigationEscalation: config.analysis.clientRoutingFullNavigationEscalation,
  },
});

console.log(`AnalysisPipeline on ${SITE} against ${DB_PATH} (no exploration, nothing cleared)`);
console.log(`  start_url=${START_URL}`);
console.log(`  http_events=${httpEventStore.listBySite(SITE).length}, react_states=${reactStateStore.countBySite(SITE)}, crawl_states=${crawlStateStore.listBySite(SITE).length}`);
console.log(`  profile=${config.userDataDir}`);

const context = await chromium.launchPersistentContext(config.userDataDir, { headless: true, channel: 'chromium' });
const page = context.pages()[0] ?? (await context.newPage());
await installParamUsageTracking(page);   // init script: must be in place before the first navigation (client-routing probe reads __accessedParams)
await page.goto(START_URL, { waitUntil: 'load', timeout: 30_000 }).catch((e) => console.warn('initial goto failed (continuing):', (e as Error).message));

const startedAt = Date.now();
await pipeline.runForSite({ page, site: SITE, explorationMs: 0 });
console.log(`\nAnalysis wall-clock: ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);

console.log(`\n=== analysis_stats (${SITE}) ===`);
console.log(statsStore.all().filter((r) => r.site === SITE));
console.log('=== vulnerabilities flagged ===', vulnerabilityStore.count(SITE));

await context.close();
process.exit(0);
