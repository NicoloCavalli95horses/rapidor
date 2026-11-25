// Offline diagnostic of the ablation funnel: replays AblationPipeline's generation stage by stage and
// re-evaluates each candidate against the forged_requests cache with the SAME shared decision code
// (httpGuards, isIdenticalResponse, value-insensitivity). No network; writes nothing but the authz
// classifier cache. Also checks whether the ablation re-proposes each of the main pipeline's HTTP
// findings, and counts the live forges a real run would still need (`3.notInForgeCache` > 0 → the
// session must be valid). Usage: npx tsx scripts/debug/ablationFunnel.ts <site> [<site> ...]
import { openDatabase } from '../../src/db/openDatabase';
import { HttpEventStore } from '../../src/db/HttpEventStore';
import { CrawlStateStore } from '../../src/db/CrawlStateStore';
import { ForgedRequestStore } from '../../src/db/ForgedRequestStore';
import { AuthzClassificationStore } from '../../src/db/AuthzClassificationStore';
import { AuthzClassifier } from '../../src/analysis/authzClassifier';
import { extractSegments, candidateUrlFor, type SegmentCandidate } from '../../src/analysis/segments';
import { buildJsonPreindex, findJsonCandidates, type JsonCandidate } from '../../src/analysis/jsonMatchFinder';
import { paramNameBlacklisted, isLocaleParam, isTrackingParam, sameIdShape, isNonSerializableMarker } from '../../src/analysis/candidateGenerator';
import { getServerResponseSimilarity, canonicalResponseKey, isIdenticalResponse } from '../../src/analysis/responseEvaluate';
import { authzGateVerdict, httpContentGuardReason } from '../../src/analysis/httpGuards';
import { ForgeValueSensitivity, forgeTemplateKey } from '../../src/analysis/forgeValueSensitivity';
import { normalizeUrl } from '../../src/analysis/findings';
import { config } from '../../src/config';

const db = openDatabase({ path: config.db.path });
const httpEventStore = new HttpEventStore({ db, clearOnStart: false });
const crawlStateStore = new CrawlStateStore({ db, clearOnStart: false });
const forged = new ForgedRequestStore({ db, clearOnStart: false });
const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false }));
const { maxSegmentMatches, paramBlacklist, segmentBlacklist, authzDirectionGate } = config.analysis;

const bump = (m: Record<string, number>, k: string, n = 1) => { m[k] = (m[k] ?? 0) + n; };
const parse = (b?: string) => { if (!b) return undefined; try { const p = JSON.parse(b); return p && typeof p === 'object' ? p : undefined; } catch { return undefined; } };

for (const site of process.argv.slice(2)) {
  const events = httpEventStore.listMetaBySite(site);
  const bodies: unknown[] = new Array(events.length);
  const history = new Set<string>();
  let i = 0;
  httpEventStore.forEachResponse({ site, onRow: ({ status, body }) => {
    const k = canonicalResponseKey({ status: status ?? 0, body: body ?? '' }); if (k) history.add(k);
    bodies[i++] = parse(body);
  } });
  const preindex = buildJsonPreindex({ bodies });
  const historyUrls = new Set([...events.map((e) => normalizeUrl(e.url)), ...crawlStateStore.listBySite(site).map((s) => normalizeUrl(s.url))]);
  const carriers = new Map<string, Set<string>>();
  for (const e of events) for (const s of extractSegments({ url: e.url })) {
    if (!preindex.has(s.value)) continue;
    (carriers.get(s.value) ?? carriers.set(s.value, new Set()).get(s.value)!).add(`${e.method} ${normalizeUrl(e.url)}`);
  }

  // ---- generation (mirrors AblationPipeline.runForSite)
  const gen: Record<string, number> = { events: events.length, jsonBodies: bodies.filter((b) => b !== undefined).length };
  const seenEventUrls = new Set<string>();
  const seen = new Set<string>();
  const tasks: { event: typeof events[number]; url: string; c: JsonCandidate; seg: SegmentCandidate }[] = [];
  for (const event of events) {
    if (event.method.toUpperCase() !== 'GET' || event.status !== 200) { bump(gen, 'evt.notGet200'); continue; }
    const canonical = normalizeUrl(event.url);
    if (seenEventUrls.has(canonical)) { bump(gen, 'evt.dupCanonical'); continue; }
    seenEventUrls.add(canonical);
    for (const seg of extractSegments({ url: event.url })) {
      bump(gen, 'seg.total');
      if (seg.paramName && (paramNameBlacklisted({ name: seg.paramName, blacklist: paramBlacklist }) || isLocaleParam({ name: seg.paramName }) || isTrackingParam({ name: seg.paramName }))) { bump(gen, 'seg.paramFiltered'); continue; }
      if (!seg.paramName && segmentBlacklist.includes(seg.value.toLowerCase())) { bump(gen, 'seg.segBlacklist'); continue; }
      const hits = preindex.get(seg.value) ?? [];
      if (hits.length === 0) { bump(gen, 'seg.noJsonMatch'); continue; }
      if (hits.length > maxSegmentMatches) { bump(gen, 'seg.hitCap'); continue; }
      if ((carriers.get(seg.value)?.size ?? 0) > maxSegmentMatches) { bump(gen, 'seg.carrierCap'); continue; }
      bump(gen, 'seg.matched');
      for (const hit of hits) {
        const cands = findJsonCandidates({ root: bodies[hit.bodyIndex], path: hit.path, matchedValue: seg.value });
        if (cands.length === 0) { bump(gen, hit.path.some((p) => typeof p === 'number') ? 'hit.arrayButNoDiffSibling' : 'hit.notInArray'); continue; }
        for (const c of cands) {
          if (!seg.paramName && segmentBlacklist.includes(String(c.candidateValue).toLowerCase())) { bump(gen, 'cand.segBlacklist'); continue; }
          if (isNonSerializableMarker({ value: String(c.candidateValue) })) { bump(gen, 'cand.nonSerializable'); continue; }
          if (!sameIdShape({ original: seg.value, replacement: String(c.candidateValue) })) { bump(gen, 'cand.shape'); continue; }
          const url = candidateUrlFor({ url: event.url, segment: seg, value: c.candidateValue });
          if (historyUrls.has(normalizeUrl(url))) { bump(gen, 'cand.history'); continue; }
          const key = `${event.method}|${normalizeUrl(url)}`;
          if (seen.has(key)) { bump(gen, 'cand.dupUrl'); continue; }
          seen.add(key); tasks.push({ event, url, c, seg });
        }
      }
    }
  }

  // ---- coverage of the main pipeline's HTTP findings
  const mainRows = db.prepare('SELECT candidate_url c, reference_value rv, candidate_value cv, detection_method d FROM vulnerabilities WHERE site = ?').all(site) as { c: string; rv: string; cv: string; d: string }[];
  const taskUrls = new Set(tasks.map((t) => normalizeUrl(t.url)));
  const misses: string[] = [];
  for (const m of mainRows) {
    if (m.d !== 'http') { bump(gen, `main.${m.d}(out of ablation scope)`); continue; }
    if (taskUrls.has(normalizeUrl(m.c))) { bump(gen, 'main.http.generatedByAblation'); continue; }
    const hits = preindex.get(m.rv) ?? [];
    if (hits.length === 0) { bump(gen, 'main.http.refValueNotInAnyJson'); continue; }
    const sib = hits.some((h) => findJsonCandidates({ root: bodies[h.bodyIndex], path: h.path, matchedValue: m.rv }).some((c) => c.candidateValue === m.cv));
    bump(gen, sib ? 'main.http.siblingExistsButDropped' : 'main.http.refInJsonButCandNotAJsonSibling');
    misses.push(`${m.rv} -> ${m.cv} hits=${hits.length} paths=${JSON.stringify(hits.slice(0, 2).map((h) => h.path))}`);
  }

  // ---- evaluation (mirrors AblationPipeline.evaluateCandidate + finalizeFindings), cache-only
  const ev: Record<string, number> = {};
  const sensitivity = new ForgeValueSensitivity();
  const recordedKeys = new Set<string>();
  for (const { event, url, c, seg } of tasks) {
    const verdict = await authzGateVerdict({ referenceProps: c.referenceProps, candidateProps: c.candidateProps, swapPath: ['props', ...c.swapPath], classifier, directionGate: authzDirectionGate });
    if (verdict.reject !== undefined) { bump(ev, verdict.reject.startsWith('candidate less') ? '2.authz.direction' : '1.authz.notRelevant'); continue; }
    const f = forged.get({ site, method: event.method, url, postData: event.postData });
    if (!f) { bump(ev, '3.notInForgeCache'); continue; }
    const template = forgeTemplateKey({ method: event.method, url: event.url, segment: seg });
    const fk = canonicalResponseKey({ status: f.status, body: f.body });
    sensitivity.observe({ template, forgedKey: fk, value: c.candidateValue });
    const refBody = event.id !== undefined ? httpEventStore.getResponseBody({ site, id: event.id }) : undefined;
    const orig = { status: event.status ?? 0, headers: event.responseHeaders ?? {}, body: refBody ?? '', contentType: event.contentType };
    if (!getServerResponseSimilarity(orig, f).areSimilar) { bump(ev, '4.notSimilar'); continue; }
    if (isIdenticalResponse({ reference: orig, candidate: f })) { bump(ev, '5.identicalToReference'); continue; }
    const reason = httpContentGuardReason({ forged: f, original: orig, responseHistoryKeys: history });
    if (reason !== null) { bump(ev, `6.${reason.split(/[:—,]/)[0]!.trim()}`); continue; }
    sensitivity.defer({ template, forgedKey: fk, context: `${event.url} -> ${url}`, recordHttp: () => {}, onValueInsensitive: async () => {} });
  }
  for (const d of sensitivity.drain()) {
    if (sensitivity.isValueInsensitive({ template: d.template, forgedKey: d.forgedKey })) { bump(ev, '7.valueInsensitive'); continue; }
    if (d.forgedKey !== undefined && recordedKeys.has(d.forgedKey)) { bump(ev, '8.dupForgedBody'); continue; }
    if (d.forgedKey !== undefined) recordedKeys.add(d.forgedKey);
    bump(ev, '9.FLAGGED');
    console.log('  FLAG', d.context);
  }

  console.log(`\n===== ${site}: ${tasks.length} tasks`);
  console.log('generation', gen);
  console.log('evaluation', ev);
  for (const m of misses) console.log('  MISS', m);
}
