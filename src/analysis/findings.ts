import { createHash } from 'node:crypto';
import type { findCandidates } from './matchFinder';
import type { SegmentCandidate } from './segments';

/**
 * Domain vocabulary shared by everything that produces or re-examines a finding: the pseudo-method
 * marking a client-only detection, the finding's dedup id, the URL canonical form the history filter
 * compares by, and the human-readable description of a swap. Deliberately NOT in `src/utils/utils.ts`:
 * each of these means something specific to IDOR findings, and a generic utils module that collects
 * domain concepts turns into a junk drawer.
 */

/** Marks a vulnerability/finding as tested purely client-side: no HTTP verb ever applied. */
export const CLIENT_ROUTING_METHOD = 'CLIENT';

/** Same dedup id RAPIDOR's responseEvaluator.js computes (sha256 of candidate value + node id + method + url). */
export function vulnerabilityId({ candidateValue, nodeId, method, url }: {
  candidateValue: string; nodeId: string; method: string; url: string;
}): string {
  return createHash('sha256').update(`current::${candidateValue}:nodeId:${nodeId}http::${method}:${url}`).digest('hex');
}

/**
 * Canonical form of a URL for the "is this already in the crawler's own history" check: origin +
 * decoded path (no trailing slash) + query params sorted by key (also decoded, so %20 and a literal
 * space compare equal). Query values are NOT sorted among themselves — a candidate differs from
 * history by its path or by one param's value, never by param order, so comparing by sorted keys
 * only would risk conflating two genuinely different URLs that happen to share key names.
 * Malformed input (never expected, since every caller already round-tripped it through `new URL`)
 * falls back to the raw string rather than throwing: a failed normalization should just miss this
 * optimization, not break the pipeline.
 */
/**
 * Volatile / cache-busting query params, stripped during canonicalization so two URLs differing ONLY
 * by such a token compare equal. `_rsc` is Next.js's React-Server-Components request token (changes
 * every navigation): not an object reference, so carrying it never crosses an authz boundary, but
 * leaving it in inflated the history filter, the finding dedup (promova flagged the same IDOR ~20
 * extra times, one per token) and the ablation's candidate dedup. A module const like preindex.ts's
 * PREINDEXED_KEYS — a framework fact, not a per-run setting. Canonicalization only: the FORGED request
 * still keeps the original's params, so an RSC request stays an RSC request and its response comparable.
 */
const VOLATILE_PARAMS = new Set(['_rsc']);

export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    for (const p of VOLATILE_PARAMS) url.searchParams.delete(p);
    const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    const search = params.map(([key, value]) => `${key}=${decodeURIComponent(value)}`).join('&');
    return `${url.origin}${path}${search ? `?${search}` : ''}`;
  } catch {
    return raw;
  }
}

/**
 * Human-readable description of which extracted segment produced a finding and how it was mutated:
 * the segment's location (a named query param, or a path segment) plus the original value swapped
 * for the sibling candidate value. Makes the warning say *why* two URLs are being compared, instead
 * of leaving the reader to diff the two URLs by eye to spot the one part that changed.
 */
export function describeExtractedSegment({ segment, candidate }: {
  segment: SegmentCandidate;
  candidate: ReturnType<typeof findCandidates>[number];
}): string {
  const location = segment.paramName ? `query param "${segment.paramName}"` : 'path segment';
  return `${location}: ${String(candidate.referenceValue)} -> ${candidate.candidateValue}`;
}
