/**
 * Port of RAPIDOR's modules/state/preindexing.js: finds React prop values worth indexing for later
 * match-finding (an HTTP request's URL segment -> a component instance carrying that value).
 * Constants below mirror RAPIDOR's config.js (preindexedKeys, maxStrLength=300) and
 * preindexing.js's own maxDepth=4, copied here since the crawler does not share a config with the
 * extension.
 */

// The full-path value is tokenized (split on `/.?`), so the bare URL segment still matches;
// `maxSegmentMatches` drops the generic ones that index everywhere.
const PREINDEXED_KEYS = [
  'id', 'user', 'account', 'profile', 'order',
  'resource', 'item', 'object', 'doc', 'name', 'key', 'title', 'type', 'url', 'link',
  'owner', 'author', 'creator', 'role', 'permission', 'scope',
  'content', 'node', 'slug', 'href',
];
const MAX_STR_LENGTH = 300;
const MAX_DEPTH = 4;

export interface PreindexRow {
  nodeId: string;
  value: string;           // one token per row (SQL equivalent of IndexedDB's multiEntry index)
  path: (string | number)[];
  depth: number;
}

/** camelCase -> words, then split on anything non-alphanumeric. */
function splitWords(str: string): string[] {
  return str.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/);
}

/** Word-level exact/prefix match against PREINDEXED_KEYS (e.g. "id" <-> "userId"). */
export function isKeyMatch(key: unknown): boolean {
  if (!key) return false;
  const words = splitWords(String(key).trim().toLowerCase());
  return PREINDEXED_KEYS.some((k) => {
    const lower = k.toLowerCase();
    return words.includes(lower) || words.some((w) => w.startsWith(lower)) || words.some((w) => lower.startsWith(w));
  });
}

export function isInteresting(key: unknown, value: unknown): boolean {
  if (value == null) return false;
  if (!isKeyMatch(key)) return false;
  if (typeof value === 'string') {
    if (/^\[.*\]$/.test(value) || /\s/.test(value)) return false;
    const trimmed = value.trim();
    return trimmed.length > 1 && trimmed.length < MAX_STR_LENGTH;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
}

/** Splits on /, . or ? so a URL-like prop value becomes separately matchable tokens. */
export function tokenize(value: string, rule = /[/.?]/): string[] {
  return value.split(rule).map((v) => v.trim()).filter(Boolean);
}

interface IterEntry { value: unknown; path: (string | number)[]; key?: string | number }

function iterateProps(root: unknown, cb: (e: { key?: string | number; value: unknown; path: (string | number)[] }) => void, maxDepth = MAX_DEPTH): void {
  const stack: IterEntry[] = [{ value: root, path: ['props'], key: undefined }];
  while (stack.length) {
    const { value, path, key } = stack.pop()!;
    if (path.length > maxDepth) continue;
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) stack.push({ key: i, value: value[i], path: [...path, i] });
    } else if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [k, v] = entries[i];
        stack.push({ key: k, value: v, path: [...path, k] });
      }
    } else {
      cb({ key, value, path });
    }
  }
}

/** One node's indexable rows: its own `key` (raw, untokenized) plus any interesting prop leaf (tokenized). */
export function collectPreindexRows({ nodeId, key, props }: { nodeId: string; key?: unknown; props?: unknown }): PreindexRow[] {
  const rows: PreindexRow[] = [];
  if (isInteresting('key', key)) {
    rows.push({ nodeId, value: String(key), path: ['key'], depth: 0 });
  }
  iterateProps(props, ({ key: leafKey, value, path }) => {
    if (!isInteresting(leafKey, value)) return;
    for (const token of tokenize(String(value))) {
      rows.push({ nodeId, value: token, path, depth: path.length });
    }
  });
  return rows;
}
