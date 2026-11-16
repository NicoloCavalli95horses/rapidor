import type { Page, Response } from 'playwright';

/** A same-site request the route change triggered, and the status the server answered it with. */
export interface ProbeRequest {
  url: string;
  status: number;
}

export interface ClientRoutingResult {
  // Composite kept for callers that want the old single flag (reproduction scripts, the flakiness
  // diagnostic): the app read the param (query only) AND rendered the candidate route AND stayed on
  // it. The pipeline no longer gates on this — it weighs the raw signals below so a param honoured
  // purely client-side, with no observable param read, is still a finding (see AnalysisPipeline's
  // clientSideConfirmed).
  isUsingNewParams: boolean;
  hasMutatedDom: boolean;
  // Query probe only: the app actually read the swapped param through URLSearchParams.get (hooked by
  // installParamUsageTracking). Strong corroboration that the SPA consumed the mutated value — but
  // not required, since an app may parse the query string in a way the hook does not see. Always
  // false for the path probe (no equivalent signal exists for a path segment).
  appReadParam: boolean;
  // The browser is still on the candidate's OWN route once the DOM settled (not redirected away to a
  // fallback). This is the primary "the app digested the swap" signal, paired with hasMutatedDom.
  stayedOnRoute: boolean;
  // window.location.href right after the idle wait, before the probe rolls the URL back. Lets a
  // caller tell "the app rendered the candidate" apart from "the app's router rejected the candidate
  // and redirected elsewhere" — both mutate the DOM, but only the first is evidence of anything.
  finalUrl: string;
  // Requests whose URL CARRIES the candidate value as a whole path segment or whole query-param value
  // (boundary match, not substring — so "298" never matches the customer id "6140298"), fired by the
  // app WHILE the probe rendered the candidate route. A 2xx here corroborates that the app fetched and
  // served the candidate resource. Empty when nothing matching was observed (a purely client-routed
  // page, or a probe run without a watch value).
  probeRequests: ProbeRequest[];
}

/**
 * Shared browser-side helper, inlined into both probes below. Watches the DOM after a synthetic
 * route change and resolves with whether anything mutated, with three windows:
 *
 * - `minWait` (floor): the earliest a reaction may be reported settled. A route that renders in
 *   bursts, or a router that redirects an unrecognized path to its fallback, needs a little time to
 *   fully manifest before `finalUrl`/the mutation flag are read; the floor guarantees that.
 * - `idleTime` (settle): once a mutation has happened, resolve after the DOM has been quiet this long.
 * - `maxWait` (ceiling): an absolute stop. It does two things the old floor-only loop could not:
 *     (1) it guarantees termination even on a page that never goes quiet (a persistent spinner or
 *         polling that mutates faster than `idleTime` — the old loop would have waited forever), and
 *     (2) it keeps watching for a FIRST mutation past the floor. A route whose render is gated on a
 *         slow network fetch can start mutating only after `minWait`; the old code gave up exactly at
 *         the floor and reported "no reaction", a false negative. Here, nothing is reported settled
 *         until something has actually mutated, so such a late first render is still caught (up to the
 *         ceiling); a route that genuinely never reacts simply rides to `maxWait` and reports false.
 *
 * The MutationObserver is attached synchronously, before the caller dispatches the popstate event
 * that may trigger a router's (usually synchronous, for non-React routers) DOM update — attaching it
 * after dispatchEvent would miss exactly that common case.
 *
 * A hand-written JS source string, not a TS function literal passed to page.evaluate(): tsx/esbuild's
 * name-preservation transform injects `__name(...)` helper calls into compiled functions, and once
 * Playwright serializes such a function for the page, that helper (which only exists in this Node
 * process's module scope) is undefined there. A string literal is opaque to the compiler, so nothing
 * gets instrumented inside it.
 */
const WAIT_DOM_IDLE_SRC = `
  function waitDomIdle(minWait, idleTime, maxWait) {
    return new Promise((resolve) => {
      let hasMutatedDom = false;
      let lastChange = Date.now();
      const start = Date.now();
      const observer = new MutationObserver(() => {
        hasMutatedDom = true;
        lastChange = Date.now();
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      // Network-aware: a route whose content loads through a fetch/XHR (e.g. the app POSTs for the new
      // view's data, then renders the response) is not "settled" while that request is still in flight,
      // even if the DOM happens to be momentarily quiet. installInflightTracking exposes the live count
      // on window.__probeInflight; we refuse to settle while it is > 0, so the eventual render is
      // caught instead of resolving in the network gap. The ceiling still bounds everything.
      function busy() { return (window.__probeInflight | 0) > 0; }
      function check() {
        const now = Date.now();
        const elapsed = now - start;
        if (elapsed >= maxWait) {
          observer.disconnect();
          resolve(hasMutatedDom);
        } else if (hasMutatedDom && elapsed >= minWait && now - lastChange >= idleTime && !busy()) {
          observer.disconnect();
          resolve(true);
        } else {
          requestAnimationFrame(check);
        }
      }
      check();
    });
  }
`;

/**
 * Installs transparent in-flight counters on fetch and XMLHttpRequest (window.__probeInflight), so
 * waitDomIdle can keep waiting while the route's data request is still loading. Returns an uninstall
 * function the probe calls in its `finally`, restoring the originals. Wrapped defensively: if the app
 * froze fetch/XHR or anything throws, tracking is simply skipped (busy() then reads 0, i.e. the old
 * behaviour) rather than breaking the probe.
 */
const INFLIGHT_TRACKER_SRC = `
  function installInflightTracking() {
    try {
      window.__probeInflight = 0;
      const origFetch = window.fetch;
      const inc = function () { window.__probeInflight = (window.__probeInflight | 0) + 1; };
      const dec = function () { window.__probeInflight = Math.max(0, (window.__probeInflight | 0) - 1); };
      if (typeof origFetch === 'function') {
        window.fetch = function () {
          inc();
          let p;
          try { p = origFetch.apply(this, arguments); } catch (e) { dec(); throw e; }
          return Promise.resolve(p).then(function (r) { dec(); return r; }, function (e) { dec(); throw e; });
        };
      }
      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function () {
        inc();
        this.addEventListener('loadend', dec);
        return origSend.apply(this, arguments);
      };
      return function uninstall() {
        try { window.fetch = origFetch; XMLHttpRequest.prototype.send = origSend; window.__probeInflight = 0; } catch (e) {}
      };
    } catch (e) {
      return function () {};
    }
  }
`;

/**
 * Settle helper for the probe's OWN rollback, not for detection. After the probe restores the
 * original URL (pushState + popstate), the app re-renders the original route; that render used to be
 * fire-and-forget, so the Node promise resolved while the browser was still mutating the DOM. The
 * next probe on the SAME pool page then started mid-render, and its popstate could be coalesced /
 * dropped by a router still busy with the rollback — a false "no reaction" miss, the documented root
 * of the client-routing flakiness. Awaiting this before resolving guarantees the page is quiet (and
 * no rollback fetch is in flight) when the next candidate begins, so each probe starts from the same
 * clean state and the result stops depending on candidate order.
 *
 * Unlike waitDomIdle, it does NOT require a mutation to have happened: a rollback that re-renders
 * nothing resolves after a single `idleTime` of quiet instead of riding to the ceiling. `maxWait`
 * only bounds a rollback whose render never goes quiet. `busy()` reads the same in-flight counter,
 * so a network-gated rollback render is awaited too (the tracker is uninstalled only afterwards).
 */
const WAIT_DOM_SETTLE_SRC = `
  function waitDomSettle(idleTime, maxWait) {
    return new Promise((resolve) => {
      let lastChange = Date.now();
      const start = Date.now();
      const observer = new MutationObserver(() => { lastChange = Date.now(); });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      function busy() { return (window.__probeInflight | 0) > 0; }
      function check() {
        const now = Date.now();
        if (now - start >= maxWait) {
          observer.disconnect();
          resolve();
        } else if (now - lastChange >= idleTime && !busy()) {
          observer.disconnect();
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      }
      check();
    });
  }
`;

/**
 * Port of RAPIDOR's requestGenerator.js isUsingQueryParams/waitDOMIdle fallback: when a forged real
 * HTTP request for a query-param candidate does not look like it succeeded (or never could, because
 * the candidate value is never sent over the network at all — a purely client-routed SPA), check
 * whether the page's own client-side routing honors that query param anyway, independently of any
 * server response. Mutates the live page's location (pushState + a synthetic popstate, since raw
 * pushState alone does not fire anything) and watches whether the DOM reacts; always rolls the URL
 * back, even on an unexpected error. Requires `installParamUsageTracking` to have already run on
 * `page` (an init script, so it is in place before any app code loads).
 *
 * `minWaitMs`/`idleMs`/`maxWaitMs` size the waitDomIdle window (floor / settle / ceiling — see
 * WAIT_DOM_IDLE_SRC's own doc comment): AnalysisPipeline passes config.analysis.clientRoutingProbe
 * explicitly, sized to match the rest of the pipeline's own settle windows rather than the much
 * shorter 500/100ms this used to hardcode — see that config field's own comment. Optional here
 * (defaulting to that same config value) only so standalone scripts and previously generated
 * reproduction scripts that call this directly, without threading the config through, keep compiling
 * and behave the same as a real pipeline run.
 *
 * `isUsingNewParams` also requires the browser to still be sitting on `testUrl`'s own pathname once
 * the DOM settles: a false positive observed on busuu (dashboard/review -> dashboard/dashboard,
 * client-routing-path) showed the app's router silently redirecting an unrecognized route to its own
 * fallback (dashboard/timeline) — a real DOM mutation (the fallback page rendering), but evidence the
 * candidate was REJECTED, not accepted. Without this guard that redirect reads identically to a
 * genuine "the app rendered the candidate's content".
 */
export async function checkClientSideRouting({ page, paramName, paramValue, minWaitMs = 1_000, idleMs = 300, maxWaitMs = 3_000 }: {
  page: Page; paramName: string; paramValue: string; minWaitMs?: number; idleMs?: number; maxWaitMs?: number;
}): Promise<ClientRoutingResult> {
  const script = `(async () => {
    const paramName = ${JSON.stringify(paramName)};
    const paramValue = ${JSON.stringify(paramValue)};
    const w = window;
    if (w.__accessedParams) w.__accessedParams.clear();

    const originalUrl = window.location.href;
    const testUrl = new URL(originalUrl);
    testUrl.searchParams.set(paramName, paramValue);

    ${WAIT_DOM_IDLE_SRC}
    ${INFLIGHT_TRACKER_SRC}
    ${WAIT_DOM_SETTLE_SRC}

    let hasMutatedDom = false;
    let finalUrl = originalUrl;
    const uninstallInflight = installInflightTracking(); // before the popstate that triggers the app's fetches
    try {
      window.history.pushState({ ignore: true }, '', testUrl);
      // started BEFORE dispatchEvent: see WAIT_DOM_IDLE_SRC's doc comment above.
      const idle = waitDomIdle(${minWaitMs}, ${idleMs}, ${maxWaitMs});
      window.dispatchEvent(new Event('popstate'));
      hasMutatedDom = await idle;
      finalUrl = window.location.href; // read before the rollback below moves it back
    } finally {
      // Roll the URL back, then WAIT for the rollback's own re-render to settle before resolving, so
      // the next probe on this shared pool page starts from a quiet DOM instead of landing mid-render
      // (the documented flakiness root — see WAIT_DOM_SETTLE_SRC). The in-flight tracker stays
      // installed across the settle so a network-gated rollback render is awaited too, then uninstalls.
      window.history.pushState({ ignore: true }, '', originalUrl);
      window.dispatchEvent(new Event('popstate'));
      await waitDomSettle(${idleMs}, ${maxWaitMs});
      uninstallInflight();
    }

    const stayedOnTestPath = new URL(finalUrl).pathname === testUrl.pathname;
    const appReadParam = Boolean(w.__accessedParams && w.__accessedParams.has(paramName));

    return {
      hasMutatedDom: hasMutatedDom,
      finalUrl: finalUrl,
      appReadParam: appReadParam,
      stayedOnRoute: stayedOnTestPath,
      isUsingNewParams: appReadParam && hasMutatedDom && stayedOnTestPath,
    };
  })()`;

  // the app re-fetches with the swapped query value, so a matching response URL carries paramValue
  return evaluateProbe({ page, script, watchValue: paramValue });
}

/**
 * Path-segment analog of checkClientSideRouting, for candidates like busuu's
 * .../objective_<uuid>/... — a value that only ever appears in the page's own URL PATH, never in a
 * query string. Unlike URLSearchParams.get, there is no single API to hook across routers (React
 * Router, Next.js, a bespoke one...) that would tell us "the app read path segment N", so
 * `installParamUsageTracking`'s __accessedParams signal has no path equivalent here: this probe
 * relies on hasMutatedDom alone (isUsingNewParams mirrors it exactly) rather than "accessed &&
 * mutated" — a weaker, single-signal version of the query-param check above, since the DOM could in
 * principle mutate for an unrelated reason while the app ignores the new segment. `targetUrl` is the
 * full replacement URL (already spliced by the caller via spliceSegment): simpler than trying to
 * reconstruct a URLSearchParams-style builder for an arbitrary path shape.
 *
 * `minWaitMs`/`idleMs`: see checkClientSideRouting's own doc comment above (optional, same default).
 *
 * `isUsingNewParams` also requires the browser to still be on `targetUrl`'s own pathname once the
 * DOM settles — see checkClientSideRouting's own doc comment above for the busuu false positive
 * (a router redirecting an unrecognized path to its fallback) this guards against. It matters even
 * more here than in the query-param probe above: there is no __accessedParams signal for a path
 * segment at all, so hasMutatedDom used to be the ENTIRE signal — any redirect-away looked identical
 * to a genuine accept.
 */
export async function checkClientSideRoutingForPath({ page, targetUrl, candidateValue, minWaitMs = 1_000, idleMs = 300, maxWaitMs = 3_000 }: {
  page: Page; targetUrl: string; candidateValue?: string; minWaitMs?: number; idleMs?: number; maxWaitMs?: number;
}): Promise<ClientRoutingResult> {
  const script = `(async () => {
    const targetUrl = ${JSON.stringify(targetUrl)};
    const originalUrl = window.location.href;

    ${WAIT_DOM_IDLE_SRC}
    ${INFLIGHT_TRACKER_SRC}
    ${WAIT_DOM_SETTLE_SRC}

    let hasMutatedDom = false;
    let finalUrl = originalUrl;
    const uninstallInflight = installInflightTracking(); // before the popstate that triggers the app's fetches
    try {
      window.history.pushState({ ignore: true }, '', targetUrl);
      // started BEFORE dispatchEvent: see WAIT_DOM_IDLE_SRC's doc comment above.
      const idle = waitDomIdle(${minWaitMs}, ${idleMs}, ${maxWaitMs});
      window.dispatchEvent(new Event('popstate'));
      hasMutatedDom = await idle;
      finalUrl = window.location.href; // read before the rollback below moves it back
    } finally {
      // Roll the URL back, then WAIT for the rollback's own re-render to settle before resolving, so
      // the next probe on this shared pool page starts from a quiet DOM instead of landing mid-render
      // (the documented flakiness root — see WAIT_DOM_SETTLE_SRC). The in-flight tracker stays
      // installed across the settle so a network-gated rollback render is awaited too, then uninstalls.
      window.history.pushState({ ignore: true }, '', originalUrl);
      window.dispatchEvent(new Event('popstate'));
      await waitDomSettle(${idleMs}, ${maxWaitMs});
      uninstallInflight();
    }

    const stayedOnTargetPath = new URL(finalUrl).pathname === new URL(targetUrl).pathname;

    return {
      hasMutatedDom: hasMutatedDom,
      finalUrl: finalUrl,
      appReadParam: false,
      stayedOnRoute: stayedOnTargetPath,
      isUsingNewParams: hasMutatedDom && stayedOnTargetPath,
    };
  })()`;

  // candidateValue is the swapped path segment: a response URL carrying it is the app's own fetch
  // for the candidate resource (its status is the network ground truth). Optional so existing
  // callers (reproduction scripts) keep working with no network signal, exactly as before.
  return evaluateProbe({ page, script, watchValue: candidateValue });
}

/**
 * Runs a probe script in the page, degrading any failure to a benign "the app did not react"
 * result instead of throwing. The probe's own pushState + synthetic popstate can make the app's
 * router perform a REAL navigation, which destroys the execution context mid-`page.evaluate`
 * ("Execution context was destroyed, most likely because of a navigation"). Left unhandled that
 * rejection used to crash the entire analysis run partway through the client-routing phase; it is
 * never evidence of an authorization issue (the candidate value was never confirmed to render), so
 * reporting "not using new params" is both safe and correct. The caller's queue re-navigates back
 * to the page URL before the next probe, so a destroyed context does not strand later candidates.
 */
async function evaluateProbe({ page, script, watchValue }: {
  page: Page; script: string; watchValue?: string;
}): Promise<ClientRoutingResult> {
  // Network ground truth: collect the status of every same-session response whose URL carries the
  // candidate value while the probe renders the route. Scoped by `watchValue` so the probe's own
  // rollback fetch (which targets the ORIGINAL url, not the candidate) and unrelated analytics never
  // count. The probe is serialized, so this window belongs to this candidate alone.
  const probeRequests: ProbeRequest[] = [];
  const onResponse = watchValue
    ? (response: Response) => {
        try {
          const url = response.url();
          if (urlCarriesValue(url, watchValue)) probeRequests.push({ url, status: response.status() });
        } catch { /* response object went away with a navigation */ }
      }
    : undefined;
  if (onResponse) page.on('response', onResponse);
  try {
    const result = await (page.evaluate(script) as Promise<Omit<ClientRoutingResult, 'probeRequests'>>);
    return { ...result, probeRequests };
  } catch {
    return { hasMutatedDom: false, isUsingNewParams: false, appReadParam: false, stayedOnRoute: false, finalUrl: safeUrl(page), probeRequests };
  } finally {
    if (onResponse) page.off('response', onResponse);
  }
}

/**
 * Does `url` carry `value` as a WHOLE path segment or a WHOLE query-param value — not as an arbitrary
 * substring? A plain `url.includes(value)` falsely matches a short id inside a longer one (the real
 * case that motivated this: candidate "298" matching the customer id "6140298" that rides along in
 * every authenticated API call, producing a spurious network "confirm"). Matching only at segment /
 * param-value boundaries attributes a network response to the candidate only when it genuinely
 * targets that resource. Falls back to a substring test if the URL does not parse.
 */
export function urlCarriesValue(url: string, value: string): boolean {
  try {
    const u = new URL(url);
    if (u.pathname.split('/').some((seg) => decodeURIComponent(seg) === value)) return true;
    for (const v of u.searchParams.values()) if (v === value) return true;
    return false;
  } catch {
    return url.includes(value);
  }
}

/** page.url() without throwing (a closed/navigating page can still reject here on some builds). */
function safeUrl(page: Page): string {
  try {
    return page.url();
  } catch {
    return '';
  }
}
