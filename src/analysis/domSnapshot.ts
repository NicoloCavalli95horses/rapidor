import type { Page } from 'playwright';

/**
 * Normalized DOM snapshot of a rendered route: the content signal the client-routing guards compare
 * (inert value, not-found page), replacing the old pixel screenshot diff. A screenshot only sees the
 * viewport, depends on fonts/images actually loading (lightweightMode replaces them with placeholders,
 * so another user's avatar renders as the same grey box) and cannot tell "nothing changed" from "one
 * short string changed" (another user's name is a few dozen pixels). The DOM sees the whole page,
 * hidden content included, independently of rendering.
 *
 * What is kept, and why only this:
 * - every TEXT node (whitespace-collapsed), keyed by its structural path — the data a leak exposes;
 * - the `src` of every <img> — the one attribute that carries user data on its own (an avatar, a
 *   private document's thumbnail) and whose difference the placeholder-ized render hides;
 * - the number of elements — a structural change with no text (an extra row of icons, a badge).
 * Everything else (classes, inline styles, ids, data-*, meta, hrefs) is dropped: it is dominated by
 * framework noise (generated class names, React useId values, animation styles) and, for hrefs, by
 * the swapped value merely being reflected into links. <script>/<style>/<noscript>/<template> are
 * skipped entirely: Next.js's __NEXT_DATA__, for one, embeds the current query, so it would differ for
 * every value.
 *
 * Paths are XPath-like with a per-tag index (`body/div[1]/span[0]/#0`): an inserted sibling of a
 * different tag does not shift the others, so a local change stays local in the diff.
 */
export interface DomSnapshot {
  nodeCount: number;
  // structural path -> normalized text (or an <img>'s src, under `<path>@src`)
  texts: Record<string, string>;
}

/**
 * Hand-written JS source, evaluated as a string (not a TS function literal): tsx/esbuild inject
 * `__name(...)` helper calls into compiled functions, which do not exist inside the page — same
 * reason as clientRouting.ts's WAIT_DOM_IDLE_SRC.
 */
const SNAPSHOT_SRC = `(() => {
  const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  const texts = {};
  let nodeCount = 0;
  function walk(el, path) {
    const tagIdx = {};
    let textIdx = 0;
    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        const t = (child.nodeValue || '').replace(/\\s+/g, ' ').trim();
        if (t) texts[path + '/#' + (textIdx++)] = t;
      } else if (child.nodeType === 1) {
        if (SKIP[child.tagName]) continue;
        nodeCount++;
        const tag = child.tagName.toLowerCase();
        const i = tagIdx[tag] = (tagIdx[tag] === undefined ? 0 : tagIdx[tag] + 1);
        const p = path + '/' + tag + '[' + i + ']';
        if (tag === 'img') {
          const src = child.getAttribute('src');
          if (src) texts[p + '@src'] = src;
        }
        walk(child, p);
      }
    }
  }
  if (document.body) walk(document.body, 'body');
  return { nodeCount: nodeCount, texts: texts };
})()`;

/** Snapshot of the page as it is right now. Throws if the page is gone (callers decide how to degrade). */
export async function readDomSnapshot({ page }: { page: Page }): Promise<DomSnapshot> {
  return page.evaluate(SNAPSHOT_SRC) as Promise<DomSnapshot>;
}

/**
 * Snapshot of what `testUrl` actually renders, reached by a REAL navigation (page.goto), then a
 * settle. This is the content guard's oracle, and it must be a real load, not a pushState: a Next.js
 * (or any SSR) route produces its content from a server data fetch that only runs on navigation, so a
 * pushState+popstate to the candidate URL leaves the previous route's content in place and every
 * candidate looks "identical to the reference" (the lingualeo `/en/training/<type>` false negative:
 * savannah vs repetition differ by 96 text nodes on a real load, by zero under pushState). Reaching
 * the candidate the way a user actually would — navigating to the URL — is also exactly the IDOR we
 * test for. Best-effort: a failed/blocked navigation, a closed page, anything, yields undefined rather
 * than throwing, so a capture failure can never abort the analysis. The not-found guard's own 4xx is
 * still caught: goto resolves for a 4xx (its DOM is the not-found page), it does not reject.
 */
export async function captureRouteByNavigation({ page, testUrl, settleMs = 1_500 }: {
  page: Page; testUrl: string; settleMs?: number;
}): Promise<DomSnapshot | undefined> {
  try {
    await page.goto(testUrl, { waitUntil: 'load', timeout: 30_000 });
    // Wait for the route's own data fetch to finish before snapshotting: a fetch-gated route (pimsleur
    // loads each lesson by id through an XHR) has `load` fire on the shell while the real content is
    // still coming, and a fixed settle alone would catch the shell (or a cookie wall). Best-effort and
    // bounded — a page that never goes idle (polling, a persistent socket) just falls through to the
    // fixed settle rather than stalling the analysis.
    await page.waitForLoadState('networkidle', { timeout: settleMs * 3 }).catch(() => undefined);
    await page.waitForTimeout(settleMs);
    return await readDomSnapshot({ page });
  } catch {
    return undefined;
  }
}

/**
 * Snapshot of the SPA rendered at `testUrl`, reached the same way the client-routing PROBE reaches a
 * candidate: a pushState + synthetic popstate (no real reload), then a settle; the URL is rolled back
 * afterwards. Used where staying in the SPA without a reload is the point (reproduction scripts); the
 * content guard uses captureRouteByNavigation instead, see its doc comment. Best-effort: any failure
 * yields undefined rather than throwing.
 */
export async function captureDomSnapshot({ page, testUrl, settleMs = 1_500 }: {
  page: Page; testUrl: string; settleMs?: number;
}): Promise<DomSnapshot | undefined> {
  const originalUrl = safeUrl(page);
  const navigate = (url: string): Promise<void> =>
    page.evaluate((u) => {
      window.history.pushState({ ignore: true }, '', u);
      window.dispatchEvent(new Event('popstate'));
    }, url);
  try {
    await navigate(testUrl);
    // Same reason as captureRouteByNavigation: a client-routed view whose content arrives through a
    // fetch (the app requests the new route's data on popstate, then renders it) is not settled while
    // that request is in flight. Wait for the network to go quiet first, bounded and best-effort.
    await page.waitForLoadState('networkidle', { timeout: settleMs * 3 }).catch(() => undefined);
    await page.waitForTimeout(settleMs);
    return await readDomSnapshot({ page });
  } catch {
    return undefined;
  } finally {
    // put the URL back so the next probe/capture starts from the page it expects
    if (originalUrl) await navigate(originalUrl).catch(() => undefined);
  }
}

/**
 * Values shorter than this are not masked: a 1–2 character value ("1", "en") collides with incidental
 * text (counts, prices, labels), and masking it on one side only would hide a genuine "1 item" vs
 * "2 items" difference exactly when the two values happen to be 1 and 2.
 */
const MIN_MASK_LENGTH = 3;
const MASK = '⟨value⟩';

/**
 * The snapshot with every whole-token occurrence of `value` (not preceded/followed by a letter or
 * digit — the same boundary idea as clientRouting's urlCarriesValue) replaced by a fixed mask. A page
 * that merely ECHOES the id it was given ("Order 1042", an <img> whose src carries it) differs from
 * its sibling's render only by that echo, which is not data the user could not already see: each side
 * is masked with its own value, so such an echo compares equal.
 */
export function maskValue({ snapshot, value }: { snapshot: DomSnapshot; value: string }): DomSnapshot {
  if (value.length < MIN_MASK_LENGTH) return snapshot;
  const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(value)}(?![A-Za-z0-9])`, 'g');
  const texts: Record<string, string> = {};
  for (const [key, text] of Object.entries(snapshot.texts)) texts[key] = text.replace(re, MASK);
  return { nodeCount: snapshot.nodeCount, texts };
}

/**
 * Self-noise of a route: what differs between two renders of the SAME url (a countdown, a carousel,
 * randomized quiz words, an A/B slot). Keyed by path, not by text, so a ticking clock is noise at
 * whatever value it shows next. A diff ignores these paths and tolerates this much node-count drift.
 * The two renders must bracket a real remount (AnalysisPipeline captures reference -> candidate ->
 * reference): two back-to-back captures of one URL never remount the route and see no noise.
 *
 * `candidate`, when given, excludes a path where `b` shows exactly the candidate's text: that is a
 * stale render (the app did not re-render back to the reference), not noise, and treating it as noise
 * would hide precisely the nodes where the candidate's data appears.
 */
export interface DomNoise {
  keys: Set<string>;
  nodeDelta: number;
}

export function domNoise({ a, b, candidate }: { a: DomSnapshot; b: DomSnapshot; candidate?: DomSnapshot }): DomNoise {
  const keys = changedKeys({ a, b }).filter((k) => !candidate || b.texts[k] === undefined || b.texts[k] !== candidate.texts[k]);
  return { keys: new Set(keys), nodeDelta: Math.abs(a.nodeCount - b.nodeCount) };
}

export const NO_NOISE: DomNoise = { keys: new Set(), nodeDelta: 0 };

export interface DomDiff {
  // paths whose text differs or exists on one side only, noise excluded, with both sides' text
  changed: { key: string; a?: string; b?: string }[];
  // changed / union of non-noise paths (0 = same text everywhere, 1 = nothing in common)
  textFraction: number;
  // node-count difference beyond the noise tolerance, absolute and relative to the larger count
  nodeDelta: number;
  nodeFraction: number;
}

export function diffDomSnapshots({ a, b, noise = NO_NOISE }: { a: DomSnapshot; b: DomSnapshot; noise?: DomNoise }): DomDiff {
  const union = new Set([...Object.keys(a.texts), ...Object.keys(b.texts)].filter((k) => !noise.keys.has(k)));
  const changed = changedKeys({ a, b })
    .filter((key) => !noise.keys.has(key))
    .map((key) => ({ key, a: a.texts[key], b: b.texts[key] }));
  const nodeDelta = Math.max(0, Math.abs(a.nodeCount - b.nodeCount) - noise.nodeDelta);
  const maxNodes = Math.max(a.nodeCount, b.nodeCount);
  return {
    changed,
    textFraction: union.size === 0 ? 0 : changed.length / union.size,
    nodeDelta,
    nodeFraction: maxNodes === 0 ? 0 : nodeDelta / maxNodes,
  };
}

function changedKeys({ a, b }: { a: DomSnapshot; b: DomSnapshot }): string[] {
  const keys = new Set([...Object.keys(a.texts), ...Object.keys(b.texts)]);
  return [...keys].filter((k) => a.texts[k] !== b.texts[k]);
}

/**
 * A same-shaped but (almost certainly) non-existent replacement for an id: keeps every separator and
 * the overall length/segment position, randomizing only the alphanumeric characters. Rendered in the
 * candidate's own route slot it makes the app produce its genuine "not found" page, which is exactly
 * the baseline a real candidate's render is compared against.
 */
export function makeGarbageValue(sample: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return sample.replace(/[A-Za-z0-9]/g, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** page.url() without throwing (a closed/navigating page can still reject here on some builds). */
function safeUrl(page: Page): string {
  try {
    return page.url();
  } catch {
    return '';
  }
}
