import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { forgeRequest } from './requestForge';
import { getServerResponseSimilarity, isIdenticalResponse, isEmptyJsonResponse, isErrorEnvelopeResponse } from './responseEvaluate';
import {
  captureRouteByNavigation, readDomSnapshot, diffDomSnapshots, domNoise, maskValue, makeGarbageValue,
  type DomSnapshot,
} from './domSnapshot';
import type { FindingEvidence } from './reportEvidence';

/**
 * The runtime oracle shared by every generated test.ts. Keeping it in src/ (not inlined into each
 * generated file) is deliberate: the "is this still a leak?" decision then tracks the engine — the test
 * reuses the SAME response-similarity and DOM-diff primitives the pipeline uses, so a guard change can
 * never leave a stale copy behind in a reproduction script. A generated test is therefore thin: load
 * evidence, open the authenticated context, call one of these, assert `!leaked`.
 *
 * Convention: `leaked === true` means the paid/higher-privilege resource was reached — the finding
 * reproduces — so the test ASSERTS `!leaked` and is RED while the vulnerability is present.
 */

export interface OracleVerdict {
  leaked: boolean;       // true = the paid resource was served/rendered (vulnerability reproduces)
  detail: string;        // human-readable one-liner for the assertion message / test log
}

/** The fraction of changed text nodes (or element count) above which a client-routing render counts as "content appeared". */
const DEFAULT_DOM_DIFF_THRESHOLD = 0.05;

/**
 * Lightweight session-freshness check for a standalone test: open the reference page and decide whether
 * the authenticated session is still alive. A standalone test has no captured fingerprint corpus (unlike
 * runAnalysisFromDb's checkEntryPointFresh), so this uses only positive login-page evidence: the load
 * bounced to a DIFFERENT ORIGIN (SSO host), or the page renders a password field. On either, the test
 * must SKIP — an expired login that answers 401 would otherwise look like a fixed vulnerability.
 * Conservative: anything else (including a failed navigation) returns fresh, so a flaky load never
 * silently voids the finding.
 */
export async function isSessionFresh({ page, referenceUrl }: { page: Page; referenceUrl: string }): Promise<{ fresh: boolean; reason: string }> {
  let refOrigin: string;
  try { refOrigin = new URL(referenceUrl).origin; } catch { return { fresh: true, reason: 'reference url unparseable — proceeding' }; }
  try {
    await page.goto(referenceUrl, { waitUntil: 'load', timeout: 30_000 });
  } catch {
    return { fresh: true, reason: 'reference page failed to load — proceeding (not treated as expiry)' };
  }
  let landedOrigin = refOrigin;
  try { landedOrigin = new URL(page.url()).origin; } catch { /* keep refOrigin */ }
  if (landedOrigin !== refOrigin) return { fresh: false, reason: `redirected to a different origin (${landedOrigin}) — session likely expired` };
  const hasPassword = await page.locator('input[type="password"]').count().catch(() => 0);
  if (hasPassword > 0) return { fresh: false, reason: 'a password field is rendered — on a login page, session expired' };
  return { fresh: true, reason: 'same origin, no login form — session alive' };
}

/**
 * HTTP oracle: re-forges the candidate GET live, in the authenticated (lower-tier) session, and
 * compares it to the recorded baseline. A leak means the server answered like a served resource —
 * 2xx, non-empty, not an error envelope, SHAPE-similar to the baseline, and NOT byte/JSON-identical to
 * it (identical = the server ignored the swapped value, the free fallback). This mirrors the pipeline's
 * per-candidate accept (candidateEvaluator + httpGuards); the engine's cross-candidate guards
 * (value-insensitivity, response-history) need the whole site and are out of scope for one finding.
 */
export async function evaluateHttpFinding({ page, evidence }: { page: Page; evidence: FindingEvidence }): Promise<OracleVerdict> {
  if (evidence.kind.type !== 'http') throw new Error('evaluateHttpFinding called on a non-http finding');
  const { kind } = evidence;
  // Headers are redacted in the stored evidence; the forge runs in the authenticated profile, whose
  // own cookies/credentials page.request.fetch reuses, so no credential header is needed here.
  const forged = await forgeRequest({ page, url: evidence.reproductionCandidateUrl, method: kind.method });
  const baseline = { status: kind.baselineStatus, headers: kind.baselineHeaders, body: kind.baselineBody, contentType: kind.baselineContentType };

  if (forged.status >= 400) return { leaked: false, detail: `forged GET denied/errored with status ${forged.status} — no access` };
  if (isEmptyJsonResponse({ body: forged.body })) return { leaked: false, detail: 'forged response carries no data (empty JSON) — nothing leaked' };
  if (isErrorEnvelopeResponse({ body: forged.body })) return { leaked: false, detail: 'forged response is a top-level error/denial envelope — nothing leaked' };
  if (isIdenticalResponse({ reference: baseline, candidate: forged })) return { leaked: false, detail: 'forged response identical to the baseline — the server ignored the swapped value (free fallback)' };
  const similarity = getServerResponseSimilarity(baseline, forged);
  if (!similarity.areSimilar) return { leaked: false, detail: `forged response differs in shape from the baseline (${JSON.stringify(similarity)}) — not a served sibling resource` };
  return { leaked: true, detail: `status ${forged.status}, shape-similar to the baseline yet distinct content (${JSON.stringify(similarity)}) — the paid resource was served` };
}

async function screenshot({ page, path }: { page: Page; path: string }): Promise<Buffer | undefined> {
  try { const buf = await page.screenshot(); writeFileSync(path, buf); return buf; } catch { return undefined; }
}

/** Writes a pixel diff of two shots (visual evidence only), ignoring size mismatches. Best-effort. */
async function writePixelDiff({ a, b, path }: { a?: Buffer; b?: Buffer; path: string }): Promise<void> {
  if (!a || !b) return;
  try {
    const { PNG } = await import('pngjs');
    const pixelmatch = (await import('pixelmatch')).default;
    const pa = PNG.sync.read(a); const pb = PNG.sync.read(b);
    if (pa.width !== pb.width || pa.height !== pb.height) return;
    const out = new PNG({ width: pa.width, height: pa.height });
    pixelmatch(pa.data, pb.data, out.data, pa.width, pa.height, { threshold: 0.1 });
    writeFileSync(path, PNG.sync.write(out));
  } catch { /* evidence only — never fail the test over a diff image */ }
}

/**
 * Client-routing oracle: the DOM diff is the verdict, screenshots are visual evidence only. Captures
 * the reference page twice to measure its own remount noise (a countdown, randomized quiz words),
 * the forged URL once, and a same-shaped garbage URL once for the not-found baseline. Both identifiers
 * are masked out of every side so a mere echo of the id does not count. A leak means the forged render
 * DIFFERS from the reference beyond that noise (paid content appeared) AND is NOT the app's not-found
 * page. All four renders are real navigations (captureRouteByNavigation), the same way the pipeline's
 * content guard — and a user pasting the URL — reaches them.
 */
export async function evaluateClientFinding({ page, evidence, assetsDir, referenceValue, candidateValue }: {
  page: Page; evidence: FindingEvidence; assetsDir: string; referenceValue: string; candidateValue: string;
}): Promise<OracleVerdict> {
  mkdirSync(assetsDir, { recursive: true });
  const refUrl = evidence.reproductionReferenceUrl;
  const candUrl = evidence.reproductionCandidateUrl;
  const settleMs = evidence.clientRoutingProbe.maxWaitMs;

  const refA = await captureRouteByNavigation({ page, testUrl: refUrl, settleMs });
  const refShot = await screenshot({ page, path: join(assetsDir, 'original.png') });
  const cand = await captureRouteByNavigation({ page, testUrl: candUrl, settleMs });
  const candShot = await screenshot({ page, path: join(assetsDir, 'mutated.png') });
  const refB = await captureRouteByNavigation({ page, testUrl: refUrl, settleMs });   // second reference render, brackets the candidate's remount
  const garbage = await captureRouteByNavigation({ page, testUrl: candUrl.replace(candidateValue, makeGarbageValue(candidateValue)), settleMs });
  await writePixelDiff({ a: refShot, b: candShot, path: join(assetsDir, 'diff.png') });

  if (!refA || !cand || !refB) return { leaked: false, detail: 'could not capture the reference/candidate DOM — inconclusive, treated as no leak' };

  const mask = (s: DomSnapshot, v: string): DomSnapshot => maskValue({ snapshot: s, value: v });
  const noise = domNoise({ a: mask(refA, referenceValue), b: mask(refB, referenceValue), candidate: mask(cand, candidateValue) });
  const vsRef = diffDomSnapshots({ a: mask(refA, referenceValue), b: mask(cand, candidateValue), noise });
  const changedBeyondNoise = vsRef.textFraction > DEFAULT_DOM_DIFF_THRESHOLD || vsRef.nodeFraction > DEFAULT_DOM_DIFF_THRESHOLD;
  if (!changedBeyondNoise) {
    return { leaked: false, detail: `forged DOM is inert vs the reference (text ${(vsRef.textFraction * 100).toFixed(1)}%, nodes ${(vsRef.nodeFraction * 100).toFixed(1)}%) — no paid content rendered` };
  }
  // Content changed — but make sure it is not just the app's not-found page.
  if (garbage) {
    const vsGarbage = diffDomSnapshots({ a: mask(garbage, candidateValue), b: mask(cand, candidateValue) });
    const looksLikeNotFound = vsGarbage.textFraction <= DEFAULT_DOM_DIFF_THRESHOLD && vsGarbage.nodeFraction <= DEFAULT_DOM_DIFF_THRESHOLD;
    if (looksLikeNotFound) return { leaked: false, detail: 'forged render matches the not-found baseline — no real resource' };
  }
  return { leaked: true, detail: `forged render differs from the reference beyond noise (text ${(vsRef.textFraction * 100).toFixed(1)}%, nodes ${(vsRef.nodeFraction * 100).toFixed(1)}%) and is not the not-found page — the paid content rendered` };
}
