// Offline audit of the MAIN pipeline's authz gate (no network; writes only the classifier cache).
//   --trace <site> <url substring>   where the main pipeline stops on matching http events / page urls
//   --value-only <site> [<site> ...] for each stored main finding: does it pass the gate ONLY through a
//                                    VALUE hit (assessAuthZ rule "a value that is itself an authz term"),
//                                    and do the two objects share an authz-relevant key with an EQUAL value?
// Candidates are regenerated with the real CandidateGenerator (findings store no stateId/nodes).
import { openDatabase } from '../../src/db/openDatabase';
import { HttpEventStore } from '../../src/db/HttpEventStore';
import { PreindexedValueStore } from '../../src/db/PreindexedValueStore';
import { ReactStateStore } from '../../src/db/ReactStateStore';
import { CrawlStateStore } from '../../src/db/CrawlStateStore';
import { ForgedRequestStore } from '../../src/db/ForgedRequestStore';
import { AuthzClassificationStore } from '../../src/db/AuthzClassificationStore';
import { AuthzClassifier, assessAuthZ } from '../../src/analysis/authzClassifier';
import { CandidateGenerator, type UrlCandidate } from '../../src/analysis/candidateGenerator';
import { candidateUrlFor } from '../../src/analysis/segments';
import { compareObj, scopeDiffsToResource, excludeSwapDiff, describeDiffs } from '../../src/analysis/responseEvaluate';
import { authzGateVerdict } from '../../src/analysis/httpGuards';
import { readPath } from '../../src/analysis/matchFinder';
import { normalizeUrl } from '../../src/analysis/findings';
import { config } from '../../src/config';

const db = openDatabase({ path: config.db.path });
const httpEventStore = new HttpEventStore({ db, clearOnStart: false });
const reactStateStore = new ReactStateStore({ db, clearOnStart: false });
const crawlStateStore = new CrawlStateStore({ db, clearOnStart: false });
const forged = new ForgedRequestStore({ db, clearOnStart: false });
const classifier = new AuthzClassifier(new AuthzClassificationStore({ db, clearOnStart: false }));
const generator = new CandidateGenerator({
  preindexStore: new PreindexedValueStore({ db, clearOnStart: false }), reactStateStore,
  maxSegmentMatches: config.analysis.maxSegmentMatches, segmentBlacklist: config.analysis.segmentBlacklist, paramBlacklist: config.analysis.paramBlacklist,
});
const short = (v: unknown, n = 200) => { const t = typeof v === 'string' ? v : JSON.stringify(v); return t.length > n ? `${t.slice(0, n)}…` : t; };
const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };

/** Gate breakdown for one candidate: verdict, whether it rests ONLY on value hits, and equal authz keys. */
async function explain(c: UrlCandidate['candidate']) {
  const verdict = await authzGateVerdict({ referenceProps: c.referenceProps, candidateProps: c.candidateProps, swapPath: c.path, classifier, directionGate: config.analysis.authzDirectionGate });
  const diffs = excludeSwapDiff({ differences: scopeDiffsToResource({ differences: compareObj(c.referenceProps, c.candidateProps), swapPath: c.path }), swapPath: c.path });
  // Neutral non-string values: only key/path names can hit (assessAuthZ's name rule) — the value rule is switched off.
  const nameOnly = await assessAuthZ({ differences: diffs.map((d) => ({ ...d, reference: 0, current: 1 })), classifier });
  const full = await assessAuthZ({ differences: diffs, classifier });
  // Leaves of the swapped resource (parent of the swap path) whose value is EQUAL on both sides, key authz-relevant.
  const rel = c.path[0] === 'props' ? c.path.slice(1) : c.path;
  const scope = rel.slice(0, -1);
  const equalAuthz: string[] = [];
  const walk = async (a: unknown, b: unknown, path: (string | number)[]) => {
    if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
      for (const k of Object.keys(a as object)) await walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], [...path, k]);
      return;
    }
    const key = path[path.length - 1];
    if (a === b && typeof key === 'string' && key.length <= 50 && /^[A-Za-z0-9_]+$/.test(key) && (await classifier.classify(key)).isAuthZRelevant) equalAuthz.push(`${path.join('.')}=${JSON.stringify(a)}`);
  };
  await walk(scope.length ? readPath(c.referenceProps, scope) : c.referenceProps, scope.length ? readPath(c.candidateProps, scope) : c.candidateProps, scope);
  return { verdict, valueOnly: full.isAuthzRelevant && !nameOnly.isAuthzRelevant, nameKeys: nameOnly.sensitiveKeys, allKeys: full.sensitiveKeys, equalAuthz, diffs };
}

const [mode, ...rest] = process.argv.slice(2);

if (mode === '--trace') {
  const [site, needle] = rest as [string, string];
  generator.reset();
  const events = httpEventStore.listMetaBySite(site);
  const historyUrls = new Set([...events.map((e) => normalizeUrl(e.url)), ...reactStateStore.listUrlsBySite(site).map(normalizeUrl), ...crawlStateStore.listBySite(site).map((s) => normalizeUrl(s.url))]);
  const httpUrls = [...new Set(events.filter((e) => e.method === 'GET' && e.status === 200 && e.url.includes(needle)).map((e) => e.url))].slice(0, 3);
  const pageUrls = reactStateStore.listUrlsBySite(site).filter((u) => u.includes(needle));
  for (const [kind, url] of [...httpUrls.map((u) => ['http', u] as const), ...pageUrls.map((u) => ['page(client-routing)', u] as const)]) {
    const found = generator.findUrlCandidates({ url, site });
    const per: Record<string, number> = {};
    console.log(`\n== ${kind} ${short(url, 120)}\n   segments=${found.segments} preindexMatches=${found.matches} chromeSkipped=${found.chromeSkipped} candidates=${found.items.length}`);
    const examples: string[] = [];
    for (const { segment, candidate } of found.items) {
      const cu = candidateUrlFor({ url, segment, value: candidate.candidateValue });
      if (historyUrls.has(normalizeUrl(cu))) { bump(per, `${segment.value}: history`); continue; }
      const e = await explain(candidate);
      if (e.verdict.reject !== undefined) { bump(per, `${segment.value}: gate reject (${e.verdict.reject.split(',')[0]})`); if (examples.length < 3) examples.push(`${segment.value}->${candidate.candidateValue}: ${short(describeDiffs(e.diffs), 220)}`); continue; }
      const f = kind === 'http' ? forged.get({ site, method: 'GET', url: cu }) : undefined;
      bump(per, `${segment.value}: gate PASS keys=${JSON.stringify(e.allKeys)}${kind === 'http' ? (f ? ` forge=${f.status}` : ' forge=not-cached') : ''}`);
    }
    for (const [k, n] of Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${n}× ${k}`);
    for (const x of examples) console.log(`   e.g. ${x}`);
  }
}

if (mode === '--value-only') {
  for (const site of rest) {
    generator.reset();
    const rows = db.prepare('SELECT reference_url r, candidate_url c, reference_value rv, candidate_value cv, detection_method d, authz_diff a FROM vulnerabilities WHERE site = ?').all(site) as { r: string; c: string; rv: string; cv: string; d: string; a: string }[];
    console.log(`\n===== ${site}: ${rows.length} stored findings`);
    const cache = new Map<string, ReturnType<typeof generator.findUrlCandidates>>();
    for (const row of rows) {
      const found = cache.get(row.r) ?? generator.findUrlCandidates({ url: row.r, site });
      cache.set(row.r, found);
      // reference_value is the segment, or (tokenized props, e.g. lingualeo) the node's whole prop value
      const matches = found.items.filter((it) => (it.segment.value === row.rv || String(it.candidate.referenceValue) === row.rv) && it.candidate.candidateValue === row.cv);
      const stored = (JSON.parse(row.a) as { sensitiveKeys: string[] }).sensitiveKeys;
      let verdictLine = 'NOT REGENERATED';
      for (const m of matches) {
        const e = await explain(m.candidate);
        if (e.verdict.reject !== undefined) { verdictLine = `REJECTED BY GATE: ${e.verdict.reject}`; continue; }   // keep looking for a passing pair
        verdictLine = `${e.valueOnly ? 'VALUE-ONLY' : 'name-hit  '} nameKeys=${JSON.stringify(e.nameKeys)} equalAuthzKeys=${JSON.stringify(e.equalAuthz.slice(0, 4))}${e.valueOnly && e.equalAuthz.length ? '  <-- WOULD BE DROPPED by the proposed rule' : ''}`;
        break;
      }
      console.log(`  [${row.d}] ${row.rv} -> ${row.cv} | stored keys=${JSON.stringify(stored)} | ${verdictLine}`);
    }
  }
}
