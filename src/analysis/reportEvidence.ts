import type { PropDiff } from './responseEvaluate';

/**
 * The regeneration payload stored in `vulnerabilities.evidence` (JSON). It holds exactly what the
 * report (report.md) and the executable test need and no other column already carries: the two sibling
 * React nodes' full props, their state/node ids, the reproduction urls and the baseline request/response
 * (auth headers REDACTED — see redactHeaders). Everything else the generators need (motivation, the
 * authz diff, the values, the segment position) is read from the finding's own columns.
 *
 * A finding whose row has no evidence (stored before this column existed) cannot be regenerated until a
 * backfill fills it (scripts/backfillEvidence.ts re-derives the sibling pair, purely, from react_states).
 */

/** How a finding is reproduced: a forged GET with its recorded baseline, or a client-routing swap. */
export type ReproductionKind =
  | {
      type: 'http'; method: string; headers: Record<string, string>; postData?: string;
      baselineStatus: number; baselineHeaders: Record<string, string>; baselineBody: string; baselineContentType?: string;
    }
  | { type: 'client-routing-query'; paramName: string; candidateValue: string }
  | { type: 'client-routing-path'; candidateUrl: string };

export const EVIDENCE_SCHEMA_VERSION = 1 as const;

export interface FindingEvidence {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  // The swapped sibling pair (two instances of the same React component), recovered from react_states.
  stateId: number;
  referenceNodeId: string;
  candidateNodeId: string;
  path: (string | number)[];
  referenceProps: unknown;
  candidateProps: unknown;
  // The urls a reproduction opens: already resolved for the http-vs-client-fallback distinction by the
  // evaluator (http => the forged GET; client-routing => the SPA page url). Kept verbatim from the run.
  reproductionReferenceUrl: string;
  reproductionCandidateUrl: string;
  kind: ReproductionKind;   // http baseline (headers redacted) or client-routing descriptor
  clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };  // the exact window the run probed, so a re-run tests the same one
}

// Header names whose VALUE is a credential: never written to an evidence row, a report or a test (those
// files are meant to be shared with a vendor). Matched case-insensitively as a substring of the name, so
// `x-auth-token`/`set-cookie`/`x-session-id` are all caught. The forge itself never needs them in the
// test (it runs in the authenticated profile), and the report only shows that a header was sent.
const SENSITIVE_HEADER_PATTERN = /cookie|authorization|auth|token|session|api[-_]?key|secret|credential/i;
const REDACTED = '<redacted>';

/** Returns a copy of `headers` with every credential-bearing value replaced by `<redacted>`. Pure. */
export function redactHeaders({ headers, alsoRedact = [] }: { headers: Record<string, string>; alsoRedact?: string[] }): Record<string, string> {
  const extra = new Set(alsoRedact.map((h) => h.toLowerCase()));
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SENSITIVE_HEADER_PATTERN.test(name) || extra.has(name.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

/** Redacts the auth headers of an http kind (request AND response headers); a client-routing kind is returned unchanged. */
function redactKind({ kind, alsoRedact }: { kind: ReproductionKind; alsoRedact: string[] }): ReproductionKind {
  if (kind.type !== 'http') return kind;
  return {
    ...kind,
    headers: redactHeaders({ headers: kind.headers, alsoRedact }),
    baselineHeaders: redactHeaders({ headers: kind.baselineHeaders, alsoRedact }),
  };
}

/** Assembles the evidence payload for one confirmed finding, redacting the baseline's auth headers. */
export function buildEvidence({ candidate, reproductionReferenceUrl, reproductionCandidateUrl, kind, clientRoutingProbe, redactHeaderNames = [] }: {
  candidate: { stateId: number; referenceNodeId: string; candidateNodeId: string; path: (string | number)[]; referenceProps: unknown; candidateProps: unknown };
  reproductionReferenceUrl: string;
  reproductionCandidateUrl: string;
  kind: ReproductionKind;
  clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };
  redactHeaderNames?: string[];   // config.analysis.volatileAuthHeaders, merged with the built-in credential pattern
}): FindingEvidence {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    stateId: candidate.stateId,
    referenceNodeId: candidate.referenceNodeId,
    candidateNodeId: candidate.candidateNodeId,
    path: candidate.path,
    referenceProps: candidate.referenceProps,
    candidateProps: candidate.candidateProps,
    reproductionReferenceUrl,
    reproductionCandidateUrl,
    kind: redactKind({ kind, alsoRedact: redactHeaderNames }),
    clientRoutingProbe,
  };
}

/** The parsed authz assessment stored in the `authz_diff` column (a superset: only these fields are read for a report). */
export interface StoredAuthz {
  isAuthzRelevant: boolean;
  differences: PropDiff[];
  sensitiveKeys: string[];
  nameKeys?: string[];
}
