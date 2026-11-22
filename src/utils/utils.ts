/**
 * Generic, dependency-free helpers shared across the codebase. Nothing here knows about the crawler,
 * the analysis pipeline or any store — only plain concurrency and URL primitives. Domain-specific
 * helpers belong next to their consumer (e.g. analysis-specific URL canonicalization in the pipeline),
 * not here.
 */

/** Resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Arithmetic mean, or 0 for an empty input. */
export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Median (average of the two middle values for an even count); 0 for an empty input. */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The most frequent value; ties broken by the smallest value, so the result is deterministic. Useful
 * across the 17-app set where a modal count (e.g. findings per app) is more telling than the mean.
 * Returns 0 for an empty input.
 */
export function mode(values: number[]): number {
  if (!values.length) return 0;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount || (c === bestCount && v < best)) { best = v; bestCount = c; }
  }
  return best;
}

/**
 * Split a param/field NAME into lowercase tokens across camelCase, snake_case, kebab and letter/digit
 * boundaries, so `maxLevel` / `max_level` / `MaxLevel` all yield `['max','level']`. Shared by the
 * param-name blacklist (candidateGenerator) and the identifier guard in URL canonicalization (findings).
 */
export function tokenizeParamName(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')                                        // camelCase boundary
    .split(/[^a-zA-Z0-9]+/)                                                         // snake / kebab / other separators
    .flatMap((s) => s.split(/(?<=[a-zA-Z])(?=[0-9])|(?<=[0-9])(?=[a-zA-Z])/))       // letter/digit boundary
    .map((s) => s.toLowerCase())
    .filter(Boolean);
}

/** URL schemes a clickable's href may use. Anything else is an external-app handler. */
export const DEFAULT_ALLOWED_LINK_SCHEMES = ['http', 'https', 'javascript', 'about'];

/**
 * The lowercased scheme of an href, or null when it has none: relative links, `#anchor`, `/path`,
 * `?q`, and protocol-relative `//host` all return null (they stay inside the browser).
 */
export function linkScheme(href: string): string | null {
  const m = /^\s*([a-z][a-z0-9+.-]*):/i.exec(href);
  return m ? m[1].toLowerCase() : null;
}

/**
 * True when href hands off to an external app instead of navigating in-browser: its scheme is set
 * and outside the allowlist (mailto:, tel:, sms:, webcal:, zoommtg:, custom app deep-links, …).
 * Such clickables are dropped so the OS never launches another process mid-exploration.
 */
export function isExternalAppLink({ href, allowedSchemes = DEFAULT_ALLOWED_LINK_SCHEMES }:
  { href: string | undefined | null; allowedSchemes?: string[] }): boolean {
  if (!href) return false;
  const scheme = linkScheme(href);
  return scheme !== null && !allowedSchemes.includes(scheme);
}

/** Port of RAPIDOR's utils.js runWithConcurrency: bounded-concurrency task pool. */
export async function runWithConcurrency<T>({ tasks, limit }: { tasks: (() => Promise<T>)[]; limit: number }): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/** Minimal counting semaphore: bounds how many `run`s are in flight at once. */
export class Semaphore {
  private permits: number;
  private waiters: (() => void)[] = [];
  constructor(permits: number) { this.permits = Math.max(1, permits); }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.permits > 0) this.permits--;
    else await new Promise<void>((resolve) => this.waiters.push(resolve));
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.permits++;
    }
  }
}

/** The decoded pathname of a URL (trailing slash stripped); '' if it cannot be parsed. */
export function safePath(raw: string): string {
  try { return decodeURIComponent(new URL(raw).pathname).replace(/\/+$/, '') || '/'; } catch { return ''; }
}

/** Whether two URLs resolve to the same route PATH (query/hash ignored): a redirect-away changes it. */
export function sameRoutePath(a: string, b: string): boolean {
  const pathA = safePath(a);
  return pathA !== '' && pathA === safePath(b);
}

/**
 * Whether `value` appears as a bounded token ANYWHERE in the url (decoded) — including inside a query
 * param's own internal path (ejoy's `?path=…/live/37/lessons/…`), not only as a whole segment or whole
 * param value like `urlCarriesValue`. Used to spot a path swap left INCOHERENT by an unmutated copy of
 * the old value elsewhere in the url (the Frankenstein-page false positive). Boundary-aware so "37"
 * never matches "370" or a hex hash; falls back to a plain includes if decoding fails.
 */
export function urlEmbedsValue(url: string, value: string): boolean {
  if (!value) return false;
  let decoded = url;
  try { decoded = decodeURIComponent(url); } catch { /* keep the raw url */ }
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(`(?<![0-9A-Za-z])${escaped}(?![0-9A-Za-z])`).test(decoded);
  } catch {
    return decoded.includes(value);
  }
}


/** The URL with one query param set to `value` (unchanged on malformed input). */
export function withParam({ url, name, value }: { url: string; name: string; value: string }): string {
  try {
    const u = new URL(url);
    u.searchParams.set(name, value);
    return u.href;
  } catch {
    return url;
  }
}


/** A new array with the same elements in random order (Fisher-Yates). Never mutates the input. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
