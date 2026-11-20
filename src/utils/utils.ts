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
