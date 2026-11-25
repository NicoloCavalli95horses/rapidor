// Diagnostic: how reliable is checkClientSideRouting's pushState+popstate DOM-mutation probe, run
// several times in a row against the SAME candidate, in headless? Not committed.
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { installParamUsageTracking } from '../../src/browser/paramUsageTracker';
import { checkClientSideRouting } from '../../src/analysis/clientRouting';

const PAGE_URL = 'https://learn.pimsleur.com/MiniLearn/MiniLesson?id=296&force_auto_play=false';
// Replicates AnalysisPipeline's real probe order for this page's 4 candidates, back to back on the
// SAME page with no fresh navigation in between (checkClientSideRouting's own rollback is the only
// "reset" between probes) — unlike the first version of this script, which probed 294 alone, fresh,
// every time. 294 is last here on purpose: that's the one the real run missed.
const SEQUENCE = ['295', '297', '298', '294'];
const ROUNDS = 5;
const headless = process.env.HEADLESS !== 'false';

const userDataDir = process.env.USER_DATA_DIR
  ? path.resolve(process.env.USER_DATA_DIR.replace(/^\$HOME|^~/, os.homedir()))
  : path.join(os.homedir(), '.crawler-profile');

const context = await chromium.launchPersistentContext(userDataDir, { headless, channel: 'chromium' });
const page = context.pages()[0] ?? await context.newPage();
await installParamUsageTracking(page);
await page.goto(PAGE_URL, { waitUntil: 'load' });

console.log(`=== headless=${headless}: ${ROUNDS} rounds of the sequence ${SEQUENCE.join(' -> ')} (no fresh nav between probes) ===`);
const perCandidate: Record<string, boolean[]> = {};
for (const id of SEQUENCE) perCandidate[id] = [];
for (let round = 0; round < ROUNDS; round++) {
  for (const id of SEQUENCE) {
    const r = await checkClientSideRouting({ page, paramName: 'id', paramValue: id });
    perCandidate[id].push(r.isUsingNewParams);
    console.log(`round ${round + 1} id=${id}: hasMutatedDom=${r.hasMutatedDom} isUsingNewParams=${r.isUsingNewParams}`);
  }
}
console.log('--- success rate per candidate (position in sequence matters) ---');
for (const id of SEQUENCE) {
  const results = perCandidate[id];
  console.log(`id=${id}: ${results.filter(Boolean).length}/${results.length}`);
}

await context.close();
process.exit(0);
