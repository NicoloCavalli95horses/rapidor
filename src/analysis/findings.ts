import { createHash } from 'node:crypto';
import type { findCandidates } from './matchFinder';
import type { SegmentCandidate } from './segments';
import { tokenizeParamName } from '../utils/utils';

/**
 * Domain vocabulary shared by everything that produces or re-examines a finding: the pseudo-method
 * marking a client-only detection, the finding's dedup id, the URL canonical form the history filter
 * compares by, and the human-readable description of a swap. Deliberately NOT in `src/utils/utils.ts`:
 * each of these means something specific to IDOR findings, and a generic utils module that collects
 * domain concepts turns into a junk drawer.
 */

/** Marks a vulnerability/finding as tested purely client-side: no HTTP verb ever applied. */
export const CLIENT_ROUTING_METHOD = 'CLIENT';

/**
 * Semantic dedup id for a finding. The key is the SIBLING PAIR being swapped (stateId + refNodeId +
 * candNodeId + the swap path inside their props) scoped to the LAYER the leak was observed at
 * (candidateUrl's origin + method). Two findings with the same key describe the same IDOR on the same
 * surface — the same pair of React component instances, confirmed via the same layer — so they are
 * deduped (INSERT OR IGNORE wins to the first arrival).
 *
 * Why this key, not RAPIDOR's original `candidateValue + nodeId + method + url`: multiple carrier URLs
 * can embed the same reference value (promova's step id 73 appears in the page SSR flight, in a
 * backend API endpoint, and in a second plan's page URL — three carriers, one sibling pair). The old
 * key diverged on `url`, so the same sibling swap recorded three rows per sibling. Keeping origin+method
 * in the key preserves the auditor-visible distinction between layers (an API-backend leak is a
 * different vulnerability than a page-SSR leak which is different from a client-side-routing leak),
 * while the pair+path triple collapses noise within one layer (different plan carriers, different
 * cache-buster tokens — those surface the same leak on the same surface).
 *
 * `path` (the field inside the swapped node's props, e.g. `["lesson","id"]`) is included because the
 * same sibling pair could theoretically be matched from two different preindex values at two different
 * fields — keeping them distinct avoids collapsing semantically different swaps.
 *
 * CLIENT-ROUTING findings key on `clientSwap` instead: their identity is the SWAPPED SIBLING RESOURCE
 * (the candidate value) at its URL position (location + path-index/param-name), NOT the full route. This
 * is carrier-independent on purpose: lingualeo exposes the SAME premium training type at two scopes
 * (`/en/training/wordMix` and `/en/training/word_set/8/wordMix`) — same leaked capability, two word-set
 * contexts — and keying on the whole route counted them as two (9 types × 2 → 18). The swap identity
 * `wordMix|path|0` is identical across both, so they collapse to one (→ 9). The reference sites are
 * unchanged: there the swapped value is already the distinguishing identity and is unique per route
 * (ejoy lesson ids 1032..1035, promova step ids 76..84, pimsleur `?id`), so per-value and per-route
 * keys coincide — and "same lesson from two reference pages" still collapses because the value is the
 * same. Deterministic, unlike the live reactContentKey (a near-identical paywall shell for every locked
 * sibling). Was `clientRoute` (normalizeUrl(candidateUrl)); that under-collapsed lingualeo's scopes.
 */
export function vulnerabilityId({ site, origin, method, stateId, referenceNodeId, candidateNodeId, path, clientSwap }: {
  site: string; origin: string; method: string; stateId: number;
  referenceNodeId: string; candidateNodeId: string; path: (string | number)[]; clientSwap?: string;
}): string {
  if (method === CLIENT_ROUTING_METHOD && clientSwap !== undefined) {
    return createHash('sha256').update(`site::${site}:client-swap::${clientSwap}`).digest('hex');
  }
  return createHash('sha256').update(`site::${site}:origin::${origin}:method::${method}:state::${stateId}:ref::${referenceNodeId}:cand::${candidateNodeId}:path::${path.join('.')}`).digest('hex');
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
 * extra times, one per token) and the ablation's candidate dedup. Its value is a hash, so it is matched
 * by NAME; cache-buster TIMESTAMPS are matched by VALUE instead (see isVolatileParam) — far more robust
 * than a name list, since sites spell them differently (`_`, `ts`, `t`, promova's `tft`, …) and a fresh
 * value per XHR made the same endpoint look like thousands of distinct URLs (duolingo: 58k "unique" GET
 * URLs collapse to ~79 once stripped). A module const like preindex.ts's PREINDEXED_KEYS — a framework
 * fact, not a per-run setting. Canonicalization only: the FORGED request still keeps the original's
 * params, so an RSC request stays an RSC request and its response comparable.
 */
const VOLATILE_PARAM_NAMES = new Set(['_rsc']);

/**
 * An all-digits value that is an epoch timestamp — 10 digits in the seconds window or 13 in the
 * milliseconds window, both spanning ~2001–2033. A bare integer of exactly that length AND inside that
 * recent-epoch range is a cache-buster timestamp, never a resource id: DB ids are short, snowflake ids
 * are 18–19 digits, and no reference-corpus id falls in the window (verified across every site's query
 * values — the only hits are `_`/`ts`/`t`/`tft` cache-busters). Keeps canonicalization robust to
 * whatever a site names its cache-buster, where a fixed name list would miss it.
 */
function isEpochTimestamp(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const n = Number(value);
  if (value.length === 13) return n >= 1e12 && n < 2e12;   // epoch milliseconds
  if (value.length === 10) return n >= 1e9 && n < 2e9;     // epoch seconds
  return false;
}

// Identifier-like name tokens. A param whose name carries one of these names a RESOURCE, so its value
// is never treated as a volatile timestamp even when it happens to look like one (`id=1795251407832`
// is a real id, not a cache-buster) — the key disambiguates the value. A genuine cache-buster is never
// named with these words, so this costs no robustness (verified: the corpus's only epoch-valued params
// are `_`/`ts`/`t`/`tft`, none identifier-like).
const IDENTIFIER_NAME_TOKENS = new Set([
  'id', 'uid', 'uuid', 'guid', 'key', 'ref', 'token',
  'user', 'account', 'owner', 'customer', 'member', 'profile', 'sub',
]);

/** True when the param NAME looks like a resource identifier (protects its value from volatile-stripping). */
function isIdentifierParam(name: string): boolean {
  return tokenizeParamName(name).some((t) => IDENTIFIER_NAME_TOKENS.has(t));
}

/**
 * A query param that identifies no resource: a known volatile NAME, or a timestamp-shaped VALUE whose
 * NAME is not identifier-like (so a real `id` that happens to resemble an epoch is kept).
 */
function isVolatileParam({ name, value }: { name: string; value: string }): boolean {
  if (VOLATILE_PARAM_NAMES.has(name.toLowerCase())) return true;
  return isEpochTimestamp(value) && !isIdentifierParam(name);
}

export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    const params = [...url.searchParams.entries()]
      .filter(([name, value]) => !isVolatileParam({ name, value }))
      .sort(([a], [b]) => a.localeCompare(b));
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
