/**
 * Port of RAPIDOR's modules/HTTP/HTTPAnalyzer.js segment-extraction: given a captured request URL,
 * proposes every URL path segment and each query param as candidate "swap this value" targets.
 * No positional or shape heuristic: a candidate only produces requests if its value also appears
 * in the preindex (React state / JSON bodies), which already filters out static segments.
 */

export interface SegmentCandidate {
  value: string;
  parts: string[];   // spliceSegment inserts the replacement value at `index` and joins
  index: number;
  query?: string;     // original search string ("" or "?a=1"), re-attached after splicing a path candidate
  paramName?: string; // set only for query-param candidates: the key, needed by the client-routing fallback
  // Where the value sits in the URI, recorded on a finding for the paper's identifier-position figure
  // (Fig. 4). `indexFromRight` counts path segments from the right after stripping the extension
  // (`/api/lesson/42`: `42`=0, `lesson`=1); it is undefined for a query param (location 'query').
  location: 'path' | 'query';
  indexFromRight?: number;
}

/** Path-segment candidates (all of them) followed by query-param candidates. */
export function extractSegments({ url }: { url: string }): SegmentCandidate[] {
  const urlObj = new URL(url);
  const pathCandidates = getPathCandidates({ urlObj });
  const queryCandidates = getQueryCandidates({
    searchParams: urlObj.searchParams,
    fullPath: decodeURIComponent(urlObj.origin + urlObj.pathname),
    valuesToExclude: pathCandidates.map((c) => c.value),
  });
  return [...pathCandidates, ...queryCandidates];
}

function getPathCandidates({ urlObj }: { urlObj: URL }): SegmentCandidate[] {
  const pathname = urlObj.pathname;
  const hasTrailingSlash = pathname.endsWith('/');
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((_, idx) => getPropertyAt({ urlObj, segments, idx, hasTrailingSlash, query: urlObj.search }));
}

function getPropertyAt({ urlObj, segments, idx, hasTrailingSlash, query }: {
  urlObj: URL; segments: string[]; idx: number; hasTrailingSlash: boolean; query: string;
}): SegmentCandidate {
  const segment = segments[idx];

  const lastDot = segment.lastIndexOf('.');
  const hasExt = lastDot > 0;
  const value = hasExt ? segment.slice(0, lastDot) : segment;
  const ext = hasExt ? segment.slice(lastDot) : '';

  const before = segments.slice(0, idx);
  const after = segments.slice(idx + 1);
  const baseBefore = before.length ? `${before.join('/')}/` : '';
  const baseAfter = after.length ? `/${after.join('/')}` : '';

  const prefix = `${urlObj.origin}/${baseBefore}`;
  const suffix = (ext + baseAfter) + (hasTrailingSlash ? '/' : '');

  // index from the right among path segments (last = 0): the paper's Fig. 4 position signal
  return { parts: [prefix, suffix], value, index: 1, query, location: 'path', indexFromRight: after.length };
}

function getQueryCandidates({ searchParams, fullPath, valuesToExclude = [] }: {
  searchParams: URLSearchParams; fullPath: string; valuesToExclude?: string[];
}): SegmentCandidate[] {
  const result: SegmentCandidate[] = [];
  for (const [key, value] of searchParams) {
    if (['true', 'false', ...valuesToExclude].includes(value)) continue;
    result.push({ parts: [`${fullPath}?${key}=`], value, index: 1, paramName: key, location: 'query' });
  }
  return result;
}

/** Splices `value` into `parts` at `index` and joins; re-attaches `query` if the candidate carried one. */
export function spliceSegment({ parts, index, value, query }: { parts: string[]; index: number; value: string; query?: string }): string {
  const copy = [...parts];
  copy.splice(index, 0, value);
  return (copy.join('').trim()) + (query ?? '');
}

/**
 * The candidate URL for `segment` with `value` swapped in, keeping EVERYTHING ELSE in `url` intact.
 *
 * Use this, not `spliceSegment`, whenever the original URL is at hand. A query-param candidate's
 * `parts` is only `"<path>?<key>="`, so splicing it rebuilds the URL from scratch and silently DROPS
 * every other query param: busuu's `notifications?include_voice=1&limit=5` became `notifications?
 * limit=12538`, i.e. not "the same request with one value swapped" but a different request. Any
 * response difference caused by the missing param was then attributed to the swapped value — a
 * false-positive factory that also robbed `isIdenticalResponse` of its meaning. Setting the one param
 * on the real URL (what the client-routing path always did) keeps the comparison honest.
 *
 * A path-segment candidate still goes through `spliceSegment`, which re-attaches the original query
 * and is already correct for it.
 */
export function candidateUrlFor({ url, segment, value }: { url: string; segment: SegmentCandidate; value: string }): string {
  if (segment.paramName) {
    try {
      const withSwap = new URL(url);
      withSwap.searchParams.set(segment.paramName, value);
      return withSwap.href;
    } catch {
      // unparseable URL (never expected: callers got it from the DB after a round-trip through `new
      // URL`) — fall through to the positional splice rather than dropping the candidate
    }
  }
  return spliceSegment({ parts: segment.parts, index: segment.index, value, query: segment.query });
}
