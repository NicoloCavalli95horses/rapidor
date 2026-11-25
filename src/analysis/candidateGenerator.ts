import { log } from 'crawlee';
import type { PreindexedValueStore, PreindexMatch } from '../db/PreindexedValueStore';
import type { ReactStateStore, RapidorGraph } from '../db/ReactStateStore';
import { findCandidates, type MatchCandidate } from './matchFinder';
import { extractSegments, type SegmentCandidate } from './segments';
import { nodeChromeZone, slimGraphForGeneration, zoneWalkDepthFor } from './domZone';
import { tokenizeParamName } from '../utils/utils';

// tokenizeParamName now lives in utils (shared with findings' identifier guard); re-exported so
// existing importers (candidateGenerator.test.ts, and the param-name blacklist below) keep working.
export { tokenizeParamName };

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

/**
 * Locale / UI-language query params. In this corpus (language-learning apps) a locale param selects the
 * response's REPRESENTATION — which language its texts/UI come back in — not WHOSE resource it is. Like a
 * pagination param, swapping it returns the same resource rendered differently, so the response differs
 * legitimately and no content guard can ever reject it (Mondly's `notification-preferences?mother_language=22`
 * came back in Arabic/Thai/Korean/… → one FP per language). Matched by REGEX, deliberately NOT a blacklist
 * token: the bare token `language` would also drop `target_language`/`learning_language`, which in a language
 * app name the RESOURCE you study (possibly paid) — a real TP. The optional prefix set is only
 * UI/native/mother-style, so `mother_language`/`ui_language`/`locale`/`lang` match while `target_language`
 * does not; a trailing `_id` (`language_id`) fails too, keeping an id reference mutable. Not a config knob —
 * a semantic fact about param names, like VOLATILE_PARAMS/PREINDEXED_KEYS.
 */
export const LOCALE_PARAM = /^(?:ui|interface|display|native|mother|app|site|user)?[-_]?(?:language|lang|lng|locale|langcode|tongue)$/i;

/** True when a query-param NAME is a locale/UI-language selector (see LOCALE_PARAM). */
export function isLocaleParam({ name }: { name: string }): boolean {
  return LOCALE_PARAM.test(name.trim());
}

/**
 * Marketing / attribution query params (utm_*, click-ids, campaign/ref marks). These carry analytics
 * provenance — WHERE the visit came from — never WHICH resource is addressed, so the server ignores
 * them and a swap can only ever surface noise. lingualeo's CRM `/en/buy/…json?…&refclmark=2&campaignId=…`
 * is the motivating FP: the inert `refclmark` value `2` happened to collide with a wordset id in the
 * page's React state, so siblings (`12178`, …) got forged; the server returned the same blob, but its
 * dynamic `elements`/`tags` list reordered between capture and forge, and the positional diff
 * (`elements.1.type: "user" -> "global"`) tripped the authz gate → 10 HTTP FPs on one request.
 * Regex, not a blacklist token, so a resource param that merely CONTAINS a tracking word stays mutable.
 * A semantic param-name fact like LOCALE_PARAM/VOLATILE_PARAMS, not a config knob.
 */
export const TRACKING_PARAM = /^(?:utm_[a-z_]+|refclmark|campaign_?id|g?clid|fbclid|msclkid|yclid|dclid|twclid|igshid|gbraid|wbraid|mc_[ce]id)$/i;

/** True when a query-param NAME is a marketing/attribution tracking param (see TRACKING_PARAM). */
export function isTrackingParam({ name }: { name: string }): boolean {
  return TRACKING_PARAM.test(name.trim());
}

/**
 * An identifier slot keeps its TYPE: a numeric URL value is only ever swapped for another numeric one,
 * a non-numeric one for a non-numeric one. A cross-type swap means the "sibling" is a different kind of
 * link sharing the component (duolingo's lesson button `/lesson/unit/1/level/1` and the footer `/privacy`
 * link: `relative_domains=1 -> privacy`). Compared on the STRING form: the URL token is always a string
 * and candidateValue is `String(raw)`, so a React `1` and a `'1'` are both numeric. Digits only — signs,
 * decimals and hex are not id shapes here.
 */
export function sameIdShape({ original, replacement }: { original: string; replacement: string }): boolean {
  const numeric = (v: string) => /^\d+$/.test(v.trim());
  return numeric(original) === numeric(replacement);
}

/**
 * The browser extension stringifies a React prop it cannot serialize as the literal marker
 * `[non-serializable:<ctor>]` (an `undefined`/function/symbol leaf becomes `[non-serializable:undefined]`).
 * It is OUR placeholder, never a value the app uses as an identifier, so it must never be forged into a
 * request or a forced route — babbel's lesson-player path swap `0ecaf91… -> [non-serializable:undefined]`
 * was a spurious client-routing FP. Drop it as a candidate replacement value.
 */
export function isNonSerializableMarker({ value }: { value: string }): boolean {
  return /^\[non-serializable:.*\]$/.test(value.trim());
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
// ~1 GB of stored graph JSON ≈ 0.7 GB of heap once slimmed: well under Node's default ~4 GB limit.
export const DEFAULT_GRAPH_CACHE_MAX_BYTES = 1_000_000_000;

export class CandidateGenerator {
  // Per-run cache of React graphs parsed from the DB. findUrlCandidates looks a state's graph up once
  // per preindex match (tens of thousands of times for a rich site), but there are only as many
  // DISTINCT graphs as captured react_states (a couple hundred at most): without this, candidate
  // generation spent most of its time re-running JSON.parse on the SAME graph strings. Reset per run.
  // LRU-bounded by stored JSON size (graphCacheMaxBytes): unbounded, rocketlanguages' 259 x 23 MB
  // graphs exhausted the heap. Every site crawled so far fits whole (largest ~500 MB), so no re-parse.
  private graphCache = new Map<number, { graph: RapidorGraph | undefined; bytes: number }>();
  private graphCacheBytes = 0;
  private graphLoads = 0;   // JSON.parse count this run (logged: re-parses mean the LRU bound is biting)

  // Per-run cache of each graph's size-scaled chrome-zone walk depth (zoneWalkDepthFor is O(nodes), so it
  // is computed once per state, not once per match). Keyed by stateId like graphCache; reset per run.
  private zoneDepthCache = new Map<number, number>();

  // Per-run cache of preindex lookups by value (site-keyed for safety). URLs of one site repeat the same
  // param values thousands of times (talkpal: 2M segments, 15k distinct values): one SQL round per value.
  private lookupCache = new Map<string, { count: number; matches?: PreindexMatch[] }>();

  // Per-run cache of a value's whole expansion (matches -> chrome skip -> siblings -> value filters): it
  // depends on the VALUE only, never on where the segment sits, so `/lesson/1/2/1`'s second `1`, and every
  // other URL carrying `1`, reuse it. Each segment still gets its own items (distinct swap positions).
  private expansionCache = new Map<string, { matches: number; chromeSkipped: number; candidates: MatchCandidate[] }>();

  constructor(private deps: {
    preindexStore: PreindexedValueStore;
    reactStateStore: ReactStateStore;
    maxSegmentMatches: number;
    segmentBlacklist: string[];
    paramBlacklist: string[];
    graphCacheMaxBytes?: number;   // default DEFAULT_GRAPH_CACHE_MAX_BYTES
  }) {}

  /** Drops the per-run caches. Call once at the start of each site's analysis. */
  reset(): void {
    this.graphCache.clear();
    this.graphCacheBytes = 0;
    this.graphLoads = 0;
    this.zoneDepthCache.clear();
    this.lookupCache.clear();
    this.expansionCache.clear();
  }

  /** Cached countByValue + (only under the cap) findByValue, so an over-cap value never fetches its rows. */
  private lookup({ value, site }: { value: string; site: string }): PreindexMatch[] | undefined {
    const { preindexStore, maxSegmentMatches } = this.deps;
    const key = `${site}\u0000${value}`;
    let entry = this.lookupCache.get(key);
    if (!entry) {
      const count = preindexStore.countByValue({ value, site });
      entry = { count, matches: count > maxSegmentMatches ? undefined : preindexStore.findByValue({ value, site }) };
      this.lookupCache.set(key, entry);
    }
    return entry.matches;
  }

  /**
   * Runs the preindex -> matchFinder steps for one URL (an http_event's or a crawled page's). `site` scopes
   * the preindex lookups to the site under analysis — the DB holds many sites at once, and an unscoped
   * lookup matches another site's nodes (a cross-site false positive, see PreindexedValueStore.findByValue).
   */
  findUrlCandidates({ url, site }: { url: string; site: string }): { segments: number; matches: number; chromeSkipped: number; items: UrlCandidate[] } {
    const { segmentBlacklist, paramBlacklist } = this.deps;
    let segments = 0;
    let matches = 0;
    let chromeSkipped = 0;
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
      // A locale / UI-language param selects the response's LANGUAGE, not its owner (see LOCALE_PARAM): a
      // swap returns the same resource in another language, a guaranteed non-finding. Regex, not a token,
      // so `target_language`/`learning_language` (the studied resource, maybe paid) stay mutable.
      if (segment.paramName && isLocaleParam({ name: segment.paramName })) continue;
      // A marketing/attribution param (utm_*, refclmark, campaignId, click-ids) names the visit's
      // PROVENANCE, not a resource: the server ignores it, so a swap only surfaces response noise
      // (lingualeo's `refclmark` collided with a wordset id → 10 HTTP FPs on the /en/buy blob). Regex,
      // not a token, so a resource param that merely contains a tracking word stays mutable.
      if (segment.paramName && isTrackingParam({ name: segment.paramName })) continue;
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
      const expansion = this.expand({ value: segment.value, site });
      if (!expansion) continue;   // over maxSegmentMatches
      matches += expansion.matches;
      chromeSkipped += expansion.chromeSkipped;
      for (const candidate of expansion.candidates) items.push({ segment, candidate });
    }
    return { segments, matches, chromeSkipped, items };
  }

  /**
   * The value-only part of findUrlCandidates, memoized per run (see expansionCache). undefined when the
   * value is over maxSegmentMatches.
   */
  private expand({ value, site }: { value: string; site: string }): { matches: number; chromeSkipped: number; candidates: MatchCandidate[] } | undefined {
    const key = `${site}\u0000${value}`;
    const cached = this.expansionCache.get(key);
    if (cached) return cached;
    const preindexMatches = this.lookup({ value, site });
    if (!preindexMatches) return undefined;
    const { segmentBlacklist } = this.deps;
    const out = { matches: 0, chromeSkipped: 0, candidates: [] as MatchCandidate[] };
    // The preindex holds one row per TOKEN, so `/fr/485/1/1/1` matches `1` three times on the same node+path:
    // expand each (node, path) once (the `matches` stat still counts rows, as before).
    const expanded = new Set<string>();
    for (const match of preindexMatches) {
      out.matches++;
      const matchKey = `${match.stateId}\u0000${match.nodeId}\u0000${JSON.stringify(match.path)}`;
      if (expanded.has(matchKey)) continue;
      expanded.add(matchKey);
      const graph = this.getGraph(match.stateId);
      if (!graph) continue;
      // Skip a match whose React node sits inside the site's navigation/footer chrome (see domZone):
      // a URL value coming from nav/footer furniture is never a user-scoped resource id, so every
      // candidate it would spawn is noise. Scoped to nav/footer/sidebar ONLY — <header>/<section> are
      // deliberately NOT chrome (busuu renders its objective-id cards inside a <header>). No-op on old
      // captures without the `dom` field (nodeChromeZone returns null), so this only skips on evidence.
      if (nodeChromeZone({ graph, nodeId: match.nodeId, maxDepth: this.getZoneDepth(match.stateId, graph) })) {
        out.chromeSkipped++;
        continue;
      }
      // matchedValue: the sibling must differ at the token that matched the URL (see matchFinder.diffValue)
      for (const candidate of findCandidates({ stateId: match.stateId, graph, nodeId: match.nodeId, path: match.path, matchedValue: value })) {
        // Blacklist applies to the swap in BOTH directions: skip not only a blacklisted segment as
        // the value being mutated (above), but also any candidate whose REPLACEMENT value is
        // blacklisted — otherwise a non-shell segment gets mutated INTO an app-shell prefix
        // (ejoy's /website-directory -> /app), which is the same section-swap false positive seen
        // from the other side.
        if (segmentBlacklist.includes(String(candidate.candidateValue).toLowerCase())) continue;
        // never forge our own non-serializable placeholder (see isNonSerializableMarker)
        if (isNonSerializableMarker({ value: String(candidate.candidateValue) })) continue;
        // the slot keeps its type (numeric <-> non-numeric is a different kind of link, see sameIdShape)
        if (!sameIdShape({ original: value, replacement: String(candidate.candidateValue) })) continue;
        out.candidates.push(candidate);
      }
    }
    this.expansionCache.set(key, out);
    return out;
  }

  /** zoneWalkDepthFor(graph), memoized per state for this run (it is O(nodes), called once per match). */
  private getZoneDepth(stateId: number, graph: RapidorGraph): number {
    let depth = this.zoneDepthCache.get(stateId);
    if (depth === undefined) {
      depth = zoneWalkDepthFor({ graph });
      this.zoneDepthCache.set(stateId, depth);
    }
    return depth;
  }

  /** How many graphs were JSON.parsed this run (= distinct states touched, unless the LRU bound evicted). */
  get graphLoadCount(): number {
    return this.graphLoads;
  }

  /**
   * The state's graph, slimmed (`dom` -> `chromeZone`, see slimGraphForGeneration) and LRU-cached for this
   * run within graphCacheMaxBytes of stored JSON; the most recent graph is always kept, even if larger.
   */
  private getGraph(stateId: number): RapidorGraph | undefined {
    const hit = this.graphCache.get(stateId);
    if (hit) {
      this.graphCache.delete(stateId);   // re-insert = most recently used (Map keeps insertion order)
      this.graphCache.set(stateId, hit);
      return hit.graph;
    }
    const json = this.deps.reactStateStore.getJsonById(stateId);
    const graph = json === undefined ? undefined : slimGraphForGeneration(JSON.parse(json) as RapidorGraph);
    const bytes = json?.length ?? 0;
    this.graphLoads++;
    const max = this.deps.graphCacheMaxBytes ?? DEFAULT_GRAPH_CACHE_MAX_BYTES;
    for (const [id, entry] of this.graphCache) {
      if (this.graphCacheBytes + bytes <= max) break;
      this.graphCache.delete(id);
      this.graphCacheBytes -= entry.bytes;
    }
    this.graphCache.set(stateId, { graph, bytes });
    this.graphCacheBytes += bytes;
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
