// Runs the REAL analysis detection, offline and deterministically, against the self-contained demo DB
// (demo/crawler.db) produced by scripts/buildDemo.ts. It never touches the network: every forged request
// is served from the snapshot's forged_requests cache (a miss would throw), and the live-only
// client-routing phase is skipped — so the demo is HTTP-only by construction. No browser, no auth
// profile. Anyone with this repo and the demo DB re-derives exactly the findings we collected.
//
// Usage:
//   npx tsx scripts/runDemo.ts <START_URL>              # START_URL identifies the site; data comes from the demo DB
//   npx tsx scripts/runDemo.ts https://www.busuu.com/dashboard  --db demo/crawler.db
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
import { config } from '../src/config';

log.setLevel(process.env.LOG_LEVEL?.toLowerCase() === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const startUrl = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.env.START_URL;
if (!startUrl) {
  console.error('Usage: npx tsx scripts/runDemo.ts <START_URL> [--db demo/crawler.db]');
  process.exit(1);
}
let site: string;
try {
  site = new URL(startUrl).hostname;
} catch {
  console.error(`Not a valid URL: ${startUrl}`);
  process.exit(1);
}

const dbPath = flag('db', config.db.demoPath);
const db = openDatabase({ path: dbPath });

const httpEventStore = new HttpEventStore({ db, clearOnStart: false });
const preindexStore = new PreindexedValueStore({ db, clearOnStart: false });
const reactStateStore = new ReactStateStore({ db, clearOnStart: false });
const crawlStateStore = new CrawlStateStore({ db, clearOnStart: false });
const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: false });
const statsStore = new AnalysisStatsStore({ db, clearOnStart: false });
const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: false });
const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false }));

// Fresh, repeatable count every run: wipe only this site's previously-derived findings/stats in the demo
// DB (its inputs — http_events/react_states/forged_requests/... — are never touched).
vulnerabilityStore.clearSite({ site });
statsStore.clearSite({ site });

const pipeline = new AnalysisPipeline({
  httpEventStore, preindexStore, reactStateStore, crawlStateStore, vulnerabilityStore, statsStore,
  forgedRequestStore, classifier,
  options: {
    maxConcurrentRequests: config.analysis.maxConcurrentRequests,
    timeBetweenRequestsMs: 0,
    dbPath,
    reportsDir: config.analysis.reportsDir,
    clientRoutingProbe: config.analysis.clientRoutingProbe,
    maxSegmentMatches: config.analysis.maxSegmentMatches,
    maxGeneratedRequests: config.analysis.maxGeneratedRequests,
    clientRoutingConcurrency: config.analysis.clientRoutingConcurrency,
    notFoundDomMaxDiff: config.analysis.notFoundDomMaxDiff,
    segmentBlacklist: config.analysis.segmentBlacklist,
    paramBlacklist: config.analysis.paramBlacklist,
    clientRoutingFullNavigationEscalation: config.analysis.clientRoutingFullNavigationEscalation,
    clientRoutingPathCoherence: config.analysis.clientRoutingPathCoherence,
    offline: true,   // HTTP-only, cache-served forges, no client-routing, no browser
  },
});

console.log(`Offline demo analysis for ${site} against ${dbPath} (HTTP-only, no network)`);
console.log(`  http_events=${httpEventStore.count(site)}, react_states=${reactStateStore.countBySite(site)}, forged_requests cached for this site`);

// No `page`: offline mode never forges live nor opens a browser.
await pipeline.runForSite({ site, explorationMs: 0 });

const findings = vulnerabilityStore.count(site);
console.log(`\n=== ${findings} HTTP IDOR finding(s) re-derived deterministically for ${site} ===`);
for (const v of db.prepare(
  'SELECT candidate_value, reference_url, candidate_url FROM vulnerabilities WHERE site = ? ORDER BY candidate_url',
).all(site) as { candidate_value: string; reference_url: string; candidate_url: string }[]) {
  console.log(`  ${v.reference_url}  ->  ${v.candidate_url}`);
}
process.exit(0);
