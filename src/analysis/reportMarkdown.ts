import type { ReportRow } from '../db/VulnerabilityStore';
import type { FindingEvidence, StoredAuthz } from './reportEvidence';
import type { PropDiff } from './responseEvaluate';
import type { ResponseSimilarity } from './responseEvaluate';

/**
 * Renders the human-readable report.md for one finding. Pure: everything comes from the finding's own
 * columns (ReportRow) plus its parsed evidence/authz — no DB, no browser, no filesystem. The companion
 * test.ts carries the executable oracle; this file only EXPLAINS why the finding is an IDOR, in tables.
 */

/** A scalar for a table cell: JSON for objects, a quoted string, bounded length. */
function cell(value: unknown, max = 120): string {
  if (value === undefined) return '_(absent)_';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  const one = s.replace(/\s+/g, ' ').replace(/\|/g, '\\|');
  return '`' + (one.length > max ? one.slice(0, max) + '…' : one) + '`';
}

/** The subset of `differences` that the classifier flagged as authorization-relevant (key or path name in sensitiveKeys). */
function isSensitive({ diff, sensitiveKeys }: { diff: PropDiff; sensitiveKeys: string[] }): boolean {
  return sensitiveKeys.includes(String(diff.key)) || sensitiveKeys.includes(diff.pathStr);
}

function propsTable({ authz }: { authz: StoredAuthz }): string {
  if (authz.differences.length === 0) return '_No differing props were recorded._';
  const rows = authz.differences.map((d) => {
    const flag = isSensitive({ diff: d, sensitiveKeys: authz.sensitiveKeys }) ? '**yes**' : 'no';
    return `| \`${d.pathStr}\` | ${cell(d.reference)} | ${cell(d.current)} | ${flag} |`;
  });
  return [
    '| Prop | Your resource | Paid sibling | Authorization-relevant |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function whyBlock({ authz }: { authz: StoredAuthz }): string {
  const lines: string[] = [];
  if (authz.sensitiveKeys.length === 0) {
    lines.push('The props diff carried no key flagged as access-control-relevant (see the evidence below for why it was still recorded).');
    return lines.join('\n\n');
  }
  lines.push(`The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: ${authz.sensitiveKeys.map((k) => `\`${k}\``).join(', ')}.`);
  // The name-vs-value split is only shown when nameKeys was recorded for this finding (it was added after
  // some findings were stored); an undefined nameKeys means "not recorded", so we don't assert either way.
  if (authz.nameKeys !== undefined) {
    const names = authz.nameKeys;
    const valueOnly = authz.sensitiveKeys.filter((k) => !names.includes(k));
    if (names.length > 0) lines.push(`Flagged by **key/path name** (an entitlement-shaped name): ${names.map((k) => `\`${k}\``).join(', ')}.`);
    if (valueOnly.length > 0) lines.push(`Flagged by **value** only (an entitlement-shaped value under a neutral key): ${valueOnly.map((k) => `\`${k}\``).join(', ')}.`);
  }
  return lines.join('\n\n');
}

function evidenceBlock({ row, evidence }: { row: ReportRow; evidence: FindingEvidence }): string {
  if (evidence.kind.type === 'http') {
    const sim = row.responseSimilarity as ResponseSimilarity | null;
    const simLine = sim ? `Server-response similarity: \`${JSON.stringify(sim)}\`.` : '';
    return [
      `The forged **GET** replayed the request with the paid sibling's identifier, in the authenticated (lower-tier) session.`,
      `A finding means the server answered **2xx** with a body shaped like the baseline but **not identical** to it — the paid resource was served, not a denial or a fallback to the free content.`,
      simLine,
      `Baseline (your own request): status \`${evidence.kind.baselineStatus}\`, content-type \`${evidence.kind.baselineContentType ?? '(none)'}\`. Request/response headers in \`evidence.json\` have their credentials redacted.`,
      `**Oracle:** \`test.ts\` re-forges the GET live and asserts the server now **rejects** it (status ≥ 400, an empty/error body, or the free fallback). It is RED while the leak reproduces.`,
    ].filter(Boolean).join('\n\n');
  }
  // client-routing
  return [
    `This resource is reached purely through the SPA's **client-side routing** (no distinct backend request to forge): navigating to the forged URL renders the paid sibling's content in the authenticated lower-tier session.`,
    `**Oracle:** the normalized **DOM diff** (text nodes + \`<img>\` src + element count), with remount-noise calibration — the same comparison the pipeline's content guard uses. \`test.ts\` captures the reference page twice (to measure noise) and the forged URL once, masks both identifiers, and asserts the forged DOM is **inert** (≈ the reference, i.e. no paid content appeared) or the app's not-found page. It is RED while the paid content renders.`,
    `**Visual evidence only (not the criterion):** \`test.ts\` writes \`assets/original.png\`, \`assets/mutated.png\` and \`assets/diff.png\` next to this report. A screenshot is viewport-bound and asset-dependent, so it never decides the verdict.`,
  ].join('\n\n');
}

function position({ row }: { row: ReportRow }): string {
  if (row.segmentLocation === 'path') return `path segment, index ${row.segmentIndex ?? '?'} from the right`;
  if (row.segmentLocation === 'query') return 'query parameter';
  return row.detectionMethod === 'client-routing' ? 'client-side route' : 'URL';
}

/** Builds the full report.md string for one finding. `seedUrl` is the crawl's entry page (run_metadata.start_url); it falls back to the reference URL when unknown. */
export function renderReportMarkdown({ row, evidence, authz, seedUrl }: { row: ReportRow; evidence: FindingEvidence; authz: StoredAuthz; seedUrl?: string }): string {
  const detection = row.detectionMethod === 'http' ? 'HTTP forge' : 'client-side routing';
  const entry = seedUrl ?? evidence.reproductionReferenceUrl;
  return `# IDOR finding — ${row.site}

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | \`${row.id}\` |
| Site | ${row.site} |
| Detection | ${detection} |
| Swapped value | \`${row.referenceValue}\` → \`${row.candidateValue}\` |
| Position | ${position({ row })} |
| Recorded | ${row.reportedAt} |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** ${entry}

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** \`${evidence.reproductionReferenceUrl}\`
- **Forged request (the paid sibling's):** \`${evidence.reproductionCandidateUrl}\`

The identifier \`${row.referenceValue}\` was replaced with \`${row.candidateValue}\`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

${propsTable({ authz })}

## Why this is an IDOR

${whyBlock({ authz })}

## Evidence

${evidenceBlock({ row, evidence })}

## Reproduce

\`\`\`bash
node --import tsx --test test.ts   # from this finding's folder
\`\`\`

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
`;
}
