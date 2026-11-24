/**
 * The HTTP-only counterpart of matchFinder.ts, for the ablation study (see AblationPipeline's own
 * doc comment): instead of walking a RAPIDOR React graph's `componentIndex` to find sibling
 * component instances, this walks JSON HTTP response bodies to find sibling OBJECTS and diffs them
 * the same way. `readPath`/`diffValue` are reused verbatim from matchFinder.ts: both are already
 * pure value-walkers with no React dependency at all.
 */
import { isInteresting, tokenize } from './preindex';
import { readPath, diffValue } from './matchFinder';

// Safety bound against a pathological JSON body (e.g. a deeply recursive structure); real API
// payloads are almost always shallow, so this is far more generous than preindex.ts's React-graph
// bound (MAX_DEPTH=4). Kept as a depth cap for the same reason React keeps one (not a performance
// lever once matching goes through buildJsonPreindex below — each body is still walked only once).
const MAX_DEPTH = 8;

interface InterestingLeaf {
  value: string;
  path: (string | number)[];
}

/** Walks `root` ONCE collecting every "interesting" leaf (same rule as preindex.ts's isInteresting),
 * regardless of its value — shared by findJsonMatches (filters to one value) and buildJsonPreindex
 * (keeps all of them, grouped by value, across every body in one site's corpus). */
function collectInterestingLeaves({ root }: { root: unknown }): InterestingLeaf[] {
  const rows: InterestingLeaf[] = [];
  const stack: { v: unknown; path: (string | number)[]; key?: string | number }[] = [{ v: root, path: [] }];
  while (stack.length) {
    const { v, path, key } = stack.pop()!;
    if (path.length > MAX_DEPTH) continue;
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) stack.push({ v: v[i], path: [...path, i], key: i });
    } else if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [k, val] = entries[i];
        stack.push({ v: val, path: [...path, k], key: k });
      }
    } else if (isInteresting(key, v)) {
      for (const token of tokenize(String(v))) rows.push({ value: token, path });
    }
  }
  return rows;
}

export interface JsonMatch {
  path: (string | number)[];
}

/** Finds every leaf in `root` whose tokenized value includes `value` — single-body lookup, kept for
 * direct use/testing. AblationPipeline itself uses buildJsonPreindex below instead, to search a
 * value against every captured body at once rather than one body at a time. */
export function findJsonMatches({ root, value }: { root: unknown; value: string }): JsonMatch[] {
  return collectInterestingLeaves({ root })
    .filter((row) => row.value === value)
    .map((row) => ({ path: row.path }));
}

export interface JsonPreindexHit {
  bodyIndex: number;      // index into the SAME `bodies` array the caller passed in
  path: (string | number)[];
}

/**
 * Builds a value -> hits index across every body in `bodies` (one entry per already-captured HTTP
 * response; `undefined` for a non-JSON/unparseable one, skipped), each body walked exactly once —
 * the JSON analog of PreindexedValueStore.reindex. Lets a URL segment be looked up against the
 * WHOLE corpus in O(1) instead of being re-walked body-by-body: the id a request's own URL carries
 * is often only ever RETURNED, alongside its siblings, by a completely different endpoint (a
 * list/listing call), not by the per-item endpoint whose own URL happens to contain it — see
 * AblationPipeline's own doc comment for why this matters.
 *
 * Scope is entirely the caller's responsibility: this function has no notion of "site" at all, it
 * only ever sees the exact bodies it's given — AblationPipeline builds it from ONE site's own
 * http_events, never mixing JSON captured from a different site into the same index.
 */
export function buildJsonPreindex({ bodies }: { bodies: unknown[] }): Map<string, JsonPreindexHit[]> {
  const index = new Map<string, JsonPreindexHit[]>();
  bodies.forEach((root, bodyIndex) => {
    if (root === undefined) return;
    for (const { value, path } of collectInterestingLeaves({ root })) {
      const hits = index.get(value);
      if (hits) hits.push({ bodyIndex, path });
      else index.set(value, [{ bodyIndex, path }]);
    }
  });
  return index;
}

export interface JsonCandidate {
  referencePath: (string | number)[];
  candidatePath: (string | number)[];
  referenceValue: unknown;
  candidateValue: string;
  referenceProps: unknown;   // the sibling object itself, for compareObj — same role as a React node's `props`
  candidateProps: unknown;
}

interface ArrayAncestor {
  array: unknown[];
  arrayPath: (string | number)[];
  itemIndex: number;
  relPath: (string | number)[];
}

/**
 * Every enclosing array along `path` within `root`, innermost first — not just the nearest one.
 * Each is the JSON idiom for "multiple instances of the same kind of entity" at ITS level of
 * nesting, playing the role RAPIDOR's componentIndex plays for React nodes. A nested path like
 * results[0].lessons[0].content[0].lesson.id has THREE: content (innermost), lessons, results.
 */
function findAllArrayAncestors({ root, path }: { root: unknown; path: (string | number)[] }): ArrayAncestor[] {
  const ancestors: ArrayAncestor[] = [];
  for (let i = path.length - 1; i >= 0; i--) {
    if (typeof path[i] !== 'number') continue;
    const arrayPath = path.slice(0, i);
    const candidate = readPath(root, arrayPath);
    if (Array.isArray(candidate)) {
      ancestors.push({ array: candidate, arrayPath, itemIndex: path[i] as number, relPath: path.slice(i + 1) });
    }
  }
  return ancestors;
}

/**
 * Given a match (a leaf at `path` inside `root`'s JSON tree), finds sibling objects at EVERY
 * enclosing array level — mirrors matchFinder.ts's findCandidates, substituting "other array index,
 * at any nesting level" for "other componentIndex instance". Each level is varied independently,
 * holding every other index in the path fixed at its reference value — deliberately NOT a full
 * combinatorial walk (e.g. never tries results[1].lessons[1] together): changing exactly one
 * position at a time keeps the diff/authz oracle unambiguous about which change produced an
 * authz-relevant difference, the same "swap exactly one thing" principle an IDOR test itself relies
 * on. No siblings at all (empty result) when the matched leaf isn't inside any array.
 */
export function findJsonCandidates({ root, path, matchedValue }: {
  root: unknown; path: (string | number)[];
  matchedValue?: string;   // same positional rule as the main pipeline (see matchFinder.diffValue)
}): JsonCandidate[] {
  const candidates: JsonCandidate[] = [];
  const seenCandidatePaths = new Set<string>();

  for (const { array, arrayPath, itemIndex, relPath } of findAllArrayAncestors({ root, path })) {
    const referenceItem = array[itemIndex];
    const referenceRaw = readPath(referenceItem, relPath);
    if (referenceRaw == null) continue;

    for (let i = 0; i < array.length; i++) {
      if (i === itemIndex) continue;
      const candidateItem = array[i];
      const candidateRaw = readPath(candidateItem, relPath);
      const candidateValue = diffValue({ candidateRaw, referenceRaw, matchedValue });
      if (candidateValue === undefined) continue;

      const candidatePath = [...arrayPath, i, ...relPath];
      const dedupeKey = JSON.stringify(candidatePath);
      if (seenCandidatePaths.has(dedupeKey)) continue; // different levels could in principle agree on a path
      seenCandidatePaths.add(dedupeKey);

      candidates.push({
        referencePath: [...arrayPath, itemIndex, ...relPath], candidatePath,
        referenceValue: referenceRaw, candidateValue,
        referenceProps: referenceItem, candidateProps: candidateItem,
      });
    }
  }
  return candidates;
}
