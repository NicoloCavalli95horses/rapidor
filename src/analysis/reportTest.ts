import type { ReportRow } from '../db/VulnerabilityStore';
import type { FindingEvidence } from './reportEvidence';

/**
 * Renders the thin, executable test.ts for one finding. It carries NO decision logic of its own: it
 * loads evidence.json, opens the authenticated browser profile, and delegates to the shared oracle in
 * src/analysis/reportOracle.ts (so the "is this still a leak?" verdict tracks the engine, not a frozen
 * copy). The test ASSERTS the resource is NOT reachable, so it is RED while the vulnerability reproduces
 * and green once the vendor denies the forged access; it SKIPS when the session is no longer fresh.
 *
 * The file sits at reports/<site>/<slug>/test.ts, three levels under the project root, hence the
 * `../../../src` imports. The authenticated profile is read from USER_DATA_DIR at run time (never
 * embedded — it is machine-specific and not something to commit/share).
 */

/** JSON string literal, safe to inline into generated source. */
function lit(value: string): string {
  return JSON.stringify(value);
}

export function renderReportTest({ row }: { row: ReportRow; evidence: FindingEvidence }): string {
  const isHttp = row.detectionMethod === 'http';
  const title = `${row.site}: ${row.detectionMethod} ${row.referenceValue} -> ${row.candidateValue} must NOT leak the paid resource`;
  const call = isHttp
    ? 'await evaluateHttpFinding({ page, evidence })'
    : 'await evaluateClientFinding({ page, evidence, assetsDir: join(HERE, \'assets\'), referenceValue: REFERENCE_VALUE, candidateValue: CANDIDATE_VALUE })';
  return `// AUTO-GENERATED test for one flagged IDOR finding — see report.md in this folder for the full write-up.
// RED while the vulnerability is present, green once the server/app denies the forged access, SKIP if
// the authenticated session has expired. Run from this folder:
//   USER_DATA_DIR=/path/to/authenticated/profile node --import tsx --test test.ts
//
// Finding id: ${row.id}
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
const REFERENCE_VALUE = ${lit(row.referenceValue)};
const CANDIDATE_VALUE = ${lit(row.candidateValue)};

test(${lit(title)}, async (t) => {
  const context = await chromium.launchPersistentContext(process.env.USER_DATA_DIR ?? '', {
    headless: process.env.HEADLESS !== 'false',   // headful (HEADLESS=false) helps on anti-bot sites
    channel: 'chromium',
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const fresh = await isSessionFresh({ page, referenceUrl: evidence.reproductionReferenceUrl });
    if (!fresh.fresh) { t.skip(fresh.reason); return; }

    const verdict = ${call};
    // leaked === true => the paid/higher-privilege resource was reached => the IDOR reproduces.
    assert.ok(!verdict.leaked, verdict.detail);
  } finally {
    await context.close();
  }
});
`;
}
