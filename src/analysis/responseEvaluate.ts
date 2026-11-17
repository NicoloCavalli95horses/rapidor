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
