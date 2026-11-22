import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClickableExtractor } from '../src/extraction/ClickableExtractor';
import { SelectorBuilder } from '../src/extraction/SelectorBuilder';
import { useBrowser } from './helpers/browser';
import './helpers/fakes';

const browser = useBrowser();
const extractor = (blocklist: string[] = []) =>
  new ClickableExtractor(new SelectorBuilder({ gridPx: 4, includeText: true }), blocklist);
const texts = async (html: string, blocklist: string[] = []) =>
  (await extractor(blocklist).extract(await browser.withHtml(html))).map((e) => e.text);

describe('ClickableExtractor', () => {
  it('finds semantic elements', async () => {
    const found = await texts(`
      <a href="/x">Link</a><button>Bottone</button><div role="button">Ruolo</div>
      <div aria-label="Spunta" role="checkbox">Spunta</div><div tabindex="0">Focus</div>
      <div onclick="void 0">Onclick</div><a>Senza href</a>`);
    assert.deepEqual(found, ['Link', 'Bottone', 'Ruolo', 'Spunta', 'Focus', 'Onclick']);
  });

  it('never treats a form field as a clickable, however it would otherwise be detected', async () => {
    const found = await texts(`
      <input type="checkbox" aria-label="Nativa">
      <input type="button" value="Finto bottone">
      <select><option>Scegli</option></select>
      <textarea tabindex="0">Nota</textarea>
      <input type="text" style="cursor:pointer" onclick="void 0">`);
    assert.deepEqual(found, []);
  });

  it('a form field with a React click handler is still excluded', async () => {
    const page = await browser.withHtml('<input id="i" type="text"><div>Testo</div>');
    await page.evaluate(() => { (document.getElementById('i') as any)['__reactProps$abc'] = { onClick() {} }; });
    const found = (await extractor().extract(page)).map((e) => e.text);
    assert.deepEqual(found, []);
  });

  it('finds divs with React handlers in their internal props', async () => {
    const page = await browser.withHtml('<div id="r" style="width:100px">Card</div><div>Testo</div>');
    await page.evaluate(() => { (document.getElementById('r') as any)['__reactProps$abc'] = { onClick() {} }; });
    const found = (await extractor().extract(page)).map((e) => e.text);
    assert.deepEqual(found, ['Card']);
  });

  it('with cursor: pointer keeps only the root of the clickable area', async () => {
    const found = await texts(`
      <div style="cursor:pointer;width:200px">Riga <span>dettaglio</span></div>`);
    assert.deepEqual(found, ['Riga dettaglio']);
  });

  it('excludes hidden, disabled, inert and transparent elements', async () => {
    const found = await texts(`
      <button>Visibile</button>
      <button disabled>Disabilitato</button>
      <button aria-disabled="true">Aria disabilitato</button>
      <button style="display:none">Display none</button>
      <button style="visibility:hidden">Invisibile</button>
      <div style="opacity:0"><button>Trasparente</button></div>
      <div aria-hidden="true"><button>Aria hidden</button></div>
      <div inert><button>Inerte</button></div>
      <button style="pointer-events:none">No pointer</button>`);
    assert.deepEqual(found, ['Visibile']);
  });

  it('excludes elements covered by a modal', async () => {
    const found = await texts(`
      <button>Sotto</button>
      <div style="position:fixed;inset:0;background:#0008"><button>Nel modale</button></div>`);
    assert.deepEqual(found, ['Nel modale']);
  });

  it('merges a clickable container with a child of the same size', async () => {
    const found = await texts(
      '<div style="cursor:pointer;display:inline-block"><button>Interno</button></div>');
    assert.deepEqual(found, ['Interno']);
  });

  it('keeps the innermost of near-overlapping nested clickables (container a few px larger)', async () => {
    const found = await texts(
      '<div style="cursor:pointer;padding:1px;display:inline-block"><button style="width:200px;height:40px">Dentro</button></div>');
    assert.deepEqual(found, ['Dentro']);
  });

  it('drops a non-semantic clickable whose box is an extreme size outlier vs the rest', async () => {
    // six small buttons + one huge cursor:pointer div (>8x the median area) => the div is a false positive
    const found = await texts(`
      <button style="width:40px;height:40px">b1</button>
      <button style="width:40px;height:40px">b2</button>
      <button style="width:40px;height:40px">b3</button>
      <button style="width:40px;height:40px">b4</button>
      <button style="width:40px;height:40px">b5</button>
      <button style="width:40px;height:40px">b6</button>
      <div style="cursor:pointer;width:600px;height:400px">Huge wrapper</div>`);
    assert.ok(!found.includes('Huge wrapper'), `huge non-semantic div should be dropped: ${found}`);
    assert.ok(found.includes('b1') && found.includes('b6'), `real buttons kept: ${found}`);
  });

  it('keeps a large SEMANTIC clickable even when it is a size outlier', async () => {
    const found = await texts(`
      <button style="width:40px;height:40px">b1</button>
      <button style="width:40px;height:40px">b2</button>
      <button style="width:40px;height:40px">b3</button>
      <button style="width:40px;height:40px">b4</button>
      <button style="width:40px;height:40px">b5</button>
      <a href="/hero" style="display:block;width:600px;height:400px">Hero link</a>`);
    assert.ok(found.includes('Hero link'), `semantic outlier must be kept: ${found}`);
  });

  it('ignores clickables inside configured containers (nav/header/footer)', async () => {
    const page = await browser.withHtml(`
      <header><button>In header</button></header>
      <nav><a href="/x">In nav</a></nav>
      <main><button>In main</button></main>
      <footer><a href="/y">In footer</a></footer>`);
    const extractor = new ClickableExtractor(
      new SelectorBuilder({ gridPx: 4, includeText: true }), [], ['nav', 'header', 'footer'],
    );
    const found = (await extractor.extract(page)).map((e) => e.text);
    assert.deepEqual(found, ['In main']);
  });

  it('applies the blocklist to text, aria-label and href', async () => {
    const found = await texts(`
      <button>Salva</button><button>Logout</button>
      <button aria-label="Elimina account">X</button><a href="/auth/logout">Esci ora</a>`,
      ['logout', 'elimina']);
    assert.deepEqual(found, ['Salva']);
  });

  it('discards links to external-app protocol handlers (mailto/tel/sms/webcal/zoommtg)', async () => {
    const found = await texts(`
      <a href="mailto:user@example.com">Email</a>
      <a href="tel:+33123456789">Call</a>
      <a href="sms:+33123456789">SMS</a>
      <a href="webcal://example.com/cal.ics">Calendar</a>
      <a href="zoommtg://zoom.us/join?confno=1">Zoom</a>
      <a href="customapp://do/something">Deep link</a>
      <a href="/page">Interno</a>
      <a href="https://example.com/x">Esterno http</a>
      <a href="#section">Ancora</a>`);
    assert.deepEqual(found, ['Interno', 'Esterno http', 'Ancora']);
  });

  it('tells apart elements with the same tag, rectangle and text using a suffix', async () => {
    // outside the viewport there is no hit-test: two overlapping buttons are both kept
    const page = await browser.withHtml(`
      <div style="height:3000px"></div>
      <button style="position:absolute;left:0;top:2000px;width:50px">Uno</button>
      <button style="position:absolute;left:0;top:2000px;width:50px">Uno</button>`);
    const ids = (await extractor().extract(page)).map((e) => e.id);
    assert.equal(ids.length, 2);
    assert.equal(ids[1], `${ids[0]}:1`);
  });

  it('uses document coordinates: scrolling does not change rectangles', async () => {
    const page = await browser.withHtml(
      '<div style="height:3000px"></div><button>In fondo</button>');
    const before = await extractor().extract(page);
    await page.evaluate(() => scrollTo(0, 2000));
    const after = await extractor().extract(page);
    assert.deepEqual(after.map((e) => e.id), before.map((e) => e.id));
    assert.deepEqual(after[0].rect, before[0].rect);
  });

  it('marks fixed elements with viewport coordinates', async () => {
    const page = await browser.withHtml(`
      <div style="height:3000px"></div>
      <footer style="position:fixed;bottom:0;left:0"><button>Footer</button></footer>`);
    await page.evaluate(() => scrollTo(0, 1500));
    const [footer] = await extractor().extract(page);
    assert.equal(footer.fixed, true);
    assert.ok(footer.rect.y < 800, `y=${footer.rect.y} should be inside the viewport`);
  });

  it('produces a structural selector that finds the element', async () => {
    const page = await browser.withHtml('<div class="x1"><p><button id="r4nd0m">Ok</button></p></div>');
    const [el] = await extractor().extract(page);
    assert.doesNotMatch(el.selector, /x1|r4nd0m/);
    assert.equal(await page.locator(el.selector).textContent(), 'Ok');
  });
});
