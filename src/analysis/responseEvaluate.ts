import { createHash } from 'node:crypto';
import type { ResponseLike } from './requestForge';

/**
 * Port of RAPIDOR's modules/analysis/responseEvaluator.js response-similarity check.
 * Threshold 0.45 is hardcoded in responseEvaluator.js's constructor — it is NOT config.sensitiveKeyThr
 * (that one is dead code, referenced nowhere in RAPIDOR outside its own declaration).
 */
const RESPONSE_SIMILARITY_THRESHOLD = 0.45;

export function checkIntSimilarity(a: number, b: number, thr = RESPONSE_SIMILARITY_THRESHOLD): boolean {
  if (a === 0 && b === 0) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return false;
  const ratio = b / a;
  return ratio >= thr && ratio <= 1 / thr;
}

/**
 * Deviation from RAPIDOR, deliberate: responseEvaluator.js's areFieldsEqual compares `headers` with
 * `!==`, i.e. object identity — two freshly-built header objects are never `===`, so that check is
 * either always-false (fetch-originated traffic, breaking detection) or a string compare that only
 * works by accident (XHR's getAllResponseHeaders() returns one string). We compare status and
 * content-type instead, which is what "the server treated this like the same kind of resource"
 * actually means; a full raw-header comparison would almost always fail anyway (two distinct
 * requests rarely share identical `date`/`etag`/`set-cookie` values even on a real IDOR hit).
 */
export function areFieldsEqual(reference: ResponseLike, candidate: ResponseLike): { areEqual: boolean; fields: string[] } {
  const fields = ['status', 'contentType'];
  const areEqual = reference.status === candidate.status && (reference.contentType ?? '') === (candidate.contentType ?? '');
  return { areEqual, fields };
}

function topLevelKeyCount(body: string): number {
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length;
  } catch {
    // not JSON (HTML, an RSC payload, plain text, ...): treated as shapeless, see getServerResponseSimilarity
  }
  return 0;
}

export interface ResponseSimilarity {
  areSimilar: boolean;
  fields: { areEqual: boolean; fields: string[] };
  bodyLength: { refLen: number; candLen: number; isSimilar: boolean; threshold: number };
  bodyShape: { refKeys: number; candKeys: number; isSimilar: boolean; threshold: number };
}

/**
 * Length of a captured body, falling back to the content-length header when the body text itself
 * isn't available. That happens for a response whose stream was cancelled client-side after the
 * page read what it needed (observed with Next.js's RSC router) — Chrome never buffers such a body
 * for CDP to read back, but the status/headers (and the server's own declared content-length) did
 * arrive. Returns undefined when there's truly nothing to measure.
 */
function bodyLengthOf(response: ResponseLike): number | undefined {
  if (response.body) return Buffer.byteLength(response.body);
  const declared = Number(response.headers['content-length']);
  return Number.isFinite(declared) && declared >= 0 ? declared : undefined;
}

export function getServerResponseSimilarity(reference: ResponseLike, candidate: ResponseLike): ResponseSimilarity {
  const fields = areFieldsEqual(reference, candidate);

  const refLen = bodyLengthOf(reference);
  const candLen = bodyLengthOf(candidate);
  // missing on either side: inconclusive, not a mismatch (nothing to compare against)
  const isBodyLengthSimilar = refLen === undefined || candLen === undefined || checkIntSimilarity(refLen, candLen);

  // body shape needs the actual text (to parse as JSON): also inconclusive -> similar when absent
  const refKeys = reference.body ? topLevelKeyCount(reference.body) : undefined;
  const candKeys = candidate.body ? topLevelKeyCount(candidate.body) : undefined;
  const isBodyShapeSimilar = refKeys === undefined || candKeys === undefined || checkIntSimilarity(refKeys, candKeys);

  return {
    areSimilar: fields.areEqual && isBodyLengthSimilar && isBodyShapeSimilar,
    fields,
    bodyLength: { refLen: refLen ?? 0, candLen: candLen ?? 0, isSimilar: isBodyLengthSimilar, threshold: RESPONSE_SIMILARITY_THRESHOLD },
    bodyShape: { refKeys: refKeys ?? 0, candKeys: candKeys ?? 0, isSimilar: isBodyShapeSimilar, threshold: RESPONSE_SIMILARITY_THRESHOLD },
  };
}

export interface PropDiff {
  path: (string | number)[];
  pathStr: string;
  key: string | number;
  reference: unknown;
  current: unknown;
}

function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deviation from RAPIDOR's own responseEvaluator.js, deliberate: the original treats arrays as opaque
 * leaves (the whole array becomes a single diff entry whenever anything inside it differs, so a
 * sensitive field buried inside an array element is never surfaced to the authz classifier on its
 * own). Recursing into arrays index-wise closes that gap for both the React-informed pipeline and the
 * JSON-only ablation — exactly the point of the ablation study: give the HTTP-only analysis every
 * tool the React-informed one has, so a difference in results reflects a real difference in signal
 * (React state vs. JSON alone), not an avoidable blind spot in the shared oracle. Index-wise means
 * position N on one side is compared against position N on the other: for two JSON responses
 * describing "the same kind of object, parameterized differently" (the only case this pipeline ever
 * diffs), array order is stable across requests, so this is the right alignment — it is not a
 * general-purpose array diff (no reordering/LCS detection).
 */
export function compareObj(a: unknown, b: unknown): PropDiff[] {
  const visited = new WeakSet<object>();
  const diffs: PropDiff[] = [];

  function compare(x: unknown, y: unknown, path: (string | number)[] = []): void {
    if (x === y) return;
    if (typeof x !== typeof y || Array.isArray(x) !== Array.isArray(y) || (!Array.isArray(x) && !isPlainObject(x)) || (!Array.isArray(y) && !isPlainObject(y))) {
      const key = path.length ? path[path.length - 1] : '';
      diffs.push({ path, reference: x, current: y, key, pathStr: path.join('.') });
      return;
    }
    if (visited.has(x as object) || visited.has(y as object)) return;
    visited.add(x as object);
    visited.add(y as object);

    if (Array.isArray(x) && Array.isArray(y)) {
      const length = Math.max(x.length, y.length);
      for (let i = 0; i < length; i++) {
        compare(x[i], y[i], [...path, i]);
      }
      return;
    }

    const keys = new Set([...Object.keys(x as object), ...Object.keys(y as object)]);
    for (const key of keys) {
      compare((x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key], [...path, key]);
    }
  }

  compare(a, b);
  return diffs;
}

/**
 * Restricts a node's prop diffs to those belonging to the SWAPPED RESOURCE — the subtree rooted at the
 * swapped value's parent object. `swapPath` is the preindex/match path of the swapped value (relative to
 * the React node, so it may lead with "props"; a JSON-ablation path has no such prefix). A diff is kept
 * iff its path lies under `parent(swapPath)`; a top-level swap (parent is the root) keeps every diff.
 *
 * This is what stops a whole-component swap (a nav/sidebar/layout sibling) from passing the authz gate on
 * a GENERIC key that sits elsewhere in the component, far from the swapped id — ejoy's `37 → 45` swaps a
 * menu item's `items.0.id` yet "passed" on the top-level `user` object. Scoping to `items.0` drops `user`.
 * A real entitlement is a sibling of (or nested within) the swapped resource and survives: ejoy's
 * `lesson.lock` under the swapped `lesson.id`, pimsleur's `miniLesson.isFree` under `miniLesson.id`. A
 * swap whose id is itself top-level (busuu's `id`, lingualeo's `id`) keeps every diff, so nothing is lost.
 */
export function scopeDiffsToResource({ differences, swapPath }: {
  differences: PropDiff[]; swapPath: (string | number)[];
}): PropDiff[] {
  const rel = swapPath[0] === 'props' ? swapPath.slice(1) : swapPath;   // compareObj paths are relative to props
  const prefix = rel.slice(0, -1);                                      // the resource object: the swapped value's parent
  if (prefix.length === 0) return differences;                         // top-level swap: no resource subtree to scope to
  return differences.filter((d) => prefix.every((seg, i) => d.path[i] === seg));
}

/**
 * Drops the diff AT the swap path — the identifier being swapped. It differs by construction, so it can
 * never be its own entitlement evidence: duolingo's `href: "account" -> "privacy"` passed the gate only
 * because the swapped VALUE read like an authz term. The signal must come from ANOTHER property
 * (`lesson.lock` beside `lesson.id`). Verified offline on every stored finding: only that FP lost its keys.
 */
export function excludeSwapDiff({ differences, swapPath }: {
  differences: PropDiff[]; swapPath: (string | number)[];
}): PropDiff[] {
  const rel = swapPath[0] === 'props' ? swapPath.slice(1) : swapPath;   // compareObj paths are relative to props
  return differences.filter((d) => d.path.length !== rel.length || d.path.some((seg, i) => String(seg) !== String(rel[i])));
}

/** Human-readable "which props differ and how", for the vulnerabilities table's `motivation` column. */
export function describeDiffs(differences: PropDiff[]): string {
  if (differences.length === 0) return '(no prop differences)';
  return differences
    .map((d) => `${d.pathStr || '(root)'}: ${JSON.stringify(d.reference)} -> ${JSON.stringify(d.current)}`)
    .join('; ');
}

/**
 * Did the forged request get back exactly the response the original one did? Then the server
 * ignored the swapped value (a tracking/cohort param, a value only the client reads), so the forge
 * leaked nothing, however "similar" getServerResponseSimilarity calls the two. Observed on busuu:
 * `checkout.json?price_id=A -> price_id=B` returned a byte-identical 65 KB Next.js data payload (the
 * plan is resolved client-side, not from that param), yet was flagged as an HTTP finding because the
 * React props of the two sibling plans differ. Compared as exact text, or as deep-equal JSON (key
 * order and whitespace do not matter). False (not provably identical) when either body is missing —
 * e.g. a cancelled stream Chrome never buffered — so this can only ever drop a finding on evidence.
 */
export function isIdenticalResponse({ reference, candidate }: { reference: ResponseLike; candidate: ResponseLike }): boolean {
  if (!reference.body || !candidate.body) return false;
  if (reference.status !== candidate.status) return false;
  if (reference.body === candidate.body) return true;
  try {
    return compareObj(JSON.parse(reference.body), JSON.parse(candidate.body)).length === 0;
  } catch {
    return false;
  }
}

/**
 * A canonical identity for a response's CONTENT, so the HTTP detection path can recognise two
 * responses that `isIdenticalResponse` would call equal as THE SAME response — both across candidates
 * (two swaps that forge the same payload are one leak) and against the crawler's already-collected
 * http_events (a forge that returns data the user can already reach is not a leak). It folds in the
 * status and canonicalises the body exactly the way isIdenticalResponse compares it: the raw text for
 * a non-JSON body, or a key-order-independent serialisation for JSON (so `{a,b}` and `{b,a}` collapse
 * to one key). Returns undefined when there is no body to key on, so a caller keeps the finding —
 * mirroring isIdenticalResponse returning false on a missing body: these guards only ever drop on
 * positive evidence, never fabricate a drop.
 */
export function canonicalResponseKey({ status, body }: { status: number; body: string }): string | undefined {
  if (!body) return undefined;
  let canonical: string;
  try {
    canonical = `json:${stableStringify(JSON.parse(body))}`;
  } catch {
    canonical = `raw:${body}`;
  }
  return createHash('sha256').update(`${status}\n${canonical}`).digest('hex');
}

// Metadata keys whose scalar value is bookkeeping, not content (a count/pagination/status field): when
// everything else in a response is empty, a `total: 0` / `success: true` alongside does not make it a
// data leak. Deliberately narrow — an id/name/title/slug is NOT here, so a real record is never "empty".
const METADATA_KEY = /^(total|count|total_count|totalcount|total_pages|totalpages|size|page|per_page|perpage|offset|limit|length|num|status|code|success|ok|error|message)$/i;

/**
 * Whether a forged JSON response carries NO actual data — an empty object/array, or a wrapper whose only
 * payload arrays are empty (ejoy's `search-new` returning `{"data":{"data":[],"total":0}}` for a mutated
 * param). Such a response leaks nothing, so it is never an access-control finding, however much it
 * "differs" from the reference. A non-JSON body, or any body with a real content leaf (a string, or a
 * scalar under a non-metadata key like `id`/`title`), is NOT empty. Drops only on positive evidence of
 * emptiness: an unparseable body returns false (kept), mirroring the other content guards.
 */
export function isEmptyJsonResponse({ body }: { body: string }): boolean {
  if (!body) return false;
  let json: unknown;
  try { json = JSON.parse(body); } catch { return false; }
  return isEmptyData(json);
}

/**
 * Whether a forged JSON response is an ERROR ENVELOPE despite a 200 — the server treated the request as a
 * denial/failure but answered 200 anyway (apps that don't follow HTTP-status best practices, e.g. Mondly's
 * `{"error":true}`). Unlike isEmptyJsonResponse, which fires only when the WHOLE body is empty/metadata,
 * this fires even when real-looking fields sit ALONGSIDE the flag (an `errorCode`/`requestId` next to
 * `error:true` is still an error, not a leak). TOP-LEVEL only: a nested `error` buried inside a genuine
 * resource is content, not an envelope, so it must not trigger. Signals: a truthy top-level `error`
 * (boolean true, non-zero number, non-empty string/object), `success:false`/`ok:false`, or a top-level
 * `status` of "error"/"fail"/"failure". Drops only on positive evidence: a non-object/non-JSON body
 * returns false (kept), same conservative stance as the other content guards.
 */
export function isErrorEnvelopeResponse({ body }: { body: string }): boolean {
  if (!body) return false;
  let json: unknown;
  try { json = JSON.parse(body); } catch { return false; }
  if (!isPlainObject(json)) return false;
  const obj = json as Record<string, unknown>;
  const truthyError = (v: unknown): boolean =>
    v === true ||
    (typeof v === 'number' && v !== 0) ||
    (typeof v === 'string' && v.trim().length > 0) ||
    (isPlainObject(v) && Object.keys(v as object).length > 0);
  if (truthyError(obj.error)) return true;
  if (obj.success === false || obj.ok === false) return true;
  if (typeof obj.status === 'string' && /^(error|fail|failure)$/i.test(obj.status.trim())) return true;
  return false;
}

function isEmptyData(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.every(isEmptyData);
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    // empty object, or every field is itself empty / a known metadata scalar
    return entries.every(([k, val]) => isEmptyData(val) || METADATA_KEY.test(k));
  }
  if (typeof v === 'string') return v.length === 0;
  return false;   // a number/boolean under a non-metadata key is content (an id, a flag that matters)
}

/** Deterministic JSON serialisation with object keys sorted, so two deep-equal values stringify identically. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
