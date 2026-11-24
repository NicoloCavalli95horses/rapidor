import { pipeline } from '@huggingface/transformers';
import type { AuthzClassificationStore } from '../db/AuthzClassificationStore';

/**
 * The SIGN of an entitlement term: +1 = it restricts access when true (`lock`, `premium`, `paywall`),
 * -1 = it grants access when true (`free`, `unlocked`, `available`), plus how confidently the term is
 * about paid access at all. The relevance classifier (AuthzClassifier, MiniLM cosine similarity) cannot
 * provide this: similarity is polarity-blind — measured, `locked`/`restricted`/`disabled` sit closer to
 * an "access granted" anchor than `unlocked` does — so the authz gate was symmetric, and a swap FROM a
 * paid reference the user legitimately reached TO a free sibling passed it (getpronounce: the free user
 * previews the paid voice `shimmer`, and `shimmer -> daniel` flagged `isFree: false -> true`).
 *
 * A zero-shot NLI model reads negation. One generic premise/hypothesis pair, no list of keys: the term
 * is the premise ("This lesson is marked as <term>."), each hypothesis gets its OWN entailment
 * probability (multi_label), so a neutral term entails neither. polarity = P(must pay) − P(no cost),
 * relevance = max of the two. Chosen among 7 models × 7 phrasings on 44 terms: bart-large-mnli with this
 * phrasing separates entitlement from neutral terms perfectly (min 0.61 vs max 0.42) with 89% correct
 * signs; the misses are user-STATE terms (`purchased`, `owned`, `isSubscribed` read as "this is paid").
 */
const MODEL = 'Xenova/bart-large-mnli';
const PREMISE = (term: string): string => `This lesson is marked as ${term}.`;
const HYPOTHESIS_TEMPLATE = 'The user {}.';
const RESTRICTS = 'must pay or upgrade to open it';
const GRANTS = 'can open it at no cost';
// Bump when the model or any prompt string above changes: invalidates the persisted authz_polarity rows.
const POLARITY_VERSION = 1;

export interface Polarity { polarity: number; relevance: number }

type ZeroShotClassifier = (text: string, labels: string[], opts: { hypothesis_template: string; multi_label: boolean }) =>
  Promise<{ labels: string[]; scores: number[] }>;

export class EntitlementPolarity {
  private model?: Promise<ZeroShotClassifier>;
  // L1 (this process) in front of the store's L2 (SQLite), keyed by the normalized term like AuthzClassifier
  private cache = new Map<string, Polarity>();

  constructor(private store: AuthzClassificationStore) {}

  /** `term` must already be normalized (normalizeKey): the caller owns normalization, so both caches agree. */
  async score(term: string): Promise<Polarity> {
    const storeKey = `${POLARITY_VERSION}:${term}`;
    const cached = this.cache.get(term) ?? this.store.getPolarity(storeKey);
    if (cached) {
      this.cache.set(term, cached);
      return cached;
    }
    // Loaded lazily: a run whose candidates never reach the direction check never downloads the model.
    this.model ??= pipeline('zero-shot-classification', MODEL) as unknown as Promise<ZeroShotClassifier>;
    const out = await (await this.model)(PREMISE(term), [RESTRICTS, GRANTS], { hypothesis_template: HYPOTHESIS_TEMPLATE, multi_label: true });
    const restricts = out.scores[out.labels.indexOf(RESTRICTS)];
    const grants = out.scores[out.labels.indexOf(GRANTS)];
    const result = { polarity: restricts - grants, relevance: Math.max(restricts, grants) };
    this.cache.set(term, result);
    this.store.setPolarity(storeKey, result);
    return result;
  }
}
