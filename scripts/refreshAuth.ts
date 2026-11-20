// Re-authenticates a site's browser profile for a re-analysis run whose originally-captured (t1) session
// has expired — WITHOUT re-crawling. Opens the persistent profile headed at START_URL for a manual login,
// then harvests the fresh auth material and stores it (session_auth) so the next `runAnalysisFromDb`
// forges every request against the refreshed session (strip stale cookie / overlay fresh bearer). The
// site's forged_requests cache is cleared so responses forged under the expired session are never reused.
//
// Usage:
//   npx tsx scripts/refreshAuth.ts <START_URL>
//
// Then re-run:  npx tsx scripts/runAnalysisFromDb.ts <START_URL>
import readline from 'node:readline/promises';
import { chromium } from 'playwright';
import { log, LogLevel } from 'crawlee';
import { openDatabase } from '../src/db/openDatabase';
import { ReactStateStore } from '../src/db/ReactStateStore';
import { ForgedRequestStore } from '../src/db/ForgedRequestStore';
import { SessionAuthStore } from '../src/db/SessionAuthStore';
import { extensionLaunchArgs } from '../src/browser/ExtensionCalls';
import { installParamUsageTracking } from '../src/browser/paramUsageTracker';
import { checkEntryPointFresh } from '../src/analysis/authFreshness';
import { harvestSessionAuth } from '../src/analysis/authSession';
import { config } from '../src/config';

log.setLevel(process.env.LOG_LEVEL?.toLowerCase() === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

const START_URL = process.argv[2] ?? process.env.START_URL;
if (!START_URL) {
  console.error('Usage: npx tsx scripts/refreshAuth.ts <START_URL>   (or set START_URL in the environment)');
  process.exit(1);
}
let SITE: string;
try {
  SITE = new URL(START_URL).hostname;
} catch {
  console.error(`Not a valid URL: ${START_URL}`);
  process.exit(1);
}
if (!config.userDataDir) throw new Error('USER_DATA_DIR is not set: refreshAuth needs the same persistent profile the crawl used');

const db = openDatabase({ path: config.db.path });
const reactStateStore = new ReactStateStore({ db, clearOnStart: false });
const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: false });
const sessionAuthStore = new SessionAuthStore({ db });

// Headed, so the user can complete the login (SSO/2FA included) by hand.
const context = await chromium.launchPersistentContext(config.userDataDir, {
  headless: false, channel: 'chromium',
  args: config.extension ? extensionLaunchArgs(config.extension) : [],
});
const page = context.pages()[0] ?? (await context.newPage());
await installParamUsageTracking(page);
await page.goto(START_URL, { waitUntil: 'load', timeout: 60_000 }).catch((e) => console.warn('initial goto failed (continuing):', (e as Error).message));

console.log(`\nA browser window is open at ${START_URL} (profile: ${config.userDataDir}).`);
console.log('Log in manually, land on the authenticated page, then return here.');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question('Press Enter once you are logged in... ');
rl.close();

// Confirm the session now renders the authenticated entry point (the SAME gate the analysis uses).
const gate = await checkEntryPointFresh({ page, reactStateStore, site: SITE, entryUrl: START_URL, maxWaitMs: config.analysis.clientRoutingProbe.maxWaitMs });
if (gate.fresh) {
  console.log(`✓ Entry point renders the captured authenticated state (${gate.reason}).`);
} else {
  console.warn(`⚠️  Entry point still does not look authenticated (${gate.reason}). Harvesting anyway — verify the login succeeded.`);
}

// Harvest fresh header-auth (bearer token etc.) by sniffing a reload's same-site requests. A cookie-auth
// site carries none of these and returns {}, which is fine: stripCookie re-points the forge at the
// profile's freshly-logged-in context cookies.
const freshHeaders = await harvestSessionAuth({ page, site: SITE, headerNames: config.analysis.volatileAuthHeaders });
sessionAuthStore.set({ site: SITE, override: { stripCookie: true, freshHeaders } });
forgedRequestStore.clearSite({ site: SITE });   // never reuse responses forged under the expired session

const names = Object.keys(freshHeaders);
console.log(`\n✓ Stored refreshed credentials for ${SITE}: stripCookie=true, freshHeaders=[${names.join(', ') || '(none — cookie-auth site, using the context cookies)'}]`);
console.log(`✓ Cleared the forged_requests cache for ${SITE}.`);
console.log(`\nNow re-run the analysis:  npx tsx scripts/runAnalysisFromDb.ts ${START_URL}`);
await context.close();
process.exit(0);
