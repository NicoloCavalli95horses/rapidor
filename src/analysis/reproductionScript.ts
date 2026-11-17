import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from 'crawlee';
import type { PropDiff } from './responseEvaluate';

/**
 * Generates a standalone, runnable `.ts` reproduction script for one flagged finding. The script is
 * self-contained: it embeds the original request/response and the React props of both nodes, so it
 * never depends on storage/crawler.db (which a later crawl wipes by default).
 *
 * Running it with `npx tsx` prints, side by side:
 *  - http findings: ORIGINAL request + response (recorded), MUTATED request + response (live);
 *  - client-routing findings: opens a real browser on the original URL, snapshots it, applies the
 *    mutation (pushState + popstate) and snapshots it again;
 *  - in both cases a normalized DOM diff of the two pages (domSnapshot.ts: the same comparison the
 *    pipeline's guards use — text nodes, <img> src, element count), which is the verdict, plus the
 *    two screenshots and their pixel diff written next to the script as visual evidence only (a
 *    screenshot is viewport-bound and depends on assets loading, so it is never a criterion);
 *  - the React props of the original node and of the node whose value was spliced in.
 */

export type ReproductionKind =
  | {
      type: 'http'; method: string; headers: Record<string, string>; postData?: string;
      baselineStatus: number; baselineHeaders: Record<string, string>; baselineBody: string; baselineContentType?: string;
    }
  | { type: 'client-routing-query'; paramName: string; candidateValue: string }
  | { type: 'client-routing-path'; candidateUrl: string };

export interface ReproductionInput {
  id: string;
  site: string;
  referenceUrl: string;
  candidateUrl: string;
  motivation: string;
  differences: PropDiff[];
  sensitiveKeys: string[];
  referenceValue: string;
  candidateValue: string;
  referenceProps: unknown;
  candidateProps: unknown;
  userDataDir?: string;
  reportsDir: string;
  kind: ReproductionKind;
  clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };  // embedded verbatim so a re-run of this script tests the exact same window the original run used
}

/** JS literal, not JSON.stringify: keeps `undefined` as `undefined` rather than dropping the key silently. */
function literal(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value, null, 2);
}

/**
 * literal() above only guards a top-level undefined: JSON.stringify still silently drops any
 * undefined-valued KEY nested inside an object it's given, which is exactly what a PropDiff looks
 * like whenever a prop exists on only one side of the diff (compareObj leaves `reference` or
 * `current` undefined — see responseEvaluate.ts's own doc comment). The embedded DIFFERENCES array
 * must keep both keys present (even when `undefined`) or the generated script fails to typecheck
 * against the PropDiff type it imports — this is the actual bug behind the lint/tsc errors on
 * existing reproduction scripts. Each field goes through literal() individually instead of
 * stringifying the whole array/object in one JSON.stringify call.
 */
function literalPropDiff(d: PropDiff): string {
  return `{ "path": ${literal(d.path)}, "reference": ${literal(d.reference)}, `
    + `"current": ${literal(d.current)}, "key": ${literal(d.key)}, "pathStr": ${literal(d.pathStr)} }`;
}

function literalDiffs(differences: PropDiff[]): string {
  if (differences.length === 0) return '[]';
  return `[\n  ${differences.map(literalPropDiff).join(',\n  ')}\n]`;
}

function reproductionBody(input: ReproductionInput): string {
  const { kind } = input;
  if (kind.type === 'http') {
    return `
  const { forgeRequest } = await import('../../src/analysis/requestForge');
  const { getServerResponseSimilarity } = await import('../../src/analysis/responseEvaluate');

  const original = {
    request: { method: ${literal(kind.method)}, url: REFERENCE_URL, headers: ${literal(kind.headers)}, body: ${literal(kind.postData)} },
    response: { status: ${literal(kind.baselineStatus)}, headers: ${literal(kind.baselineHeaders)}, body: ${literal(kind.baselineBody)}, contentType: ${literal(kind.baselineContentType)} },
  };

  section('1. ORIGINAL request (as the page itself sent it)');
  printRequest(original.request);
  section('2. ORIGINAL response (recorded during the crawl)');
  printResponse(original.response);

  const mutatedRequest = { ...original.request, url: CANDIDATE_URL };
  section('3. MUTATED request (same request, ' + REFERENCE_VALUE + ' -> ' + CANDIDATE_VALUE + ')');
  printRequest(mutatedRequest);

  const forged = await forgeRequest({
    page, url: CANDIDATE_URL, method: original.request.method,
    headers: original.request.headers, postData: original.request.body,
  });
  section('4. MUTATED response (live, just now)');
  printResponse(forged);

  const similarity = getServerResponseSimilarity(original.response, forged);
  verdict = similarity.areSimilar
    ? 'similarity ' + JSON.stringify(similarity) + ' => the server answered the mutated request like a normal successful one — consistent with an IDOR.'
    : 'similarity ' + JSON.stringify(similarity) + ' => the mutated response differs from the original in shape — re-check manually (server may have changed).';

  // Screenshots: the browser opens the original and the mutated URL, as a user pasting them in the address bar would see them.
  if (original.request.method.toUpperCase() === 'GET') {
    await page.goto(REFERENCE_URL, { waitUntil: 'load' });
    originalShot = await page.screenshot();
    originalDom = await readDomSnapshot({ page });
    await page.goto(CANDIDATE_URL, { waitUntil: 'load' });
    mutatedShot = await page.screenshot();
    mutatedDom = await readDomSnapshot({ page });
  } else {
    console.log('(page snapshots skipped: ' + original.request.method + ' requests cannot be replayed by opening a URL)');
  }
`;
  }

  const isQuery = kind.type === 'client-routing-query';
  const paramName = isQuery ? kind.paramName : '';
  const probeSetup = isQuery ? `await installParamUsageTracking(page); // init script: must run before the first navigation` : '';
  const probeImport = isQuery ? `const { installParamUsageTracking } = await import('../../src/browser/paramUsageTracker');` : '';
  const { minWaitMs, idleMs, maxWaitMs } = input.clientRoutingProbe;
  const probe = isQuery
    ? `checkClientSideRouting({ page, paramName: ${literal(paramName)}, paramValue: CANDIDATE_VALUE, minWaitMs: ${minWaitMs}, idleMs: ${idleMs}, maxWaitMs: ${maxWaitMs} })`
    : `checkClientSideRoutingForPath({ page, targetUrl: CANDIDATE_URL, minWaitMs: ${minWaitMs}, idleMs: ${idleMs}, maxWaitMs: ${maxWaitMs} })`;

  return `
  const { checkClientSideRouting, checkClientSideRoutingForPath } = await import('../../src/analysis/clientRouting');
  ${probeImport}
  ${probeSetup}
  await page.goto(REFERENCE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(2000); // let the SPA render

  section('1. ORIGINAL page');
  console.log('URL:', REFERENCE_URL);
  originalShot = await page.screenshot();
  originalDom = await readDomSnapshot({ page });

  // The probe (pushState + popstate, no reload) only reports whether the app's own client-side router
  // REACTED to the swapped value; it is printed for information. The DOM diff / screenshots below,
  // which are the verdict, use a REAL navigation to the candidate URL — exactly how the pipeline's
  // content guard renders it and how a user reaches it, because an SSR route (Next.js, ...) only
  // produces its content on a server fetch that a pushState does not trigger.
  section('2. MUTATED page (' + REFERENCE_VALUE + ' -> ' + CANDIDATE_VALUE + ')');
  console.log('URL:', CANDIDATE_URL);
  const result = await ${probe};
  console.log('probe result (pushState, no reload):', JSON.stringify(result));
  await page.goto(CANDIDATE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  mutatedShot = await page.screenshot();
  mutatedDom = await readDomSnapshot({ page });

  verdict = result.isUsingNewParams
    ? "the page's own routing reacted to the swapped value (" + JSON.stringify(result) + ") — see the DOM diff below for whether the content actually differs."
    : "the client-side probe did not confirm a reaction (" + JSON.stringify(result) + ") — the DOM diff below (from a real navigation) is the verdict.";
`;
}

/** Runtime helpers shared by every generated script. */
const HELPERS = `
function section(title: string): void {
  console.log('\\n=== ' + title + ' ===');
}

function printRequest(req: { method: string; url: string; headers: Record<string, string>; body?: string }): void {
  console.log(req.method + ' ' + req.url);
  console.log('headers:', JSON.stringify(req.headers, null, 2));
  if (req.body) console.log('body:', req.body);
}

function printResponse(res: { status: number; headers: Record<string, string>; body: string }): void {
  console.log('status:', res.status);
  console.log('content-type:', res.headers['content-type'] ?? '(none)');
  const body = res.body.length > BODY_PREVIEW_CHARS ? res.body.slice(0, BODY_PREVIEW_CHARS) + '… (' + res.body.length + ' chars total)' : res.body;
  console.log('body:', body);
}

/**
 * The verdict signal: the same normalized DOM comparison the pipeline's guards use (text nodes, <img>
 * src, element count; each side masked with its own value so an echoed id does not count). No
 * self-noise calibration here (one capture per side), so a ticking clock shows up as a change: read
 * the listed lines before trusting a "changed" verdict.
 */
function printDomDiff(originalDom: DomSnapshot | undefined, mutatedDom: DomSnapshot | undefined): DomDiff | undefined {
  section('DOM diff (original vs mutated) — verdict signal');
  if (!originalDom || !mutatedDom) { console.log('(not available)'); return undefined; }
  const diff = diffDomSnapshots({
    a: maskValue({ snapshot: originalDom, value: REFERENCE_VALUE }),
    b: maskValue({ snapshot: mutatedDom, value: CANDIDATE_VALUE }),
  });
  console.log('elements: ' + originalDom.nodeCount + ' -> ' + mutatedDom.nodeCount);
  console.log('changed text nodes: ' + diff.changed.length + ' (' + (diff.textFraction * 100).toFixed(1) + '% of all text nodes)');
  for (const c of diff.changed.slice(0, DOM_DIFF_PREVIEW)) {
    console.log('  ' + c.key + '\\n    - ' + JSON.stringify(c.a ?? null) + '\\n    + ' + JSON.stringify(c.b ?? null));
  }
  if (diff.changed.length > DOM_DIFF_PREVIEW) console.log('  … ' + (diff.changed.length - DOM_DIFF_PREVIEW) + ' more');
  return diff;
}

async function saveScreenshotsAndDiff(originalShot: Buffer | undefined, mutatedShot: Buffer | undefined): Promise<void> {
  section('Screenshots (visual evidence only, not a criterion)');
  if (!originalShot || !mutatedShot) { console.log('(not available)'); return; }
  const originalPath = join(OUT_DIR, BASE_NAME + '.original.png');
  const mutatedPath = join(OUT_DIR, BASE_NAME + '.mutated.png');
  writeFileSync(originalPath, originalShot);
  writeFileSync(mutatedPath, mutatedShot);
  console.log('original:', originalPath);
  console.log('mutated: ', mutatedPath);

  section('Image diff (original vs mutated)');
  const { PNG } = await import('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;
  const a = PNG.sync.read(originalShot);
  const b = PNG.sync.read(mutatedShot);
  if (a.width !== b.width || a.height !== b.height) {
    console.log('(different image sizes: ' + a.width + 'x' + a.height + ' vs ' + b.width + 'x' + b.height + ' — no pixel diff computed)');
    return;
  }
  const diffPath = join(OUT_DIR, BASE_NAME + '.diff.png');
  const diff = new PNG({ width: a.width, height: a.height });
  const totalPixels = a.width * a.height;
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  writeFileSync(diffPath, PNG.sync.write(diff));
  const changedPct = (changed / totalPixels) * 100;
  console.log('diff image:     ', diffPath);
  console.log('changed pixels: ' + changed + ' / ' + totalPixels + ' (' + changedPct.toFixed(2) + '%)');
  console.log('(viewport only, and placeholder-ized assets can hide a change: see the DOM diff for the verdict)');
}

function printProps(): void {
  section('React props');
  console.log('ORIGINAL node props (value ' + REFERENCE_VALUE + '):');
  console.log(JSON.stringify(REFERENCE_PROPS, null, 2));
  console.log('\\nPROPS of the node whose value was spliced into the mutated request (value ' + CANDIDATE_VALUE + '):');
  console.log(JSON.stringify(CANDIDATE_PROPS, null, 2));
  console.log('\\nAuthorization-relevant differences (reference -> candidate):');
  for (const d of DIFFERENCES) console.log('  ' + d.pathStr + ': ' + JSON.stringify(d.reference) + ' -> ' + JSON.stringify(d.current));
  if (SENSITIVE_KEYS.length > 0) console.log('Flagged as access-control-relevant by the sentence-embedding classifier: ' + SENSITIVE_KEYS.join(', '));
}
`;

/** Short, filesystem-safe slug for the finding's detection path, used in the generated file's name. */
function vulnTypeSlug(kind: ReproductionKind): string {
  if (kind.type === 'http') return 'http';
  if (kind.type === 'client-routing-query') return 'client-query';
  return 'client-path';
}

/**
 * yyyymmdd-hhmmss-mmm in local time, filesystem-safe (no colons/dots). Milliseconds are kept (not
 * just whole seconds) because several candidates of the same type on the same site are evaluated
 * concurrently (see AnalysisPipeline's maxConcurrentRequests), so two findings can otherwise land in
 * the same second and silently overwrite each other's file.
 */
function timestampSlug(date: Date): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

/** Filesystem-safe slug of the site (dots are fine in filenames, but keep it defensive). */
function siteSlug(site: string): string {
  return site.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/** Writes the reproduction script to disk and returns its path, or undefined if writing failed (never throws: a report failing to generate must not break the crawl). */
export function writeReproductionScript(input: ReproductionInput): string | undefined {
  try {
    const dir = join(input.reportsDir, input.site);
    mkdirSync(dir, { recursive: true });
    // Human-readable name: <site>_<vuln-type>_<timestamp>.
    const baseName = `${siteSlug(input.site)}_${vulnTypeSlug(input.kind)}_${timestampSlug(new Date())}`;
    const filePath = join(dir, `${baseName}.repro.ts`);

    const content = `// AUTO-GENERATED reproduction script for one flagged finding.
// Self-contained: original request/response and React props are embedded, no database needed.
//
// Finding id:         ${input.id}
// Site:               ${input.site}
// Reference (yours):  ${input.referenceUrl}
// Candidate (theirs): ${input.candidateUrl}
// Motivation:         ${input.motivation.replace(/\n/g, ' ')}
//
// Run with: npx tsx ${filePath}   (from the project root, so the relative imports resolve)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { PropDiff } from '../../src/analysis/responseEvaluate';
import { readDomSnapshot, diffDomSnapshots, maskValue, type DomSnapshot, type DomDiff } from '../../src/analysis/domSnapshot';

const REFERENCE_URL = ${literal(input.referenceUrl)};
const CANDIDATE_URL = ${literal(input.candidateUrl)};
const REFERENCE_VALUE = ${literal(input.referenceValue)};
const CANDIDATE_VALUE = ${literal(input.candidateValue)};
const USER_DATA_DIR = ${literal(input.userDataDir ?? '')}; // '' = ephemeral profile
const OUT_DIR = ${literal(dir)}; // screenshots and diff land here
const BASE_NAME = ${literal(baseName)}; // screenshots/diff share this name, next to the script
const BODY_PREVIEW_CHARS = 1500;
const DOM_DIFF_PREVIEW = 20; // changed text nodes printed in full
const REFERENCE_PROPS = ${literal(input.referenceProps)};
const CANDIDATE_PROPS = ${literal(input.candidateProps)};
const DIFFERENCES: PropDiff[] = ${literalDiffs(input.differences)};
const SENSITIVE_KEYS = ${literal(input.sensitiveKeys)};
${HELPERS}
async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, { headless: false, channel: 'chromium' });
  const page = context.pages()[0] ?? await context.newPage();
  let originalShot: Buffer | undefined;
  let mutatedShot: Buffer | undefined;
  let originalDom: DomSnapshot | undefined;
  let mutatedDom: DomSnapshot | undefined;
  let verdict = '';

  try {
${reproductionBody(input)}
  } finally {
    await context.close();
  }

  const domDiff = printDomDiff(originalDom, mutatedDom);
  await saveScreenshotsAndDiff(originalShot, mutatedShot);
  section('Verdict');
  console.log(verdict);
  if (domDiff) {
    console.log(domDiff.changed.length > 0 || domDiff.nodeDelta > 0
      ? '=> the DOM content changed after swapping in the candidate value (' + domDiff.changed.length + ' text node(s), ' + domDiff.nodeDelta + ' element(s)).'
      : '=> the DOM content is IDENTICAL: the swapped value has no effect on the page — most likely a false positive.');
  }
  printProps();
}

await main();
process.exit(0);
`;

    writeFileSync(filePath, content);
    return filePath;
  } catch (err) {
    log.warning(`writeReproductionScript failed (finding ${input.id} still recorded in the db): ${(err as Error).message}`);
    return undefined;
  }
}
