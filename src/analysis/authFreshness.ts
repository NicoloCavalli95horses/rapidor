import type { Page } from 'playwright';
import type { HttpEventRow } from '../db/HttpEventStore';

/**
 * Probes whether the profile's auth session is still valid before a re-analysis run. Re-fetches a few
 * requests that were authenticated (2xx JSON GETs) at capture time: if several now answer 401/403 the
 * token has EXPIRED, and every forged request would be denied — so the analysis would either flag
 * nothing or, worse, silently lean on the stale authenticated responses still in the forge cache
 * (forged_requests is keyed by URL, not session). The caller warns and aborts.
 *
 * Only JSON GETs that were 200 are probed: a static asset answers 200 regardless of the token and would
 * hide an expiry. Two or more previously-authenticated endpoints now denied is the confidence bar — a
 * single one could have changed for an unrelated reason.
 */
export async function checkAuthFresh({ page, events, sample = 5 }: {
  page: Page; events: HttpEventRow[]; sample?: number;
}): Promise<{ expired: boolean; probed: number; denied: number; sampleUrl?: string }> {
  const seen = new Set<string>();
  const urls = events
    .filter((e) => e.method.toUpperCase() === 'GET' && e.status === 200 && (e.contentType ?? '').includes('json'))
    .map((e) => e.url)
    .filter((u) => !seen.has(u) && seen.add(u))
    .slice(0, sample);

  let denied = 0;
  let sampleUrl: string | undefined;
  for (const url of urls) {
    const status = await page.request.fetch(url, { method: 'GET' }).then((r) => r.status()).catch(() => undefined);
    if (status === 401 || status === 403) { denied++; sampleUrl ??= url; }
  }
  return { expired: denied >= 2, probed: urls.length, denied, sampleUrl };
}
