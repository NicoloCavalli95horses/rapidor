import type { Page } from 'playwright';
import { installParamUsageTracking } from '../browser/paramUsageTracker';

/**
 * A fixed-size pool of browser pages for the client-routing phase, which runs its probes/screenshots
 * in parallel. Each probe mutates a page's live DOM (pushState) and screenshots it, so a probe owns a
 * page exclusively while it runs; `freePages` are the idle ones and `pageWaiters` are tasks blocked
 * waiting for one. `extraPages` are the pages the pool created from the caller's context (closed on
 * teardown); the caller's own page stays in the pool but is never closed here. Sized by
 * `clientRoutingConcurrency`.
 */
export class PagePool {
  private freePages: Page[] = [];
  private pageWaiters: ((page: Page) => void)[] = [];
  private extraPages: Page[] = [];

  /**
   * Builds the pool for one analysis run: the caller's own page plus `size - 1` fresh pages from the
   * SAME browser context (so they share the authenticated cookies), each with the param-usage init
   * script installed (the query probe reads window.__accessedParams). All start free.
   */
  async setup({ page, size }: { page: Page; size: number }): Promise<void> {
    this.extraPages = [];
    const pages: Page[] = [page];
    for (let i = 1; i < size; i++) {
      const extra = await page.context().newPage();
      await installParamUsageTracking(extra);
      this.extraPages.push(extra);
      pages.push(extra);
    }
    this.freePages = pages;
    this.pageWaiters = [];
  }

  /** Closes the pages this run created (never the caller's own page) and resets the pool. */
  async teardown(): Promise<void> {
    const toClose = this.extraPages;
    this.extraPages = [];
    this.freePages = [];
    this.pageWaiters = [];
    for (const extra of toClose) await extra.close().catch(() => undefined);
  }

  /** Takes a free page, or waits until one is released. */
  private acquire(): Promise<Page> {
    const free = this.freePages.pop();
    if (free) return Promise.resolve(free);
    return new Promise<Page>((resolve) => this.pageWaiters.push(resolve));
  }

  /** Returns a page to the pool, handing it straight to the next waiter if there is one. */
  private release(page: Page): void {
    const waiter = this.pageWaiters.shift();
    if (waiter) waiter(page);
    else this.freePages.push(page);
  }

  /** Runs `run` on an exclusively-held pool page, navigated to `pageUrl` first; always releases it. */
  async withPage<T>({ pageUrl, run }: { pageUrl: string; run: (page: Page) => Promise<T> }): Promise<T> {
    const page = await this.acquire();
    try {
      if (page.url() !== pageUrl) {
        await page.goto(pageUrl, { waitUntil: 'load', timeout: 10_000 }).catch(() => undefined);
      }
      return await run(page);
    } finally {
      this.release(page);
    }
  }
}
