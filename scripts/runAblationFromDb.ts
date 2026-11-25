// Runs the AblationPipeline (candidate generation from HTTP JSON bodies only — no React state, no
// client-routing probes; see AblationPipeline's own doc comment) against a site's already-captured
// data in storage/crawler.db, WITHOUT any new exploration and WITHOUT clearing anything
// (clearOnStart:false everywhere). It writes only to ablation_stats / ablation_vulnerabilities,
// never to vulnerabilities / analysis_stats / react_states / etc. — so it stays comparable to a
// main-pipeline run on the same data (compare the two with scripts/compareAblation.ts).
//
// Usage:
//   npx tsx scripts/runAblationFromDb.ts <START_URL>
//   START_URL=https://www.busuu.com/dashboard/timeline/a1 npx tsx scripts/runAblationFromDb.ts
//
// SITE is derived from START_URL's hostname (the same label main.ts stores rows under). Needs the
// same authenticated browser profile the crawl used (config.userDataDir), so forged requests run as
// the logged-in user. Not committed — ad-hoc runner.
import { chromium } from 'playwright';
import { log, LogLevel } from 'crawlee';
import { openDatabase } from '../src/db/openDatabase';
import { HttpEventStore } from '../src/db/HttpEventStore';
import { CrawlStateStore } from '../src/db/CrawlStateStore';
import { AblationVulnerabilityStore } from '../src/db/AblationVulnerabilityStore';
import { AblationStatsStore } from '../src/db/AblationStatsStore';
import { ForgedRequestStore } from '../src/db/ForgedRequestStore';
import { AuthzClassificationStore } from '../src/db/AuthzClassificationStore';
import { AuthzClassifier } from '../src/analysis/authzClassifier';
import { AblationPipeline } from '../src/analysis/AblationPipeline';
import { ReactStateStore } from '../src/db/ReactStateStore';
import { SessionAuthStore } from '../src/db/SessionAuthStore';
import { checkEntryPointFresh } from '../src/analysis/authFreshness';
import { extensionLaunchArgs } from '../src/browser/ExtensionCalls';
import { config } from '../src/config';

log.setLevel(LogLevel.INFO);

const START_URL = process.argv[2] ?? process.env.START_URL;
if (!START_URL) {
  console.error('Usage: npx tsx scripts/runAblationFromDb.ts <START_URL>   (or set START_URL in the environment)');
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
const crawlStateStore = new CrawlStateStore({ db, clearOnStart: false });
const vulnerabilityStore = new AblationVulnerabilityStore({ db, clearOnStart: false });
const statsStore = new AblationStatsStore({ db, clearOnStart: false });
// shared with the main pipeline's own prior runs against this same db: a candidate both propose is
// reused instead of hit again live — see ForgedRequestStore's own doc comment.
const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: false });
const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false }));
// Read only by the auth-freshness gate below (a session check, not analysis input: the ablation itself
// never reads React state).
const reactStateStore = new ReactStateStore({ db, clearOnStart: false });
// Refreshed credentials from refreshAuth.ts, as in runAnalysisFromDb (undefined on the common path).
const authOverride = new SessionAuthStore({ db }).get({ site: SITE });

const pipeline = new AblationPipeline({
  httpEventStore, crawlStateStore, vulnerabilityStore, statsStore, forgedRequestStore, classifier,
  options: {
    maxConcurrentRequests: config.analysis.maxConcurrentRequests,
    timeBetweenRequestsMs: config.analysis.timeBetweenRequestsMs,
    maxSegmentMatches: config.analysis.maxSegmentMatches,
    maxGeneratedRequests: config.analysis.maxGeneratedRequests,
    paramBlacklist: config.analysis.paramBlacklist,
    segmentBlacklist: config.analysis.segmentBlacklist,
    authzDirectionGate: config.analysis.authzDirectionGate,
    overwriteFindingsPerSite: config.analysis.overwriteFindingsPerSite,
    authOverride,
  },
});

console.log(`AblationPipeline on ${SITE} against ${DB_PATH} (no exploration, nothing cleared)`);
console.log(`  start_url=${START_URL}`);
console.log(`  http_events=${httpEventStore.count(SITE)}, crawl_states=${crawlStateStore.listBySite(SITE).length}`);
console.log(`  profile=${config.userDataDir}`);

// Extension loaded only so the auth gate can read the entry point's live React fingerprint.
const context = await chromium.launchPersistentContext(config.userDataDir, {
  headless: true, channel: 'chromium',
  args: config.extension ? extensionLaunchArgs(config.extension) : [],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(START_URL, { waitUntil: 'load', timeout: 30_000 }).catch((e) => console.warn('initial goto failed (continuing):', (e as Error).message));

// Same entry-point auth-freshness gate as runAnalysisFromDb: forging under an expired session would turn
// every live forge into a 401/403 and silently report 0 findings.
const gate = await checkEntryPointFresh({ page, reactStateStore, site: SITE, entryUrl: START_URL, maxWaitMs: config.analysis.clientRoutingProbe.maxWaitMs });
console.log(`  auth gate: ${gate.fresh ? 'FRESH' : 'EXPIRED'} — ${gate.reason} (seed fingerprints=${gate.seedCount})${authOverride ? ' | using refreshed credentials (session_auth)' : ''}`);
if (!gate.fresh) {
  console.error(`\n⚠️  SESSION EXPIRED — re-authenticate, then re-run: npx tsx scripts/refreshAuth.ts ${START_URL}\n`);
  await context.close();
  process.exit(2);
}

const startedAt = Date.now();
await pipeline.runForSite({ page, site: SITE });
console.log(`\nAblation wall-clock: ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);

console.log(`\n=== ablation_stats (${SITE}) ===`);
console.log(statsStore.all().filter((r) => r.site === SITE));
console.log('=== ablation_vulnerabilities flagged ===', vulnerabilityStore.count(SITE));

await context.close();
process.exit(0);
