import { pipeline } from '@huggingface/transformers';
import type { PropDiff } from './responseEvaluate';
import type { AuthzClassificationStore } from '../db/AuthzClassificationStore';

/**
 * Port of RAPIDOR's extension-only offscreen classifier (react-devtools-extensions/src/offscreen/
 * offscreen.js): the same sentence-embedding model and the same 4 concept sentences verbatim. Runs
 * directly in Node here; @huggingface/transformers works the same way server-side, so no browser/
 * offscreen-document plumbing is needed at all.
 *
 * THRESHOLD is lowered from RAPIDOR's 0.33 to 0.30 to catch a bare single-word entitlement flag whose
 * framed form sits just under — ejoy's `lock` (`whether lock` = 0.307), the sole authz signal of its
 * paid-lesson diff (`lock: false -> true`). That is only safe because the authz gate now scopes the diff
 * to the SWAPPED RESOURCE's own subtree (CandidateEvaluator.authzGate): the generic nav/identity keys a
 * lower threshold would otherwise let through (`user`, `feature`, `available`) sit OUTSIDE the swapped
 * id's object and are filtered before classification. It is applied at READ time (recomputed from the
 * cached score), so changing it needs no CLASSIFIER_VERSION bump — the persisted scores stay valid.
 */
const AUTHZ_CONCEPTS = [
  "permissions and access control: user roles, permissions, and access rights determine whether a user can access, use, or is blocked from using a feature or resource",
  "feature gating and availability: features or content can be free, paid, premium, locked, unlocked, blocked, or available depending on the user's permissions and authorization",
  "subscription and access tiers: free and premium subscriptions, paid plans, and membership levels determine access to locked or unlocked features and content",
  "entitlements and usage limitations: user entitlements, credits, quotas, and usage limits determine whether a feature or resource is available, accessible, locked, unlocked, or blocked",
];

const THRESHOLD = 0.30;
const MODEL = 'Xenova/all-MiniLM-L6-v2';

type FeatureExtractor = (text: string | string[], opts: { pooling: 'mean'; normalize: boolean }) =>
  Promise<{ dims: number[]; data: Float32Array | number[] }>;

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export class AuthzClassifier {
  private extractor?: Promise<FeatureExtractor>;
  private conceptEmbeddings?: Float32Array[];
  // L1 (in-memory, this process) in front of the store's L2 (SQLite, survives across runs/sites)
  private cache = new Map<string, { score: number; isAuthZRelevant: boolean }>();

  constructor(private store: AuthzClassificationStore) {}

  private getExtractor(): Promise<FeatureExtractor> {
    this.extractor ??= pipeline('feature-extraction', MODEL) as unknown as Promise<FeatureExtractor>;
    return this.extractor;
  }

  private async getConceptEmbeddings(): Promise<Float32Array[]> {
    if (this.conceptEmbeddings) return this.conceptEmbeddings;
    const extractor = await this.getExtractor();
    const output = await extractor(AUTHZ_CONCEPTS, { pooling: 'mean', normalize: true });
    const dim = output.dims.at(-1) as number;
    this.conceptEmbeddings = AUTHZ_CONCEPTS.map((_, i) => Float32Array.from(output.data.slice(i * dim, (i + 1) * dim)));
    return this.conceptEmbeddings;
  }

  async classify(key: string): Promise<{ score: number; isAuthZRelevant: boolean }> {
    // Two normalizations, both measured to raise recall with zero new false positives (across the real
    // authz keys + values of pimsleur/busuu/lingualeo), and neither a hand-maintained list of "authz"
    // keys:
    //  1. Embed the key as WORDS, not one opaque identifier. `isLessonUnlocked` glued together reads as
    //     noise (0.157); split to "is lesson unlocked" it scores 0.431. camelCase/snake/kebab split.
    //  2. Frame it as a yes/no condition ("whether ..."), which is how authorization fields actually
    //     read ("is this unlocked/available?"). This lifts the ambiguous single-word flags the split
    //     alone can't help — `available` 0.234 -> 0.405 — while 12 negative keys and 8 id-like values
    //     all stay well below threshold.
    // The DB store is a pure function of (key, embedding logic), so its key carries CLASSIFIER_VERSION:
    // changing the normalization/framing above bumps the version, and every stale row a previous run
    // wrote is bypassed instead of being returned (a single-word key like `available` normalizes to
    // itself, so without the version it would re-hit its old pre-split score). The in-memory cache is
    // per-process (one logic version), so it stays keyed by the normalized form — which is also what
    // tests pre-seed to skip loading the model.
    const norm = normalizeKey(key);
    const storeKey = `${CLASSIFIER_VERSION}:${norm}`;
    // THRESHOLD is applied at READ time (recomputed from the stored score), so lowering/raising it takes
    // effect on already-cached scores without a CLASSIFIER_VERSION bump — only the SCORE is a function of
    // the embedding logic, the boolean is live policy.
    const cached = this.cache.get(norm) ?? this.store.get(storeKey);
    if (cached) {
      const result = { score: cached.score, isAuthZRelevant: cached.score >= THRESHOLD };
      this.cache.set(norm, result);
      return result;
    }

    const extractor = await this.getExtractor();
    const concepts = await this.getConceptEmbeddings();
    const output = await extractor(`whether ${norm}`, { pooling: 'mean', normalize: true });
    const dim = output.dims.at(-1) as number;
    const embedding = Float32Array.from(output.data.slice(0, dim));

    const score = Math.max(...concepts.map((c) => dot(embedding, c)));
    const result = { score, isAuthZRelevant: score >= THRESHOLD };
    this.cache.set(norm, result);
    this.store.set(storeKey, result);
    return result;
  }
}

// Bump whenever classify's normalization or embedding input changes, to invalidate the persisted
// authz_classifications rows a previous version wrote. v2: camelCase/snake split + "whether" framing.
const CLASSIFIER_VERSION = 2;

/** Split camelCase / snake_case / kebab-case into lowercase space-separated words for embedding. */
export function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Short, identifier-shaped strings only (port of responseEvaluator.js's isValidString filter). */
function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 50
    && !value.includes(' ') && !/^\d+$/.test(value) && /^[a-zA-Z0-9_]+$/.test(value);
}

export interface AuthzAssessment {
  isAuthzRelevant: boolean;
  differences: PropDiff[];
  sensitiveKeys: string[];
}

// A value that is a URL, path or filename is an ASSET reference, not an access-control state. A key
// whose NAME reads like an entitlement but whose VALUE is such an asset is content, not authorization:
// busuu's `course_pack_paywall_1000` is the cover image shown on the paywall screen (value an
// `https://…jpg`), and its name alone tripped the classifier ("paywall", 0.342) on all 96 course-pack
// false positives. Real access flags (`unlocked: true`, `tier: "premium"`) never look like this.
const ASSET_VALUE = /[/\\]|:\/\/|\.(?:jpe?g|png|gif|svg|webp|bmp|ico|mp[34]|wav|ogg|pdf|json|css|js|woff2?)(?:$|\?)/i;
function valueLooksLikeAsset(value: unknown): boolean {
  return typeof value === 'string' && (ASSET_VALUE.test(value) || value.length > 60);
}

/**
 * Port of responseEvaluator.js's assessAuthZ: diffed keys/paths/values classified, not the raw props.
 * The verdict is taken PER DIFF so a key's authz-relevance can be tied to the shape of its own value
 * (see valueLooksLikeAsset): a value that is itself an authz term (`tier: "free" -> "premium"`) always
 * counts, so string enums are preserved; a key that merely READS like an entitlement is honoured only
 * when its differing value is not a URL/asset.
 */
export async function assessAuthZ({ differences, classifier }: {
  differences: PropDiff[]; classifier: AuthzClassifier;
}): Promise<AuthzAssessment> {
  // Classify every candidate token once (cached): keys, path strings and values alike.
  const tokens = [...new Set(differences.flatMap((d) => [d.key, d.pathStr, d.current, d.reference]).filter(isValidString))];
  const relevant = new Map<string, boolean>();
  await Promise.all(tokens.map(async (t) => { relevant.set(t, (await classifier.classify(t)).isAuthZRelevant); }));
  const isRel = (v: unknown): v is string => typeof v === 'string' && relevant.get(v) === true;

  const sensitiveKeys = [...new Set(differences.flatMap((d) => {
    const hits: string[] = [];
    // A value that is itself an authz term always counts (string enums like `premium`/`locked`).
    if (isRel(d.current)) hits.push(d.current);
    if (isRel(d.reference)) hits.push(d.reference);
    // A key/path that reads like an entitlement counts only if the differing value is not an asset URL.
    const nameHit = [d.key, d.pathStr].find(isRel);
    if (nameHit !== undefined && !valueLooksLikeAsset(d.current) && !valueLooksLikeAsset(d.reference)) hits.push(nameHit);
    return hits;
  }))];

  const hasAnyDifference = differences.some((d) => d.reference !== d.current);
  return { isAuthzRelevant: hasAnyDifference && sensitiveKeys.length > 0, differences, sensitiveKeys };
}
