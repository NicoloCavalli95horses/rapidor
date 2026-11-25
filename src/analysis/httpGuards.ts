import type { ResponseLike } from './requestForge';
import { compareObj, scopeDiffsToResource, excludeSwapDiff, canonicalResponseKey, isEmptyJsonResponse, isErrorEnvelopeResponse } from './responseEvaluate';
import { assessAuthZ, assessDirection, type AuthzClassifier, type AuthzAssessment } from './authzClassifier';

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
  if (directionGate) {
    const direction = await assessDirection({ authz, classifier });
    if (direction.lessRestricted) {
      return { reject: `candidate less restricted than the reference, delta=${direction.delta.toFixed(2)}: ${direction.evidence.join(' ')}`, differences };
    }
  }
  return { authz: { ...authz, differences } };
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
