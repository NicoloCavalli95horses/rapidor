import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AblationPipeline } from '../src/analysis/AblationPipeline';
import { HttpEventStore } from '../src/db/HttpEventStore';
import { CrawlStateStore } from '../src/db/CrawlStateStore';
import { AblationVulnerabilityStore } from '../src/db/AblationVulnerabilityStore';
import { AblationStatsStore } from '../src/db/AblationStatsStore';
import { ForgedRequestStore } from '../src/db/ForgedRequestStore';
import { AuthzClassifier } from '../src/analysis/authzClassifier';
import { AuthzClassificationStore } from '../src/db/AuthzClassificationStore';
import { useBrowser } from './helpers/browser';

let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'ablation-test-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

// AblationPipeline forges requests via page.request.fetch (Playwright's APIRequestContext) — confirmed
// empirically that this does NOT go through page.route()/context.route() mocking at all (it dispatches
// a real DNS/TCP request, unlike a page's own navigation/fetch). A tiny local server is the only
// reliable way to exercise the forge step; every candidate gets the exact same JSON body back, so
// getServerResponseSimilarity's shape check always passes and the test isolates what this pipeline is
// actually about: finding the sibling inside that body and resolving the diff/authz oracle on it.
let server: Server;
let baseUrl: string;
let requestCount = 0; // bumped on every real request the server receives — used to prove cache reuse
const USERS = [{ id: '101', premium: false }, { id: '102', premium: true }];
// The forged response echoes the requested value, so a sibling forge is NOT byte-identical to the
// reference (an identical one is the "server ignored the value" case, dropped by isIdenticalResponse).
const usersBody = (requested: string | null) => JSON.stringify({ users: USERS, requested });
const BODY = usersBody('101');
// Two more routes, for the cross-body-matching test: a per-item endpoint whose own response has NO
// siblings at all, and an unrelated listing endpoint that happens to carry the same id alongside its
// real siblings — mirrors the real case buildJsonPreindex exists for (busuu's own
// component/objective_<uuid>, a single-object response, vs. a separate course-structure-style
// listing that actually enumerates every objective).
const THREE_USERS = [{ id: '101', premium: false }, { id: '102', premium: true }, { id: '103', premium: true }];
// the entitlement flag sits OUTSIDE the swapped resource (`lesson`): the scoped authz gate must ignore it
const NESTED_ITEMS = [{ lesson: { id: '101' }, premium: false }, { lesson: { id: '102' }, premium: true }];
const LISTING_BODY = JSON.stringify({ items: [{ id: '101', premium: false }, { id: '102', premium: true }] });

before(async () => {
  server = createServer((req, res) => {
    requestCount++;
    res.setHeader('content-type', 'application/json');
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    if (pathname === '/api/listing') { res.end(LISTING_BODY); return; }
    const q = new URL(req.url ?? '/', 'http://x').searchParams;
    if (pathname === '/api/item') { res.end(JSON.stringify({ id: q.get('id'), title: 'solo item' })); return; }
    // carrier-echoing route: the forged body differs per carrier (so the forged-body dedup does NOT
    // collapse two carriers) yet the swap is the same resource — only the vulnerabilityId can collapse it.
    if (pathname.startsWith('/plan/')) { res.end(JSON.stringify({ users: USERS, carrier: pathname.split('/')[2], req: q.get('id') })); return; }
    if (pathname === '/api/static') { res.end(BODY); return; }   // ignores the value: always the reference body
    if (pathname === '/api/default') { res.end(JSON.stringify({ users: THREE_USERS, requested: 'default' })); return; }   // falls back to a default
    if (pathname === '/api/nested') { res.end(JSON.stringify({ items: NESTED_ITEMS, requested: q.get('id') })); return; }
    res.end(usersBody(q.get('id') ?? q.get('curPage'))); // /api/users
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
});
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('AblationPipeline', () => {
  let n = 0;
  function newPipeline(optionOverrides: Partial<{ maxSegmentMatches: number; maxGeneratedRequests: number; paramBlacklist: string[]; segmentBlacklist: string[] }> = {}) {
    const dbPath = join(root, `${n++}.db`);
    const db = new Database(dbPath);
    const httpEventStore = new HttpEventStore({ db, clearOnStart: true });
    const crawlStateStore = new CrawlStateStore({ db, clearOnStart: true });
    const vulnerabilityStore = new AblationVulnerabilityStore({ db, clearOnStart: true });
    const statsStore = new AblationStatsStore({ db, clearOnStart: true });
    const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: true });
    const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: true }));
    const pipeline = new AblationPipeline({
      httpEventStore, crawlStateStore, vulnerabilityStore, statsStore, forgedRequestStore, classifier,
      options: { maxConcurrentRequests: 1, timeBetweenRequestsMs: 0, maxSegmentMatches: 300, maxGeneratedRequests: 100000, paramBlacklist: [], segmentBlacklist: [], ...optionOverrides },
    });
    return { pipeline, db, httpEventStore, crawlStateStore, vulnerabilityStore, statsStore, forgedRequestStore, classifier };
  }

  const { newPage } = useBrowser();

  function recordEvent(httpEventStore: HttpEventStore, site: string, url: string, responseBody = BODY): void {
    httpEventStore.record({
      site,
      request: {
        url, method: 'GET', requestHeaders: {}, status: 200,
        responseHeaders: { 'content-type': 'application/json' }, contentType: 'application/json',
        responseBody, timestamp: new Date().toISOString(), pageUrl: `${baseUrl}/`,
      },
    });
  }

  function primeClassifier(classifier: AuthzClassifier): void {
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });
  }

  it('flags a sibling found inside the JSON response body, using the same diff/authz oracle as the main pipeline', async () => {
    const { pipeline, httpEventStore, vulnerabilityStore, classifier } = newPipeline();
    // pre-seed the classifier cache (see AnalysisPipeline.test.ts's own fixtures for the same pattern):
    // 'premium' is authz-relevant, 'id' is not — skips loading the real embedding model.
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/users?id=101`);

    const page = await newPage();
    await pipeline.runForSite({ page, site });

    assert.equal(vulnerabilityStore.count(site), 1);
  });

  it('applies the query-param blacklist (exact and tokenized): a pagination param like curPage is never mutated', async () => {
    const primeClassifier = (classifier: AuthzClassifier) => {
      (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
      (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });
    };
    const site = 'app.test';

    // Baseline: with no blacklist, ?curPage=101 matches the body sibling 102 and IS flagged.
    const base = newPipeline();
    primeClassifier(base.classifier);
    recordEvent(base.httpEventStore, site, `${baseUrl}/api/users?curPage=101`);
    await base.pipeline.runForSite({ page: await newPage(), site });
    assert.equal(base.vulnerabilityStore.count(site), 1);

    // Exact-name blacklist: curPage listed -> skipped -> nothing flagged.
    const exact = newPipeline({ paramBlacklist: ['curpage'] });
    primeClassifier(exact.classifier);
    recordEvent(exact.httpEventStore, site, `${baseUrl}/api/users?curPage=101`);
    await exact.pipeline.runForSite({ page: await newPage(), site });
    assert.equal(exact.vulnerabilityStore.count(site), 0);

    // Tokenized blacklist: 'page' matches the 'page' token of curPage -> also skipped.
    const token = newPipeline({ paramBlacklist: ['page'] });
    primeClassifier(token.classifier);
    recordEvent(token.httpEventStore, site, `${baseUrl}/api/users?curPage=101`);
    await token.pipeline.runForSite({ page: await newPage(), site });
    assert.equal(token.vulnerabilityStore.count(site), 0);
  });

  it('abandons a site as infeasible (nothing dispatched, stats flagged) when generation exceeds the forge budget', async () => {
    // budget of 1: the two-sibling body yields >1 distinct candidate, so generation early-aborts and
    // the site is recorded infeasible with nothing forged — the combinatorial-explosion safeguard.
    const { pipeline, db, httpEventStore, vulnerabilityStore, statsStore, classifier } = newPipeline({ maxGeneratedRequests: 1 });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const site = 'app.test';
    // one carrier whose body has several siblings whose forge URLs are NOT in history (only ?id=101 is
    // recorded) → >1 distinct candidate, over the budget of 1. We abort before any forge, so the body
    // only needs to exist for the preindex; its response-similarity is never exercised.
    httpEventStore.record({
      site,
      request: {
        url: `${baseUrl}/api/users?id=101`, method: 'GET', requestHeaders: {}, status: 200,
        responseHeaders: { 'content-type': 'application/json' }, contentType: 'application/json',
        responseBody: JSON.stringify({ users: [{ id: '101', premium: false }, { id: '102', premium: true }, { id: '103', premium: true }, { id: '104', premium: true }] }),
        timestamp: new Date().toISOString(), pageUrl: `${baseUrl}/`,
      },
    });

    const page = await newPage();
    const forgedBefore = (db.prepare('SELECT COUNT(*) AS n FROM forged_requests').get() as { n: number }).n;
    await pipeline.runForSite({ page, site });

    assert.equal(vulnerabilityStore.count(site), 0, 'nothing flagged');
    const forgedAfter = (db.prepare('SELECT COUNT(*) AS n FROM forged_requests').get() as { n: number }).n;
    assert.equal(forgedAfter, forgedBefore, 'nothing forged (no dispatch)');
    const row = statsStore.all().find((r) => r.site === site);
    assert.equal(row?.infeasible, true, 'site recorded as infeasible');
  });

  it('never flags anything when the differing props are not authz-relevant', async () => {
    const { pipeline, httpEventStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 0, isAuthZRelevant: false });

    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/users?id=101`);

    const page = await newPage();
    await pipeline.runForSite({ page, site });

    assert.equal(vulnerabilityStore.count(site), 0);
  });

  it("never flags a candidate URL already in the crawler's own history, same false-positive guard as AnalysisPipeline", async () => {
    const { pipeline, httpEventStore, crawlStateStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/users?id=101`);
    // the candidate this pipeline would otherwise forge is .../api/users?id=102: recorded here as an
    // ordinary URL the DFS exploration already reached on its own.
    crawlStateStore.record({
      site, record: { id: 'state-already-seen', url: `${baseUrl}/api/users?id=102`, depth: 1, path: [], clickables: [], texts: [] },
    });

    const page = await newPage();
    await pipeline.runForSite({ page, site });

    assert.equal(vulnerabilityStore.count(site), 0);
  });

  it('records per-site stats (own table, never analysis_stats) even when nothing is flagged', async () => {
    const { pipeline, httpEventStore, statsStore } = newPipeline();
    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/users?id=101`);

    const page = await newPage();
    await pipeline.runForSite({ page, site });

    const [row] = statsStore.all();
    assert.equal(row.site, site);
    assert.equal(row.httpEvents, 1);
    assert.ok(row.segmentsExtracted >= 1);
    assert.ok(row.jsonMatchesFound >= 1);
    assert.ok(row.candidatesFound >= 1);
    assert.equal(row.requestsGenerated, 1);
  });

  it('ignores a response body that is not JSON (e.g. HTML)', async () => {
    const { pipeline, httpEventStore, statsStore } = newPipeline();
    const site = 'app.test';
    httpEventStore.record({
      site,
      request: {
        url: `${baseUrl}/page?id=101`, method: 'GET', requestHeaders: {}, status: 200,
        responseHeaders: { 'content-type': 'text/html' }, contentType: 'text/html',
        responseBody: '<p>101</p>', timestamp: new Date().toISOString(), pageUrl: `${baseUrl}/`,
      },
    });

    const page = await newPage();
    await pipeline.runForSite({ page, site });

    const [row] = statsStore.all();
    assert.equal(row.candidatesFound, 0);
  });

  // Cross-pipeline dedup: in a real run, AnalysisPipeline (React-informed) may have already forged
  // this exact (site, method, url, body) candidate before AblationPipeline gets to it — see
  // ForgedRequestStore's own doc comment for why. Pre-seeding the cache here simulates exactly that.
  it('reuses an already-forged response from the shared cache instead of hitting the live server again', async () => {
    const { pipeline, httpEventStore, vulnerabilityStore, forgedRequestStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/users?id=101`);
    const candidateUrl = `${baseUrl}/api/users?id=102`;
    forgedRequestStore.record({
      site, method: 'GET', url: candidateUrl, postData: undefined,
      response: { status: 200, headers: { 'content-type': 'application/json' }, body: usersBody('102'), contentType: 'application/json' },
    });

    const before = requestCount;
    const page = await newPage();
    await pipeline.runForSite({ page, site });

    assert.equal(requestCount, before, 'no new request should have been dispatched for the cached candidate');
    assert.equal(vulnerabilityStore.count(site), 1, 'still flagged, using the cached response');
  });

  // The point of buildJsonPreindex: the segment's OWN request (/api/item) has no siblings in its
  // own response at all, but the same id also shows up inside a completely unrelated, already-
  // captured listing response — alongside the real sibling the oracle needs. The candidate still
  // gets spliced into /api/item's own URL (the one with a clean per-id template and a real baseline
  // response to compare the forged candidate against), not into /api/listing's.
  it('finds a sibling in a DIFFERENT captured response than the one the segment itself came from', async () => {
    const { pipeline, db, httpEventStore, vulnerabilityStore, classifier } = newPipeline();
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('id', { score: 0, isAuthZRelevant: false });
    (classifier as unknown as { cache: Map<string, unknown> }).cache.set('premium', { score: 1, isAuthZRelevant: true });

    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/item?id=101`, JSON.stringify({ id: '101', title: 'solo item' })); // own response: {id:'101', title:'solo item'} — no siblings
    httpEventStore.record({
      site,
      request: {
        url: `${baseUrl}/api/listing`, method: 'GET', requestHeaders: {}, status: 200,
        responseHeaders: { 'content-type': 'application/json' }, contentType: 'application/json',
        responseBody: LISTING_BODY, timestamp: new Date().toISOString(), pageUrl: `${baseUrl}/`,
      },
    });

    const page = await newPage();
    await pipeline.runForSite({ page, site });

    assert.equal(vulnerabilityStore.count(site), 1);
    const [row] = db.prepare('SELECT candidate_url FROM ablation_vulnerabilities WHERE site = ?').all(site) as { candidate_url: string }[];
    assert.equal(row.candidate_url, `${baseUrl}/api/item?id=102`); // spliced into /api/item's own URL, not /api/listing's
  });

  // Shared-guard parity with the main pipeline (httpGuards + isIdenticalResponse + value-insensitivity).
  it('drops a forge whose response is identical to the reference (the server ignores the value)', async () => {
    const { pipeline, httpEventStore, vulnerabilityStore, classifier } = newPipeline();
    primeClassifier(classifier);
    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/static?id=101`);
    await pipeline.runForSite({ page: await newPage(), site });
    assert.equal(vulnerabilityStore.count(site), 0);
  });

  it('drops findings whose slot is value-insensitive (two values forge the same response)', async () => {
    const { pipeline, httpEventStore, vulnerabilityStore, classifier } = newPipeline();
    primeClassifier(classifier);
    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/default?id=101`, JSON.stringify({ users: THREE_USERS, requested: '101' }));
    await pipeline.runForSite({ page: await newPage(), site });
    assert.equal(vulnerabilityStore.count(site), 0, '102 and 103 both return the default body');
  });

  it('scopes the authz diff to the swapped resource: an entitlement outside it does not count', async () => {
    const { pipeline, httpEventStore, vulnerabilityStore, classifier } = newPipeline();
    primeClassifier(classifier);
    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/api/nested?id=101`, JSON.stringify({ items: NESTED_ITEMS, requested: '101' }));
    await pipeline.runForSite({ page: await newPage(), site });
    assert.equal(vulnerabilityStore.count(site), 0);
  });

  // vulnerabilityId collapses carriers (mirrors the main pipeline): the SAME swap reached from two
  // carrier URLs is one finding, even when the two forged bodies differ (so the forged-body dedup
  // can't collapse them). promova's lesson 77 under two /my-plan/<plan>/ segments is the real case.
  it('records ONE finding for the same swap reached from two different carrier URLs', async () => {
    const { pipeline, httpEventStore, vulnerabilityStore, classifier } = newPipeline();
    primeClassifier(classifier);
    const site = 'app.test';
    recordEvent(httpEventStore, site, `${baseUrl}/plan/A/users?id=101`, JSON.stringify({ users: USERS, carrier: 'A', req: '101' }));
    recordEvent(httpEventStore, site, `${baseUrl}/plan/B/users?id=101`, JSON.stringify({ users: USERS, carrier: 'B', req: '101' }));
    await pipeline.runForSite({ page: await newPage(), site });
    assert.equal(vulnerabilityStore.count(site), 1, 'two carriers of the same swap collapse to one finding');
  });
});
