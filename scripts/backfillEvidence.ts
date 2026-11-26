// Non-destructive backfill of the `vulnerabilities.evidence` column for findings stored BEFORE that
// column existed. It re-derives each finding's swapped sibling pair PURELY — the same preindex ->
// matchFinder step the analysis uses, from the already-captured react_states — with NO browser, NO
// network, and NO new candidate generation against the live site. It only ever runs UPDATEs on rows it
// confidently matched; it never DELETEs, never INSERTs, never clears a site. A finding it cannot match
// (the current generator no longer produces that candidate, or the match is ambiguous) is reported and
// LEFT UNTOUCHED — so the stored findings cannot change, only gain their evidence payload.
//
// Usage:
//   npx tsx scripts/backfillEvidence.ts <START_URL|--all>            # DRY RUN: report matches, write nothing
//   npx tsx scripts/backfillEvidence.ts <START_URL|--all> --write    # perform the UPDATEs
//
// SITE is derived from START_URL's hostname (as main.ts stores it); --all does every site with findings.
import { log, LogLevel } from 'crawlee';
import { openDatabase } from '../src/db/openDatabase';
import { HttpEventStore } from '../src/db/HttpEventStore';
import { PreindexedValueStore } from '../src/db/PreindexedValueStore';
import { ReactStateStore } from '../src/db/ReactStateStore';
import { VulnerabilityStore, type ReportRow } from '../src/db/VulnerabilityStore';
import { CandidateGenerator } from '../src/analysis/candidateGenerator';
import { buildEvidence, type ReproductionKind } from '../src/analysis/reportEvidence';
import { vulnerabilityId, normalizeUrl, CLIENT_ROUTING_METHOD } from '../src/analysis/findings';
import { candidateUrlFor, spliceSegment } from '../src/analysis/segments';
import type { UrlCandidate } from '../src/analysis/candidateGenerator';
import { config } from '../src/config';

log.setLevel(process.env.LOG_LEVEL?.toLowerCase() === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

const args = process.argv.slice(2);
const write = args.includes('--write');
const all = args.includes('--all');
const startArg = args.find((a) => !a.startsWith('--'));
if (!all && !startArg) {
  console.error('Usage: npx tsx scripts/backfillEvidence.ts <START_URL|--all> [--write]');
  process.exit(1);
}

const db = openDatabase({ path: config.db.path });
const httpEventStore = new HttpEventStore({ db, clearOnStart: false });
const preindexStore = new PreindexedValueStore({ db, clearOnStart: false });
const reactStateStore = new ReactStateStore({ db, clearOnStart: false });
const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: false });

const generator = new CandidateGenerator({
  preindexStore, reactStateStore,
  maxSegmentMatches: config.analysis.maxSegmentMatches,
  segmentBlacklist: config.analysis.segmentBlacklist,
  paramBlacklist: config.analysis.paramBlacklist,
});

/** Recomputes a finding's deterministic id from a candidate, to disambiguate two value-equal matches (see candidateEvaluator.recordFinding). */
function recomputedId({ site, row, item }: { site: string; row: ReportRow; item: UrlCandidate }): string | undefined {
  let origin: string;
  try { origin = new URL(row.candidateUrl).origin; } catch { origin = row.candidateUrl; }
  const seg = item.segment;
  const swapPos = seg.location === 'path' ? `path|${seg.indexFromRight ?? ''}` : `query|${seg.paramName ?? ''}`;
  return vulnerabilityId({
    site, origin, method: row.method,
    stateId: item.candidate.stateId, referenceNodeId: item.candidate.referenceNodeId,
    candidateNodeId: item.candidate.candidateNodeId, path: item.candidate.path,
    clientSwap: row.method === CLIENT_ROUTING_METHOD ? `${item.candidate.candidateValue}|${swapPos}` : undefined,
  });
}

/** The URL a candidate would forge/probe, to pin the exact carrier against the stored candidate_url (reconciled client-path urls won't match — handled by the id/representative fallback). */
function reconstructedUrl({ row, item }: { row: ReportRow; item: UrlCandidate }): string {
  const { segment } = item;
  if (segment.location === 'query') return candidateUrlFor({ url: row.referenceUrl, segment, value: item.candidate.candidateValue });
  return spliceSegment({ parts: segment.parts, index: segment.index, value: item.candidate.candidateValue, query: segment.query });
}

/** Deterministic order so a representative pick is stable across runs (two witnesses of one finding sort the same way every time). */
function sortKey(item: UrlCandidate): string {
  return `${item.candidate.stateId}|${item.candidate.referenceNodeId}|${item.candidate.candidateNodeId}|${item.candidate.path.join('.')}`;
}

type MatchConfidence = 'unique' | 'id-confirmed' | 'representative' | 'low';

/**
 * Finds the candidate that produced `row`, by value + segment position. A client-routing finding is
 * carrier-independent by design (vulnerabilityId collapses every witness of one swapped value to one
 * row), so several equivalent candidates legitimately match — they are the SAME finding, any is a valid
 * witness for the report. We pick a deterministic representative, preferring the exact stored carrier
 * (candidate_url) and then the recomputed-id confirmation. `low` = the stored id predates the current id
 * function AND more than one candidate matched, so the representative is a best guess (still a real swap
 * of the recorded values), reported for the user to eyeball.
 */
function matchCandidate({ site, row }: { site: string; row: ReportRow }): { item?: UrlCandidate; confidence?: MatchConfidence; reason: string } {
  const found = generator.findUrlCandidates({ url: row.referenceUrl, site });
  const byValue = found.items.filter((it) =>
    String(it.candidate.referenceValue) === row.referenceValue &&
    it.candidate.candidateValue === row.candidateValue &&
    it.segment.location === row.segmentLocation &&
    (row.segmentLocation !== 'path' || (it.segment.indexFromRight ?? null) === (row.segmentIndex ?? null)));
  if (byValue.length === 0) return { reason: 'no candidate matches this swap any more (generator changed, or capture data differs)' };
  if (byValue.length === 1) return { item: byValue[0], confidence: 'unique', reason: 'unique value+position match' };

  // Exact carrier pin: a candidate whose reconstructed url equals the stored one is the very carrier recorded.
  const target = normalizeUrl(row.candidateUrl);
  const urlPinned = byValue.filter((it) => normalizeUrl(reconstructedUrl({ row, item: it })) === target);
  if (urlPinned.length === 1) return { item: urlPinned[0], confidence: 'id-confirmed', reason: 'pinned by the stored candidate_url' };

  const byId = byValue.filter((it) => recomputedId({ site, row, item: it }) === row.id);
  const pool = byId.length > 0 ? byId : byValue;
  const rep = [...pool].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))[0];
  if (byId.length === byValue.length && byId.length > 0) {
    return { item: rep, confidence: 'representative', reason: `representative of ${byValue.length} equivalent witnesses (all recompute to this finding's id)` };
  }
  if (byId.length > 0) return { item: rep, confidence: 'representative', reason: `representative of ${byId.length}/${byValue.length} id-matching witnesses` };
  return { item: rep, confidence: 'low', reason: `LOW confidence: ${byValue.length} candidates share this swap, none recompute to the stored (old-scheme) id — representative picked` };
}

/** Builds the http baseline kind from the captured event for a GET finding; undefined if the event is gone. */
function httpKind({ site, row }: { site: string; row: ReportRow }): ReproductionKind | undefined {
  const events = httpEventStore.listMetaBySite(site);
  const target = normalizeUrl(row.referenceUrl);
  const ev = events.find((e) => e.method.toUpperCase() === 'GET' && e.status === 200 && normalizeUrl(e.url) === target)
    ?? events.find((e) => normalizeUrl(e.url) === target);
  if (!ev) return undefined;
  const body = ev.id !== undefined ? httpEventStore.getResponseBody({ site, id: ev.id }) : ev.responseBody;
  return {
    type: 'http', method: ev.method, headers: ev.requestHeaders, postData: ev.postData,
    baselineStatus: ev.status ?? 0, baselineHeaders: ev.responseHeaders ?? {}, baselineBody: body ?? '', baselineContentType: ev.contentType,
  };
}

/** The reproduction kind for a finding, from its detection method + the matched segment. */
function kindFor({ site, row, item }: { site: string; row: ReportRow; item: UrlCandidate }): ReproductionKind | undefined {
  if (row.detectionMethod === 'http') return httpKind({ site, row });
  if (row.segmentLocation === 'query') return { type: 'client-routing-query', paramName: item.segment.paramName ?? '', candidateValue: row.candidateValue };
  return { type: 'client-routing-path', candidateUrl: row.candidateUrl };
}

interface SiteResult { matched: number; already: number; low: { id: string; reason: string }[]; unmatched: { id: string; reason: string }[] }

function backfillSite(site: string): SiteResult {
  generator.reset();
  const rows = vulnerabilityStore.listReportRows(site);
  const res: SiteResult = { matched: 0, already: 0, low: [], unmatched: [] };
  for (const row of rows) {
    if (row.evidence !== undefined) { res.already++; continue; }
    const { item, confidence, reason } = matchCandidate({ site, row });
    if (!item) { res.unmatched.push({ id: row.id, reason }); continue; }
    const kind = kindFor({ site, row, item });
    if (!kind) { res.unmatched.push({ id: row.id, reason: 'http baseline event not found in http_events' }); continue; }
    const evidence = buildEvidence({
      candidate: item.candidate,
      reproductionReferenceUrl: row.referenceUrl, reproductionCandidateUrl: row.candidateUrl,
      kind, clientRoutingProbe: config.analysis.clientRoutingProbe,
      redactHeaderNames: config.analysis.volatileAuthHeaders,
    });
    if (write) vulnerabilityStore.setEvidence({ id: row.id, evidence });
    res.matched++;
    if (confidence === 'low') res.low.push({ id: row.id, reason });
  }
  return res;
}

const sites = all ? vulnerabilityStore.sitesWithFindings() : [new URL(startArg!).hostname];
log.info(`backfillEvidence: ${write ? 'WRITE' : 'DRY RUN (no write)'} — ${sites.length} site(s)`);
let totMatched = 0, totAlready = 0, totLow = 0, totUnmatched = 0;
for (const site of sites) {
  const { matched, already, low, unmatched } = backfillSite(site);
  totMatched += matched; totAlready += already; totLow += low.length; totUnmatched += unmatched.length;
  log.info(`  ${site}: ${matched} matched${write ? ' + written' : ''}${low.length ? `, ${low.length} LOW confidence` : ''}, ${already} already, ${unmatched.length} unmatched`);
  for (const u of low) log.info(`      LOW  ${u.id.slice(0, 12)} — ${u.reason}`);
  for (const u of unmatched) log.info(`      UNMATCHED ${u.id.slice(0, 12)} — ${u.reason}`);
}
log.info(`backfillEvidence: total ${totMatched} matched (${totLow} low-confidence), ${totAlready} already present, ${totUnmatched} unmatched${write ? '' : ' — re-run with --write to apply'}`);
process.exit(0);
