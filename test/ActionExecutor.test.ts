import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { ActionExecutor } from '../src/browser/ActionExecutor';
import { OverlayDismisser } from '../src/browser/OverlayDismisser';
import { ClickableExtractor } from '../src/extraction/ClickableExtractor';
import { SelectorBuilder } from '../src/extraction/SelectorBuilder';
import type { Action, ElementDescriptor } from '../src/core/types';
import { APP_ORIGIN, useBrowser } from './helpers/browser';
import './helpers/fakes';

const browser = useBrowser();
const executor = () => new ActionExecutor(APP_ORIGIN, 3000, 4);
const executorWithDismisser = () => new ActionExecutor(APP_ORIGIN, 3000, 4, new OverlayDismisser());
const extractor = new ClickableExtractor(new SelectorBuilder({ gridPx: 4, includeText: true }), []);

async function target(page: Page, text: string): Promise<ElementDescriptor> {
  const el = (await extractor.extract(page)).find((e) => e.text === text);
  assert.ok(el, `element "${text}" not found`);
  return el;
}
const click = (t: ElementDescriptor): Action => ({ type: 'click', target: t });
const clicks = (page: Page) => page.evaluate(() => (window as any).clicks as string[]);

const COUNTER = `
  <script>window.clicks = []</script>
  <button onclick="clicks.push('a')">A</button>
  <button onclick="clicks.push('b')">B</button>`;

describe('ActionExecutor', () => {
  it('clicks the given element', async () => {
    const page = await browser.open({ '/': COUNTER });
    assert.equal(await executor().execute(page, click(await target(page, 'B'))), true);
    assert.deepEqual(await clicks(page), ['b']);
  });

  it('falls back to geometry when the selector no longer matches', async () => {
    const page = await browser.open({ '/': COUNTER });
    const b = await target(page, 'B');
    assert.equal(await executor().execute(page, click({ ...b, selector: 'body > nav:nth-of-type(9)' })), true);
    assert.deepEqual(await clicks(page), ['b']);
  });

  it('does not click when the selector points to an element elsewhere', async () => {
    const page = await browser.open({ '/': COUNTER });
    const a = await target(page, 'A');
    const b = await target(page, 'B');
    // A's selector but B's rectangle: geometry must win
    assert.equal(await executor().execute(page, click({ ...b, selector: a.selector })), true);
    assert.deepEqual(await clicks(page), ['b']);
  });

  it('returns false when the element is gone', async () => {
    const page = await browser.open({ '/': COUNTER });
    const b = await target(page, 'B');
    await page.evaluate(() => document.querySelectorAll('button')[1].remove());
    assert.equal(await executor().execute(page, click(b)), false);
  });

  it('returns false when the element is covered', async () => {
    const page = await browser.open({ '/': COUNTER });
    const b = await target(page, 'B');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div style="position:fixed;inset:0;background:#0008"></div>'));
    assert.equal(await executor().execute(page, click(b)), false);
    assert.deepEqual(await clicks(page), []);
  });

  // Regression: on busuu, a "welcome back" dialog was observed appearing non-deterministically mid
  // run, covering a target that located fine when its state was originally captured. DfsExplorer
  // marks an element explored BEFORE attempting it, so a single bad-luck miss like this is never
  // retried later — the element is permanently skipped even though the exact same click/stability
  // pipeline reaches it cleanly in isolation. With a dismisser, a covering modal is cleared and the
  // click retried once before giving up, instead of failing outright.
  it('dismisses a blocking modal that appeared since the target was captured, then retries the click', async () => {
    const page = await browser.open({ '/': COUNTER });
    const b = await target(page, 'B');
    // a native <dialog>, opened via showModal() like a real "welcome back" interstitial would be:
    // it actually responds to Escape (unlike a plain role=dialog div with no JS behind it), so this
    // fixture exercises the real dismiss-then-retry path, not just "dismiss() was called".
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<dialog style="position:fixed;inset:0;width:100%;height:100%;margin:0"><p>Welcome back</p></dialog>'));
    await page.evaluate(() => (document.querySelector('dialog') as HTMLDialogElement).showModal());

    assert.equal(await executorWithDismisser().execute(page, click(b)), true);
    assert.deepEqual(await clicks(page), ['b']);
  });

  // Regression for the follow-up to the "welcome back" case: a blocker with no role=dialog/aria-modal
  // at all (so OverlayDismisser's Escape + close-control search both find nothing to act on) still
  // gets cleared, as a last resort, by hiding (display:none) whatever the failed hit-test found
  // covering the target — the same information locateTarget's own miss already computed, no DOM
  // diffing against an earlier snapshot needed.
  it('hides a non-dialog overlay covering most of the viewport, then retries the click', async () => {
    const page = await browser.open({ '/': COUNTER });
    const b = await target(page, 'B');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="shield" style="position:fixed;inset:0;background:#0008"></div>')); // no role=dialog
    assert.equal(await executorWithDismisser().execute(page, click(b)), true);
    assert.deepEqual(await clicks(page), ['b']);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('shield')!).display), 'none');
  });

  it('still returns false when what covers the target is too small to be an overlay (left alone)', async () => {
    const page = await browser.open({ '/': COUNTER });
    const b = await target(page, 'B');
    // small floating element, not an overlay: covers B but far from half the viewport
    await page.evaluate(() => {
      const bRect = document.querySelectorAll('button')[1].getBoundingClientRect();
      document.body.insertAdjacentHTML('beforeend',
        `<div style="position:fixed;left:${bRect.x}px;top:${bRect.y}px;width:${bRect.width}px;height:${bRect.height}px;background:#0008"></div>`);
    });
    assert.equal(await executorWithDismisser().execute(page, click(b)), false);
    assert.deepEqual(await clicks(page), []);
  });

  it('reaches elements outside the viewport', async () => {
    const page = await browser.open({ '/': `<script>window.clicks = []</script>
      <div style="height:3000px"></div><button onclick="clicks.push('giu')">Giu</button>` });
    assert.equal(await executor().execute(page, click(await target(page, 'Giu'))), true);
    assert.deepEqual(await clicks(page), ['giu']);
  });

  it('automatically dismisses alert and confirm', async () => {
    const page = await browser.open({ '/': `
      <button onclick="alert('ciao'); document.title = confirm('sicuro?') ? 'si' : 'no'">Dialog</button>` });
    assert.equal(await executor().execute(page, click(await target(page, 'Dialog'))), true);
    await page.waitForFunction(() => document.title === 'no', null, { timeout: 2000 });
  });

  it('accepts beforeunload prompts, so that a page cannot block the next navigation', async () => {
    const page = await browser.open({
      '/': `<script>addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; })</script>
        <button>Lesson</button>`,
      '/due': '<p>due</p>',
    });
    // the click gives the page the user activation that Chrome requires to show the prompt
    assert.equal(await executor().execute(page, click(await target(page, 'Lesson'))), true);
    await page.goto(`${APP_ORIGIN}/due`);
    assert.equal(await page.textContent('p'), 'due');
  });

  it('blocks navigation to other domains, staying on the page', async () => {
    const page = await browser.open({ '/': '<a href="https://other.test/">Esterno</a><p>casa</p>' });
    assert.equal(await executor().execute(page, click(await target(page, 'Esterno'))), true);
    await page.waitForTimeout(300);
    assert.equal(page.url(), `${APP_ORIGIN}/`);
    assert.equal(await page.textContent('p'), 'casa');
  });

  it('lets same-domain navigation through', async () => {
    const page = await browser.open({ '/': '<a href="/due">Vai</a>', '/due': '<p>due</p>' });
    assert.equal(await executor().execute(page, click(await target(page, 'Vai'))), true);
    await page.waitForURL(`${APP_ORIGIN}/due`);
  });

  it('cancels a download triggered by a click, without blocking it', async () => {
    const page = await browser.open({ '/': '<a href="/file.bin" download>File</a>', '/file.bin': 'payload' });
    const downloadPromise = page.waitForEvent('download');
    assert.equal(await executor().execute(page, click(await target(page, 'File'))), true);
    const download = await downloadPromise;
    assert.equal(await download.failure(), 'canceled');
  });

  // The OS launching mailto:/tel:/… cannot be observed from the page, so we assert the browser-side
  // guard cancelled the anchor's default action (what would otherwise hand the URL to the OS).
  it('cancels clicks on external-app protocol links (mailto/tel/sms/webcal/zoommtg)', async () => {
    for (const href of ['mailto:user@example.com', 'tel:+33123456789', 'sms:+33123456789',
      'webcal://example.com/c.ics', 'zoommtg://zoom.us/join?confno=1']) {
      const page = await browser.open({ '/': `<a href="${href}" style="display:block;width:200px;height:40px">Link</a>` });
      // bubble-phase listener runs after the capture-phase guard: records whether default was cancelled
      await page.evaluate(() => {
        (window as any).prevented = null;
        document.querySelector('a')!.addEventListener('click', (e) => { (window as any).prevented = e.defaultPrevented; });
      });
      const rect = await page.evaluate(() => {
        const r = document.querySelector('a')!.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      const t: ElementDescriptor = { id: 'x', selector: 'a', tag: 'a', rect, fixed: false, text: 'Link', href };
      assert.equal(await executor().execute(page, click(t)), true);
      assert.equal(await page.evaluate(() => (window as any).prevented), true, `${href} should be cancelled`);
    }
  });

  it('does not cancel clicks on ordinary in-page links', async () => {
    const page = await browser.open({ '/': '<a href="#section" style="display:block;width:200px;height:40px">Ancora</a>' });
    await page.evaluate(() => {
      (window as any).prevented = null;
      document.querySelector('a')!.addEventListener('click', (e) => { (window as any).prevented = e.defaultPrevented; });
    });
    const rect = await page.evaluate(() => {
      const r = document.querySelector('a')!.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const t: ElementDescriptor = { id: 'x', selector: 'a', tag: 'a', rect, fixed: false, text: 'Ancora', href: '#section' };
    assert.equal(await executor().execute(page, click(t)), true);
    assert.equal(await page.evaluate(() => (window as any).prevented), false);
  });

  it('closes new tabs', async () => {
    const page = await browser.open({ '/': '<a href="/x" target="_blank">Tab</a>', '/x': 'x' });
    assert.equal(await executor().execute(page, click(await target(page, 'Tab'))), true);
    await page.waitForTimeout(500);
    assert.deepEqual(page.context().pages(), [page]);
  });
});
