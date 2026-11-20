import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { applyAuthOverride } from '../src/analysis/authSession';
import { forgeRequest } from '../src/analysis/requestForge';
import { useBrowser } from './helpers/browser';

// ----- applyAuthOverride: pure header transform ---------------------------------------------------

test('applyAuthOverride: no override returns the headers untouched (common path, token never expired)', () => {
  const headers = { Authorization: 'Bearer t1', Cookie: 'sess=t1', Accept: 'application/json' };
  assert.deepEqual(applyAuthOverride({ headers, override: undefined }), headers);
  assert.deepEqual(applyAuthOverride({ headers, override: null }), headers);
});

test('applyAuthOverride: stripCookie drops the captured Cookie (any case), keeps the rest', () => {
  const out = applyAuthOverride({
    headers: { Cookie: 'sess=stale', Accept: 'application/json' },
    override: { stripCookie: true, freshHeaders: {} },
  });
  assert.deepEqual(out, { Accept: 'application/json' });
});

test('applyAuthOverride: freshHeaders replace the captured value case-insensitively and add new ones', () => {
  const out = applyAuthOverride({
    headers: { Authorization: 'Bearer stale', 'X-Keep': '1' },
    override: { stripCookie: false, freshHeaders: { authorization: 'Bearer fresh', 'x-auth-token': 'xyz' } },
  });
  // the stale `Authorization` is gone (replaced, no duplicate key of a different case), `X-Keep` survives
  assert.equal(out?.['X-Keep'], '1');
  assert.equal(out?.authorization, 'Bearer fresh');
  assert.equal(out?.['x-auth-token'], 'xyz');
  assert.equal(out?.Authorization, undefined);
});

// ----- end-to-end forge: the analysis survives an auth refresh (no 403s) --------------------------
// A local server stands in for a real target: a resource the entitled user CAN read, denied (403) to a
// stale session and served (200) to the refreshed one. Proves the forge, re-pointed via applyAuthOverride,
// stops getting 403s after a refresh — the whole point of Phase 1 — for both auth regimes.

const browser = useBrowser();

function startServer(handler: http.RequestListener): Promise<{ origin: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

test('forge survives a BEARER refresh: stale token -> 403, overlaid fresh token -> 200', async () => {
  const srv = await startServer((req, res) => {
    const ok = req.headers['authorization'] === 'Bearer fresh-token';
    res.writeHead(ok ? 200 : 403).end(ok ? 'PAID-CONTENT' : 'access denied');
  });
  try {
    const page = await browser.newPage();
    const captured = { Authorization: 'Bearer stale-token' };   // what the crawl captured at t1

    // Anti-loop property: a denied forge is just a 403 status, never an exception / retry. Nothing in the
    // forge path re-authenticates — only the up-front entry-point gate does.
    const stale = await forgeRequest({ page, url: `${srv.origin}/paid`, method: 'GET', headers: captured });
    assert.equal(stale.status, 403);

    const refreshed = await forgeRequest({
      page, url: `${srv.origin}/paid`, method: 'GET',
      headers: applyAuthOverride({ headers: captured, override: { stripCookie: true, freshHeaders: { authorization: 'Bearer fresh-token' } } }),
    });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.body, 'PAID-CONTENT');
  } finally {
    await srv.close();
  }
});

test('forge survives a COOKIE refresh: stale cookie replayed -> 403, stripped so the context cookie applies -> 200', async () => {
  const srv = await startServer((req, res) => {
    const cookie = req.headers['cookie'] ?? '';
    const ok = /(?:^|[;\s])sess=valid(?:;|$)/.test(cookie) && !/(?:^|[;\s])sess=stale(?:;|$)/.test(cookie);
    res.writeHead(ok ? 200 : 403).end(ok ? 'PAID-CONTENT' : 'access denied');
  });
  try {
    const page = await browser.newPage();
    // The re-login left a FRESH cookie in the browser context; the captured headers still carry the STALE one.
    await page.context().addCookies([{ name: 'sess', value: 'valid', url: srv.origin }]);
    const captured = { Cookie: 'sess=stale' };

    const stale = await forgeRequest({ page, url: `${srv.origin}/paid`, method: 'GET', headers: captured });
    assert.equal(stale.status, 403);   // the replayed stale cookie wins/poisons -> denied

    const refreshed = await forgeRequest({
      page, url: `${srv.origin}/paid`, method: 'GET',
      headers: applyAuthOverride({ headers: captured, override: { stripCookie: true, freshHeaders: {} } }),
    });
    assert.equal(refreshed.status, 200);   // no explicit Cookie -> the context's fresh cookie is used
    assert.equal(refreshed.body, 'PAID-CONTENT');
  } finally {
    await srv.close();
  }
});
