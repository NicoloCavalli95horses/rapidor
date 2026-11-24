import type { RapidorGraph } from '../db/ReactStateStore';

type GraphNode = NonNullable<RapidorGraph['nodes']>[string];

/**
 * DOM "chrome zone" inference over a captured React graph, using the per-node serialized DOM element the
 * newer browser extension adds (`node.dom`: the nearest DOM element's outerHTML). A URL value that
 * comes from inside the site's navigation/footer furniture is never a user-scoped resource id, so the
 * match it produced is noise — this lets candidate generation skip it.
 *
 * CRITICAL scoping, verified on a fresh busuu graph: this treats ONLY nav/footer/sidebar as chrome, and
 * deliberately EXCLUDES <header>/<section>/role=banner. busuu renders its objective cards — the real IDOR
 * targets (the `objective_<uuid>` siblings) — inside a <header>, so a header/section rule would drop true
 * positives. nav/footer/sidebar marked 0 objective-bearing nodes while still catching the top-nav chrome.
 */

const CHROME_TAGS = new Set(['nav', 'footer']);
const CHROME_ROLES = new Set(['navigation', 'contentinfo']);   // the ARIA landmarks for nav + footer
// Class TOKEN match (bounded by separators so `nav`/`navbar`/`nav-top`/`sidebar`/`footer` hit while a
// substring like `clipboard` does not). Kept to navigation/footer words only — no `header`/`banner`.
const CHROME_CLASS = /(?:^|[\s_-])(nav|navbar|navigation|navmenu|sidebar|side-bar|topbar|top-bar|breadcrumb|footer|site-footer)(?=$|[\s_-])/i;

function domTag(dom: string): string | null {
  const m = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(dom);
  return m ? m[1].toLowerCase() : null;
}

function domAttr(dom: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(dom);
  return m ? m[1] : null;
}

/** The chrome-zone label for a single node's own DOM element, or null when it is not chrome (or has no DOM). */
export function domChromeZone({ dom }: { dom: unknown }): string | null {
  if (typeof dom !== 'string' || dom.length === 0) return null;
  const tag = domTag(dom);
  if (tag && CHROME_TAGS.has(tag)) return tag;
  const role = domAttr(dom, 'role');
  if (role && CHROME_ROLES.has(role.toLowerCase())) return `role:${role.toLowerCase()}`;
  const cls = domAttr(dom, 'class');
  if (cls) {
    const m = CHROME_CLASS.exec(cls);
    if (m) return `class:${m[1].toLowerCase()}`;
  }
  return null;
}

/**
 * How many ancestor levels the zone walk climbs, SCALED to the graph's size. A big app (busuu, ~8k nodes)
 * nests a nav's descendants up to ~9 React levels deep, so a short window misses them; a small app has
 * shallow chrome, where a long window would instead let a distant nav ancestor wrongly "contain" a deep
 * content node. log2(nodeCount) tracks tree depth (a balanced N-node tree is ~log2 N deep): ~13 for busuu
 * (covers the observed 9 with margin), ~4-6 on a small graph. Floored at 3, capped at 24.
 */
export function zoneWalkDepthFor({ graph }: { graph: RapidorGraph }): number {
  const n = Object.keys(graph.nodes ?? {}).length;
  return Math.min(Math.max(Math.ceil(Math.log2(n + 1)), 3), 24);
}

/**
 * Walks a node's ancestors (via `node.parent`) up to `maxDepth` levels and returns the nearest chrome-zone
 * label, or null. maxDepth defaults to the size-scaled `zoneWalkDepthFor`. Returns null when no node on the
 * walked path carries usable DOM info (old captures without `dom`), so this only ever skips a match on
 * POSITIVE evidence that it sits in chrome — never a wrongful skip. Self counts (depth 0).
 */
export function nodeChromeZone({ graph, nodeId, maxDepth }: {
  graph: RapidorGraph; nodeId: string; maxDepth?: number;
}): string | null {
  const nodes: NonNullable<RapidorGraph['nodes']> = graph.nodes ?? {};
  const budget = maxDepth ?? zoneWalkDepthFor({ graph });
  let cur: string | undefined = nodeId;
  const seen = new Set<string>();
  for (let i = 0; cur !== undefined && i <= budget; i++) {
    if (seen.has(cur)) break;                 // cycle guard (a malformed parent chain)
    seen.add(cur);
    const node: GraphNode | undefined = nodes[cur];
    if (!node) break;
    const zone = node.chromeZone !== undefined ? node.chromeZone : domChromeZone({ dom: node.dom });
    if (zone) return zone;
    cur = node.parent;
  }
  return null;
}

/**
 * Replaces every node's `dom` with its precomputed `chromeZone` label (same verdict as reading `dom`).
 * `dom` is the element's FULL outerHTML, so it repeats each subtree at every ancestor: ~60% of a graph
 * (rocketlanguages: 13 of 23 MB per state, 259 states -> heap OOM when candidate generation cached them all).
 */
export function slimGraphForGeneration(graph: RapidorGraph): RapidorGraph {
  for (const node of Object.values(graph.nodes ?? {})) {
    node.chromeZone = domChromeZone({ dom: node.dom });
    delete node.dom;
  }
  return graph;
}
