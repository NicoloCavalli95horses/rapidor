// AUTO-GENERATED test for one flagged IDOR finding — see report.md in this folder for the full write-up.
// RED while the vulnerability is present, green once the server/app denies the forged access, SKIP if
// the authenticated session has expired. Run from this folder:
//   USER_DATA_DIR=/path/to/authenticated/profile node --import tsx --test test.ts
//
// Finding id: a1d4745b280068c208c5a9a1a49cf7085d7f680c129304e477de1f9685f481b3
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { FindingEvidence } from '../../../src/analysis/reportEvidence';
import { isSessionFresh, evaluateHttpFinding, evaluateClientFinding } from '../../../src/analysis/reportOracle';

const HERE = dirname(fileURLToPath(import.meta.url));
const evidence = JSON.parse(readFileSync(join(HERE, 'evidence.json'), 'utf8')) as FindingEvidence;
const REFERENCE_VALUE = "objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e";
const CANDIDATE_VALUE = "objective_ja_complete_a1_38_a";

test("www.busuu.com: http objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e -> objective_ja_complete_a1_38_a must NOT leak the paid resource", async (t) => {
  const context = await chromium.launchPersistentContext(process.env.USER_DATA_DIR ?? '', {
    headless: process.env.HEADLESS !== 'false',   // headful (HEADLESS=false) helps on anti-bot sites
    channel: 'chromium',
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const fresh = await isSessionFresh({ page, referenceUrl: evidence.reproductionReferenceUrl });
    if (!fresh.fresh) { t.skip(fresh.reason); return; }

    const verdict = await evaluateHttpFinding({ page, evidence });
    // leaked === true => the paid/higher-privilege resource was reached => the IDOR reproduces.
    assert.ok(!verdict.leaked, verdict.detail);
  } finally {
    await context.close();
  }
});
