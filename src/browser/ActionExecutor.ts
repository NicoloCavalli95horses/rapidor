import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { IActionExecutor } from '../core/interfaces';
import type { IOverlayDismisser } from './OverlayDismisser';
import type { Action } from '../core/types';
import { evaluateInPage } from './evaluateInPage';
import { locateTarget } from './inPage/locateTarget';
import { hideBlockingOverlay } from './inPage/hideBlockingOverlay';
import { blockExternalProtocols } from './inPage/blockExternalProtocols';
import { DEFAULT_ALLOWED_LINK_SCHEMES } from '../utils/utils';

export class ActionExecutor implements IActionExecutor {
  private guardedPages = new WeakSet<Page>();

  constructor(
    private allowedOrigin: string,   // blocks off-domain navigation
    private timeoutMs: number,
    private tolerancePx: number,     // allowed deviation between the saved and the current rectangle
    // optional: shares StateCapturer's own OverlayDismisser (same instance, no separate state needed).
    // Without one, a target newly covered by an unrelated interstitial just fails to locate, as before.
    private dismisser?: IOverlayDismisser,
    // href schemes allowed in-browser; a click on any other (mailto:/tel:/…) is cancelled in-page
    private allowedLinkSchemes: string[] = DEFAULT_ALLOWED_LINK_SCHEMES,
  ) {}

  /** Never throws: any problem becomes false and the engine moves on. */
  async execute(page: Page, action: Action): Promise<boolean> {
    try {
      await this.installGuards(page);
      return await withTimeout(this.click(page, action), this.timeoutMs);
    } catch (err) {
      log.debug(`Action on "${action.target.text ?? action.target.selector}" failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Whether the target is reachable right now, without clicking it. Used by StateNavigator to
   * confirm a tolerant restore (same route + the element to click is present). Uses the exact same
   * locate-and-clear-overlay pipeline as a real click, so "locate says yes" and "the click will find
   * it" stay in lock-step. Never throws: any problem becomes false.
   */
  async locate(page: Page, action: Action): Promise<boolean> {
    try {
      await this.installGuards(page);
      return await withTimeout(this.locatePoint(page, action).then((p) => p !== null), this.timeoutMs);
    } catch (err) {
      log.debug(`Locating "${action.target.text ?? action.target.selector}" failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Finds and clicks the target; on a miss, tries once to clear a blocking overlay first before
   * giving up. A target that located fine when its state was captured can still fail to locate on a
   * LATER restore (a fresh reload + replay of every action back to it) if some unrelated interstitial
   * — e.g. a "welcome back" dialog that shows up non-deterministically on load, unrelated to anything
   * the exploration itself did — now sits on top of it: `locateTarget`'s hit-test sees the dialog,
   * not the real target, and reports it as unreachable, exactly as if it had actually disappeared.
   * Confirmed live on busuu: a stray "welcome back" modal was seen mid-run; this is almost certainly
   * why individual (state, element) pairs went permanently unexplored (DfsExplorer.visit marks an
   * element explored BEFORE attempting it, so a single bad-luck miss here is never retried later) even
   * though the exact same click/stability pipeline, run once in isolation, reaches the target cleanly.
   * One retry is enough: OverlayDismisser.dismiss() already tries twice internally (Escape, then an
   * explicit close control) before giving up, and the busuu case genuinely is a one-off dialog.
   *
   * If that still isn't enough — the blocker has no ARIA modal semantics at all, so Escape and the
   * close-control search both find nothing to act on — hideBlockingOverlay is tried as a last resort:
   * it reuses this very call's own failed hit-test to hide (display:none, never removed) exactly
   * whatever is actually sitting on top of the target, no DOM-diffing/guessing involved. See that
   * function's own doc comment for why it can never end up hiding the real target by mistake.
   */
  private async click(page: Page, action: Action): Promise<boolean> {
    const point = await this.locatePoint(page, action);
    if (!point) return false;
    // click at coordinates: same semantics as the hit-test used during extraction
    await page.mouse.click(point.x, point.y);
    return true;
  }

  /**
   * Finds the target and returns where to click it, clearing a blocking overlay first if a direct
   * hit-test misses (see this class's locate/click doc comments). Returns null if, even after that,
   * nothing of the target is reachable. Shared by `click` (which then clicks the point) and `locate`
   * (which only cares whether a point exists).
   */
  private async locatePoint(page: Page, action: Action): Promise<{ x: number; y: number } | null> {
    const t = action.target;
    const args = { selector: t.selector, tag: t.tag, rect: t.rect, fixed: t.fixed, tolerancePx: this.tolerancePx };
    let point = await evaluateInPage(page, locateTarget, args);
    if (!point && this.dismisser) {
      if (await this.dismisser.dismiss(page)) {
        point = await evaluateInPage(page, locateTarget, args);
      }
      if (!point) {
        const { hidden } = await evaluateInPage(page, hideBlockingOverlay, { rect: t.rect, fixed: t.fixed });
        if (hidden) point = await evaluateInPage(page, locateTarget, args);
      }
    }
    return point;
  }

  /** Installed once per page. */
  private async installGuards(page: Page): Promise<void> {
    if (!this.guardedPages.has(page)) {
      this.guardedPages.add(page);

      // alert/confirm/prompt block the page until someone dismisses them. beforeunload is accepted instead:
      // dismissing it cancels the navigation, so every restore of that tab would fail with ERR_ABORTED and the tab would stay stuck on the page
      page.on('dialog', (d) => { (d.type() === 'beforeunload' ? d.accept() : d.dismiss()).catch(() => {}); });

      // target=_blank links and window.open: only tabs opened by this page are closed
      page.on('popup', (p) => { p.close().catch(() => {}); });

      // a "download" link/button is never blocked (the request behind it may still be worth
      // mutating for IDOR, like any other), but the file itself is attacker-controlled content from
      // a site under test: it is never written to disk, only logged so the run stays auditable.
      page.on('download', (d) => {
        log.warning(`Download triggered by exploration, cancelled: ${d.url()} (suggested filename: ${d.suggestedFilename()})`);
        d.cancel().catch(() => {});
      });

      await this.blockExternalNavigation(page);
      await this.blockExternalProtocolHandlers(page);
    }
  }

  /**
   * Cancels clicks on mailto:/tel:/sms:/webcal:/zoommtg:/app-deep-link anchors, so the OS never
   * launches an external app mid-exploration. addInitScript covers every future navigation (restores
   * reload the page), and a one-off evaluate covers the document already loaded. The guard is
   * idempotent, so running both is safe.
   */
  private async blockExternalProtocolHandlers(page: Page): Promise<void> {
    const arg = { allowedSchemes: this.allowedLinkSchemes };
    // same serialization trick as evaluateInPage (keepNames inserts __name, absent in the browser)
    const source = `(() => { const __name = (f) => f; (${blockExternalProtocols.toString()})(${JSON.stringify(arg)}); })();`;
    await page.addInitScript({ content: source });
    await page.evaluate(source).catch(() => {});   // no document yet (about:blank): the init script will cover it
  }

  /**
   * Intercepts documents only, via CDP. With page.route Playwright disables the HTTP cache and
   * every restore would re-download all the site's resources: this way they stay cached.
   */
  private async blockExternalNavigation(page: Page): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    // the main frame id stays the same across navigations; asking for it while a request is paused blocks the page
    const mainFrameId = (await cdp.send('Page.getFrameTree')).frameTree.frame.id;
    cdp.on('Fetch.requestPaused', async (e) => {
      try {
        if (e.frameId === mainFrameId && new URL(e.request.url).origin !== this.allowedOrigin) {
          log.debug(`External navigation blocked: ${e.request.url}`);
          // with a 204 the browser stays on the current page; failRequest would show the error page
          await cdp.send('Fetch.fulfillRequest', { requestId: e.requestId, responseCode: 204 });
        } else {
          await cdp.send('Fetch.continueRequest', { requestId: e.requestId });
        }
      } catch {
        // page closed in the meantime
      }
    });
    await cdp.send('Fetch.enable', { patterns: [{ resourceType: 'Document' }] });
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
