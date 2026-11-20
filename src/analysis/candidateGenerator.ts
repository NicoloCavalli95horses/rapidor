import { log } from 'crawlee';
import type { PreindexedValueStore } from '../db/PreindexedValueStore';
import type { ReactStateStore, RapidorGraph } from '../db/ReactStateStore';
import { findCandidates } from './matchFinder';
import { extractSegments, type SegmentCandidate } from './segments';

/**
 * Split a query-param NAME into lowercase tokens across camelCase, snake_case, kebab and letter/digit
 * boundaries, so `maxLevel` / `max_level` / `MaxLevel` all yield `['max','level']`. Used to blacklist a
 * param whose NAME merely CONTAINS a pagination/bound word (`maxLevel`, `minScore`, `pageSize`), not only
 * one that equals it exactly.
 */
export function tokenizeParamName(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')                                        // camelCase boundary
    .split(/[^a-zA-Z0-9]+/)                                                         // snake / kebab / other separators
    .flatMap((s) => s.split(/(?<=[a-zA-Z])(?=[0-9])|(?<=[0-9])(?=[a-zA-Z])/))       // letter/digit boundary
    .map((s) => s.toLowerCase())
    .filter(Boolean);
}

/**
 * A param name is blacklisted when its full lowercased name is in the list OR any of its tokens is — so
 * a compound like `maxLevel` is dropped on the `max` token. NOTE the token rule is intentionally broad:
 * a blacklist word that is also a common English token (`order`, `page`, `size`) will drop a real-ref
 * param that happens to contain it (`orderId`, `pageId`); keep the list made of bound/pagination words.
 */
export function paramNameBlacklisted({ name, blacklist }: { name: string; blacklist: string[] }): boolean {
  const lower = name.toLowerCase();
  if (blacklist.includes(lower)) return true;
  const set = new Set(blacklist);
  return tokenizeParamName(name).some((t) => set.has(t));
}

/** One proposed swap: the extracted segment and a sibling-component replacement value for it. */
export interface UrlCandidate {
  segment: SegmentCandidate;
  candidate: ReturnType<typeof findCandidates>[number];
}

/**
 * The preindex → matchFinder half of the pipeline: given a URL (an http_event's or a crawled page's),
 * proposes every "swap this value" candidate. Pure (no browser, no network) and stateless except for a
 * per-run cache of parsed React graphs — call `reset()` at the start of each site's analysis. Pulled
 * out of AnalysisPipeline so candidate generation can be read and tested on its own.
 */
export class CandidateGenerator {
  // Per-run cache of React graphs parsed from the DB. findUrlCandidates looks a state's graph up once
  // per preindex match (tens of thousands of times for a rich site), but there are only as many
  // DISTINCT graphs as captured react_states (a couple hundred at most): without this, candidate
  // generation spent most of its time re-running JSON.parse on the SAME ~150KB graph strings. Reset per
  // run so it never grows across sites or goes stale against a later re-run.
  private graphCache = new Map<number, RapidorGraph | undefined>();

  constructor(private deps: {
    preindexStore: PreindexedValueStore;
    reactStateStore: ReactStateStore;
    maxSegmentMatches: number;
    segmentBlacklist: string[];
    paramBlacklist: string[];
  }) {}

  /** Drops the per-run graph cache. Call once at the start of each site's analysis. */
  reset(): void {
    this.graphCache.clear();
  }

  /** Runs the preindex -> matchFinder steps for one URL (an http_event's or a crawled page's). */
  findUrlCandidates({ url }: { url: string }): { segments: number; matches: number; items: UrlCandidate[] } {
    const { preindexStore, maxSegmentMatches, segmentBlacklist, paramBlacklist } = this.deps;
    let segments = 0;
    let matches = 0;
    const items: UrlCandidate[] = [];

    for (const segment of extractSegments({ url })) {
      segments++;
      // A pagination/sorting control is not an object reference: swapping it changes how MUCH of your
      // own data comes back, never WHOSE, so the response legitimately differs and no downstream guard
      // can ever reject it (config.analysis.paramBlacklist). busuu's `?limit=5` is the motivating case:
      // the bare value "5" matched 77 unrelated preindexed nodes (paddings, counts, array indices) and
      // forged dozens of nonsense ids. Matched by TOKEN too (paramNameBlacklisted), so a compound bound
      // like `maxLevel`/`minScore`/`pageSize` is dropped, not just an exact `limit`. Query params only —
      // a path segment named `limit` is not gated.
      if (segment.paramName && paramNameBlacklisted({ name: segment.paramName, blacklist: paramBlacklist })) continue;
      // App-shell / section prefixes ("app", "speak", ...) are route roots, not user-scoped ids:
      // mutating one only switches the app's section, which renders a different DOM and so masquerades
      // as a client-routing finding. Skip them wholesale (config.analysis.segmentBlacklist). Query
      // params carry no blacklisted value here (paramName is set only for them), so this only ever
      // gates path segments.
      if (!segment.paramName && segmentBlacklist.includes(segment.value.toLowerCase())) continue;
      // A value carried by thousands of React nodes is a generic keyword (a DOM tag/role/category
      // word that also happens to be a URL segment), not a user-scoped identifier: swapping it is
      // pure noise, and the fan-out (every match x its component siblings, across every URL that
      // shares the word) is what made candidate generation explode. Identifiers appear a bounded
      // handful of times, well under this cap, so this skips only the noise. countByValue never
      // materializes the rows, so an over-cap segment costs a single COUNT, not a huge fetch.
      if (preindexStore.countByValue(segment.value) > maxSegmentMatches) continue;
      for (const match of preindexStore.findByValue(segment.value)) {
        matches++;
        const graph = this.getGraph(match.stateId);
        if (!graph) continue;
        for (const candidate of findCandidates({ stateId: match.stateId, graph, nodeId: match.nodeId, path: match.path })) {
          // Blacklist applies to the swap in BOTH directions: skip not only a blacklisted segment as
          // the value being mutated (above), but also any candidate whose REPLACEMENT value is
          // blacklisted — otherwise a non-shell segment gets mutated INTO an app-shell prefix
          // (ejoy's /website-directory -> /app), which is the same section-swap false positive seen
          // from the other side.
          if (segmentBlacklist.includes(String(candidate.candidateValue).toLowerCase())) continue;
          items.push({ segment, candidate });
        }
      }
    }
    return { segments, matches, items };
  }

  /** reactStateStore.getById, memoized for this run: each distinct graph is read + JSON.parsed once. */
  private getGraph(stateId: number): RapidorGraph | undefined {
    let graph = this.graphCache.get(stateId);
    if (graph === undefined && !this.graphCache.has(stateId)) {
      graph = this.deps.reactStateStore.getById(stateId);
      this.graphCache.set(stateId, graph);
    }
    return graph;
  }

  /**
   * Minimum coverage requirement: every URL the DFS actually visited (crawl_states — the ground
   * truth of "the crawler was on this page") should have at least one captured React state
   * (react_states) at that exact URL — query params included, since a different query string is
   * legitimately a different state (and may well add more than one). A URL with none went through
   * beforeAction/afterAction without ReactStateHooks ever getting usable data back (not settled in
   * time, extension not injected on that tab, or an exception — see its own onEnd stats log for
   * which), which means every candidate hiding on that page's own state was silently never indexed,
   * so this pipeline run had no chance of ever proposing it. Logged as a warning, never thrown: this
   * is a coverage gap to go investigate (start from ReactStateHooks' onEnd log for this run), not a
   * reason to abort an otherwise-successful analysis pass.
   */
  warnOnMissingReactStateCoverage({ site, crawledStates, pageUrls }: {
    site: string;
    crawledStates: { url: string }[];
    pageUrls: string[];
  }): void {
    const covered = new Set(pageUrls);
    const missing = new Set(crawledStates.map((s) => s.url).filter((url) => !covered.has(url)));
    if (missing.size === 0) return;
    log.warning(
      `AnalysisPipeline: ${missing.size}/${new Set(crawledStates.map((s) => s.url)).size} crawled URL(s) for ${site} have ` +
      `NO captured React state (coverage gap — these pages' own candidates were never indexed): ${[...missing].join(', ')}`,
    );
  }
}
