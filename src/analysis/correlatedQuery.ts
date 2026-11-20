import { urlEmbedsValue } from '../utils/utils';

/**
 * Rewrites a path-swap candidate's query so it carries the SIBLING's own correlated values, not the
 * reference's stale ones. The motivating case is ejoy: a lesson is addressed by `/courses/37/314/<id>`
 * AND by an opaque per-lesson capability in `?path=cp/.../lessons/<id>/<hash>.json`. Swapping only the
 * path segment (`1030 -> 1032`) leaves `?path=` pointing at the ORIGINAL lesson, an incoherent url. But
 * the free user's React state carries EVERY lesson's own `path` (hash included) on its sibling node —
 * including the paid ones (`lock:true`). So when a query value equals a leaf of the reference node, we
 * substitute the SAME leaf from the candidate (sibling) node, building the coherent sibling url — the
 * leaked-capability IDOR RAPIDOR exists to forge.
 *
 * Precise, to avoid coincidental matches: a query param is rewritten only when its value both EMBEDS the
 * swapped segment value (so it actually carries a copy of the id being swapped) AND is found verbatim as
 * a leaf of the reference node whose counterpart on the candidate node differs. Pure; returns the url
 * unchanged when nothing correlates.
 */
export function rewriteCorrelatedQuery({ url, referenceValue, referenceProps, candidateProps }: {
  url: string; referenceValue: string; referenceProps: unknown; candidateProps: unknown;
}): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  let changed = false;
  for (const [key, value] of [...u.searchParams]) {
    if (!urlEmbedsValue(value, referenceValue)) continue;      // only a query that carries a copy of the swapped id
    const path = findLeafPath(referenceProps, value);
    if (!path) continue;
    const replacement = readLeafAtPath(candidateProps, path);
    if (typeof replacement === 'string' && replacement !== value) {
      u.searchParams.set(key, replacement);
      changed = true;
    }
  }
  return changed ? u.href : url;
}

/** DFS for the first leaf (object/array walked) whose string form equals `value`; returns its path. */
function findLeafPath(obj: unknown, value: string, path: (string | number)[] = [], depth = 0): (string | number)[] | undefined {
  if (depth > 12) return undefined;   // props trees are shallow; bound against anything pathological
  if (obj === null || typeof obj !== 'object') return String(obj) === value ? path : undefined;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const r = findLeafPath(obj[i], value, [...path, i], depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const r = findLeafPath(v, value, [...path, k], depth + 1);
    if (r) return r;
  }
  return undefined;
}

/** Follows `path` into `obj`, returning the leaf (or undefined if the shape diverged). */
function readLeafAtPath(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[seg];
  }
  return cur;
}
