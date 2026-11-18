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
