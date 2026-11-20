import type { Page, Request } from 'playwright';

/**
 * Refreshed auth material for a re-analysis run (t2) whose originally-captured (t1) session expired.
 * The forge replays the CAPTURED request headers; when they carry stale credentials, every probe is
 * denied. After a manual re-login (scripts/refreshAuth.ts) this override re-points the forge at the
 * fresh session instead of re-crawling:
 * - stripCookie: drop the captured `Cookie` header so page.request.fetch uses the re-authenticated
 *   browser context's own (fresh) cookies — the fix for cookie-auth sites (busuu, lingualeo).
 * - freshHeaders: fresh values for header-authenticated sites (a bearer token etc.), harvested at t2
 *   and overlaid onto every forged request's headers — the fix for header-auth sites (pimsleur).
 */
export interface AuthOverride {
  stripCookie: boolean;
  freshHeaders: Record<string, string>; // lowercased header names -> fresh value
}

/**
 * Pure: the captured t1 headers transformed into the headers the forge should actually send at t2.
 * Case-insensitive — a captured `Cookie`/`Authorization` in any case is dropped/replaced. No override
 * (the common path, token never expired) returns the headers untouched, so the forge is byte-identical
 * to before.
 */
export function applyAuthOverride({ headers, override }: {
  headers?: Record<string, string>; override?: AuthOverride | null;
}): Record<string, string> | undefined {
  if (!headers || !override) return headers;
  const replaced = new Set(Object.keys(override.freshHeaders).map((n) => n.toLowerCase()));
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (override.stripCookie && lower === 'cookie') continue; // use the context's fresh cookies instead
    if (replaced.has(lower)) continue;                        // overwritten by the fresh value below
    out[name] = value;
  }
  for (const [name, value] of Object.entries(override.freshHeaders)) out[name] = value;
  return out;
}

/**
 * Harvests the current header-auth (bearer token etc.) after a manual re-login: reloads the page and
 * reads the named headers off the first same-site request that carries them. Cookie auth needs nothing
 * here (it rides the context), so a cookie-auth site simply returns {}. Resolves {} on timeout rather
 * than hanging. Used by scripts/refreshAuth.ts.
 */
export async function harvestSessionAuth({ page, site, headerNames, timeoutMs = 15_000 }: {
  page: Page; site: string; headerNames: string[]; timeoutMs?: number;
}): Promise<Record<string, string>> {
  const wanted = headerNames.map((h) => h.toLowerCase());
  return new Promise((resolve) => {
    const finish = (v: Record<string, string>) => { page.off('request', onReq); clearTimeout(timer); resolve(v); };
    const onReq = (req: Request) => {
      void (async () => {
        try {
          if (new URL(req.url()).hostname !== site) return;   // same-site only
          const h = await req.allHeaders();
          const picked: Record<string, string> = {};
          for (const name of wanted) if (h[name]) picked[name] = h[name];
          if (Object.keys(picked).length) finish(picked);
        } catch { /* a request whose headers we cannot read: ignore and keep listening */ }
      })();
    };
    const timer = setTimeout(() => finish({}), timeoutMs);
    page.on('request', onReq);
    page.reload({ waitUntil: 'load' }).catch(() => {});   // provoke the app's authenticated requests
  });
}
