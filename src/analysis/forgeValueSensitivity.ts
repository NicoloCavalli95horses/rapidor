import type { SegmentCandidate } from './segments';

/**
 * Value-insensitivity guard for HTTP forges. If two DIFFERENT candidate values swapped into the SAME
 * request slot return a byte/JSON-identical response, the server's answer does not depend on the
 * value: it fell back to a default. getpronounce's `/pronounce?voice=evelyn|joseph&provider=openai`
 * both return the default `echo` audio, so neither reached a paid voice.
 * It generalizes `isIdenticalResponse` (candidate == reference) to candidate == sibling candidate.
 */

/** The request slot a candidate swaps: the reference request + the position of the mutated value. */
export function forgeTemplateKey({ method, url, segment }: { method: string; url: string; segment: SegmentCandidate }): string {
  const position = segment.paramName !== undefined ? `query:${segment.paramName}` : `path:${segment.index}`;
  return `${method.toUpperCase()} ${url} ${position}`;
}

/** A confirmed HTTP finding waiting for the end of the run (a later sibling may still collide with it). */
export interface DeferredHttpFinding {
  template: string;
  forgedKey: string | undefined;   // canonicalResponseKey of the forged response (undefined = no body)
  context: string;
  recordHttp: () => void;
  // What a value-insensitive forge falls back to (the client-routing query fallback), as for isIdenticalResponse
  onValueInsensitive: () => Promise<void>;
}

/**
 * Per-run state. Every forge is OBSERVED (even a rejected one: it is still evidence about the slot),
 * while confirmed findings are DEFERRED, because the colliding sibling may be forged after them.
 */
export class ForgeValueSensitivity {
  private valuesByResponse = new Map<string, Set<string>>();
  private deferred: DeferredHttpFinding[] = [];

  reset(): void {
    this.valuesByResponse.clear();
    this.deferred = [];
  }

  observe({ template, forgedKey, value }: { template: string; forgedKey: string | undefined; value: string }): void {
    if (forgedKey === undefined) return;   // no body, no evidence
    const key = `${template}\n${forgedKey}`;
    let values = this.valuesByResponse.get(key);
    if (!values) this.valuesByResponse.set(key, values = new Set());
    values.add(value);
  }

  isValueInsensitive({ template, forgedKey }: { template: string; forgedKey: string | undefined }): boolean {
    if (forgedKey === undefined) return false;   // drop only on positive evidence
    return (this.valuesByResponse.get(`${template}\n${forgedKey}`)?.size ?? 0) >= 2;
  }

  defer(finding: DeferredHttpFinding): void {
    this.deferred.push(finding);
  }

  /** Hands over the deferred findings in arrival order and empties the queue. */
  drain(): DeferredHttpFinding[] {
    const out = this.deferred;
    this.deferred = [];
    return out;
  }
}

/**
 * The slot where `b` differs from `a`, if they differ in exactly one query param or one path segment
 * (same origin, everything else equal). Recheck uses it to find a stored finding's sibling forges
 * in the forged_requests cache without the original SegmentCandidate.
 */
export function singleSwapPosition({ a, b }: { a: string; b: string }): string | null {
  let ua: URL; let ub: URL;
  try { ua = new URL(a); ub = new URL(b); } catch { return null; }
  if (ua.origin !== ub.origin) return null;
  if (ua.pathname === ub.pathname) {
    const keys = new Set([...ua.searchParams.keys(), ...ub.searchParams.keys()]);
    const differing = [...keys].filter((k) => ua.searchParams.getAll(k).join('\0') !== ub.searchParams.getAll(k).join('\0'));
    if (differing.length !== 1 || !ua.searchParams.has(differing[0]!) || !ub.searchParams.has(differing[0]!)) return null;
    return `query:${differing[0]}`;
  }
  if (ua.search !== ub.search) return null;
  const sa = ua.pathname.split('/'); const sb = ub.pathname.split('/');
  if (sa.length !== sb.length) return null;
  const differing = sa.flatMap((seg, i) => (seg !== sb[i] ? [i] : []));
  return differing.length === 1 ? `path:${differing[0]}` : null;
}
