import type { ResponseLike } from './requestForge';
import { compareObj, scopeDiffsToResource, excludeSwapDiff, canonicalResponseKey, isEmptyJsonResponse, isErrorEnvelopeResponse } from './responseEvaluate';
import { assessAuthZ, assessDirection, type AuthzClassifier, type AuthzAssessment } from './authzClassifier';
import { readPath } from './matchFinder';

/**
 * The decision steps the main pipeline (CandidateEvaluator) and the ablation (AblationPipeline) share
 * verbatim, kept in ONE place so the two cannot drift: the ablation must differ from the main pipeline
 * only in where its siblings come from (JSON bodies vs React components), never in how a candidate is judged.
 */

/**
 * The pure authz gate, run before any forge: diff the two sibling objects, scope the diff to the swapped
 * resource (scopeDiffsToResource), classify it WITHOUT the swapped identifier itself (excludeSwapDiff),
 * then (optionally) require the candidate to be the MORE restricted side (assessDirection). `swapPath` is
 * relative to the compared objects, optionally prefixed by `'props'` (the React node convention).
 * Returns the assessment (with the full scoped diff, swap included, for the recorded motivation) or the
 * rejection reason.
 */
export async function authzGateVerdict({ referenceProps, candidateProps, swapPath, classifier, directionGate }: {
  referenceProps: unknown; candidateProps: unknown; swapPath: (string | number)[];
  classifier: AuthzClassifier; directionGate?: boolean;
}): Promise<{ authz: AuthzAssessment; reject?: undefined } | { authz?: undefined; reject: string; differences: AuthzAssessment['differences'] }> {
  const differences = scopeDiffsToResource({ differences: compareObj(referenceProps, candidateProps), swapPath });
  const authz = await assessAuthZ({ differences: excludeSwapDiff({ differences, swapPath }), classifier });
  if (!authz.isAuthzRelevant) {
    return { reject: `no authz-relevant diff, sensitiveKeys=${JSON.stringify(authz.sensitiveKeys)}`, differences };
  }
  // A verdict resting ONLY on a value that reads like an entitlement (promova's tag `free_talk`) is
  // contradicted by an explicit entitlement key EQUAL on both sides (`free: false` on every lesson).
  if ((authz.nameKeys ?? []).length === 0) {
    const equal = await equalEntitlementKeys({ referenceProps, candidateProps, swapPath, classifier });
    if (equal.length > 0) {
      return { reject: `authz signal only from values ${JSON.stringify(authz.sensitiveKeys)}, while entitlement key(s) are equal on both sides: ${equal.join(', ')}`, differences };
    }
  }
  if (directionGate) {
    const direction = await assessDirection({ authz, classifier });
    if (direction.lessRestricted) {
      return { reject: `candidate less restricted than the reference, delta=${direction.delta.toFixed(2)}: ${direction.evidence.join(' ')}`, differences };
    }
  }
  return { authz: { ...authz, differences } };
}

// Entitlement-shaped leaf values: a flag or a short enum term (never a URL, a callback marker, free text).
const ENTITLEMENT_VALUE = (v: unknown): boolean => typeof v === 'boolean' || v === 0 || v === 1
  || (typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(v));
const MAX_EQUAL_WALK_DEPTH = 6;

/**
 * Leaves of the swapped resource (the swap path's parent, same scope as scopeDiffsToResource) whose
 * entitlement-shaped value is EQUAL on both sides under an authz-relevant key, as `path=value`.
 */
async function equalEntitlementKeys({ referenceProps, candidateProps, swapPath, classifier }: {
  referenceProps: unknown; candidateProps: unknown; swapPath: (string | number)[]; classifier: AuthzClassifier;
}): Promise<string[]> {
  const rel = swapPath[0] === 'props' ? swapPath.slice(1) : swapPath;
  const scope = rel.slice(0, -1);
  const out: string[] = [];
  const walk = async (a: unknown, b: unknown, path: (string | number)[]): Promise<void> => {
    if (path.length - scope.length > MAX_EQUAL_WALK_DEPTH) return;
    if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
      for (const k of Object.keys(a as object)) await walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], [...path, k]);
      return;
    }
    const key = path[path.length - 1];
    if (a !== b || !ENTITLEMENT_VALUE(a) || typeof key !== 'string' || !/^[A-Za-z0-9_]{1,50}$/.test(key)) return;
    if ((await classifier.classify(key)).isAuthZRelevant) out.push(`${path.join('.')}=${JSON.stringify(a)}`);
  };
  const pick = (o: unknown) => (scope.length ? readPath(o, scope) : o);
  await walk(pick(referenceProps), pick(candidateProps), scope);
  return out;
}

/**
 * The content guards on an HTTP forge's response, run before it can become a finding: error status,
 * empty data, error envelope, and data already collected at a DIFFERENT url (response history; the
 * reference's own body is excluded — that is the "server ignored the value" case, isIdenticalResponse's).
 * Returns the rejection reason, or null to keep the candidate.
 */
export function httpContentGuardReason({ forged, original, responseHistoryKeys }: {
  forged: ResponseLike; original: ResponseLike; responseHistoryKeys: Set<string>;
}): string | null {
  if (forged.status >= 400) return `forged response status ${forged.status}: access denied / error, not a leak`;
  if (isEmptyJsonResponse({ body: forged.body })) return 'forged response carries no data: empty object/array';
  if (isErrorEnvelopeResponse({ body: forged.body })) return 'forged response is an error envelope despite 200';
  const forgedKey = canonicalResponseKey({ status: forged.status, body: forged.body });
  const referenceKey = canonicalResponseKey({ status: original.status, body: original.body });
  if (forgedKey !== undefined && forgedKey !== referenceKey && responseHistoryKeys.has(forgedKey)) {
    return "forged response already in the crawler's own http_events — already-accessible data";
  }
  return null;
}
