// AUTO-GENERATED test for one flagged IDOR finding — see report.md in this folder for the full write-up.
// RED while the vulnerability is present, green once the server/app denies the forged access, SKIP if
// the authenticated session has expired. Run from this folder:
//   USER_DATA_DIR=/path/to/authenticated/profile node --import tsx --test test.ts
//
// Finding id: c06dc1bcccf1ffa9a036a326ef4de46c85577580e3fdd81d1333367457321a5f
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
const REFERENCE_VALUE = "73";
const CANDIDATE_VALUE = "82";

test("promova.com: http 73 -> 82 must NOT leak the paid resource", async (t) => {
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
