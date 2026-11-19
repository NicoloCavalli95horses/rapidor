import { createHash } from 'node:crypto';
import { collectPreindexRows } from './preindex';
import type { RapidorGraph } from '../db/ReactStateStore';

/**
 * A CONTENT key for a captured React state, used to tell whether a client-routing candidate renders
 * something genuinely NEW and UNIQUE — the client-side analog of responseEvaluate.canonicalResponseKey
 * for the HTTP path. Two states get the same key iff they render the same component tree carrying the
 * same identifier-like data.
 *
 * Composed of TWO parts on purpose (a micro-test on promova showed the structural half alone is too
 * coarse — it distinguishes a page's TYPE, not its instance):
 * - STRUCTURE: the extension's own structural fingerprint of the component tree (`graph.fingerprint`,
 *   RAPIDOR's structural hash) — same value a differently-laid-out page would not share.
 * - DATA: every "interesting" (id/name/slug/...) leaf value across all nodes' props, via the SAME
 *   `collectPreindexRows` the preindex uses, sorted and de-duplicated. This is what separates two
 *   siblings that share a layout (two lessons, two users) but carry different ids.
 *
 * Both halves come straight from a `RapidorGraph`, so the SAME function keys a stored `react_states`
 * row (the already-collected corpus, offline) and a candidate's live-read graph (captured at analysis
 * time) — making them directly comparable. Returns undefined for a graph with no usable fingerprint
 * (nothing to key on): callers then keep the finding, never drop on missing evidence.
 */
export function reactContentKey({ graph }: { graph: RapidorGraph | null | undefined }): string | undefined {
  if (!graph?.fingerprint || !graph.nodes) return undefined;
  const values = new Set<string>();
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    for (const row of collectPreindexRows({ nodeId, key: node.key, props: node.props })) values.add(row.value);
  }
  const data = [...values].sort().join('\u0001');
  return createHash('sha256').update(`${graph.fingerprint}\u0002${data}`).digest('hex');
}
