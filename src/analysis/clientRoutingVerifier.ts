import { log } from 'crawlee';
import type { Page } from 'playwright';
import { checkClientSideRouting, checkClientSideRoutingForPath, type ClientRoutingResult } from './clientRouting';
import { captureRouteByNavigation, captureDomSnapshot, diffDomSnapshots, domNoise, maskValue, makeGarbageValue, type DomSnapshot, type DomNoise } from './domSnapshot';
import type { PagePool } from './PagePool';
import { reactContentKey } from './reactFingerprint';
import type { RapidorGraph } from '../db/ReactStateStore';
import { sleep, safePath, sameRoutePath } from '../utils/utils';

// enqueueClientRoutingCheck: a negative client-routing probe is retried this many times in total
// (1 + this many extra attempts) before being trusted as a genuine "no" — see that method's own
// comment for why a single attempt is unreliable. CLIENT_ROUTING_RETRY_DELAY_MS gives the previous
// probe's un-awaited rollback render a moment to actually finish before the retry starts its own.
const MAX_CLIENT_ROUTING_ATTEMPTS = 3;
const CLIENT_ROUTING_RETRY_DELAY_MS = 250;

/** Sentinel: the content guard found the candidate's render identical to the reference's. */
const INERT = Symbol('inert');

/** The rejection reason a content guard returns for an inert render (the swapped value changed nothing). */
const INERT_CONTENT_REASON = 'renders the same page as the reference (the swapped value has no effect on the DOM content)';

/**
 * Prefix of the stage-3 reject for a DETERMINISTIC redirect-away (the app moved off the candidate route).
 * Unlike a flaky capture/content reject, retrying it cannot change the outcome, so the escalation retry
 * loop returns it immediately instead of re-navigating.
 */
export const REDIRECT_AWAY_PREFIX = 'full navigation redirected away';

/** The path a redirect-away reject landed on (e.g. `/pro`), or undefined for any other reject reason. */
export function redirectAwayTarget(reason: string): string | undefined {
  if (!reason.startsWith(REDIRECT_AWAY_PREFIX)) return undefined;
  return /\((\S+) != /.exec(reason)?.[1];
}

/** True if the app answered the candidate's own fetch with a success status: trust it, skip the visual guard. */
function networkConfirmsCandidate(probeRequests: { status: number }[]): boolean {
  return probeRequests.some((r) => r.status >= 200 && r.status < 300);
}

/**
 * Explains a negative client-routing probe for the debug log: distinguishes "the app never reacted
 * at all" from "the app DID mutate the DOM, but it redirected away from the candidate's own path" —
 * the busuu false positive (dashboard/review -> dashboard/dashboard, silently redirected by the
 * app's own router to dashboard/timeline) that motivated checkClientSideRouting*'s own redirect
 * guard. Without this distinction a rejected-by-redirect candidate logs identically to one the app
 * genuinely ignored, hiding exactly the case worth double-checking by hand.
 */
function describeClientRoutingRejection(result: ClientRoutingResult): string {
  return result.hasMutatedDom
    ? `DOM mutated but the app redirected away to ${result.finalUrl}`
    : 'no client-side DOM reaction';
}

/** Only the knobs this subsystem reads (see config.analysis for each one's own comment). */
export interface ClientRoutingVerifierOptions {
  clientRoutingProbe: { minWaitMs: number; idleMs: number; maxWaitMs: number };
  notFoundDomMaxDiff: number;
  clientRoutingFullNavigationEscalation: boolean;
  clientRoutingEscalationAttempts: number;   // total stage-3 attempts (1 = no retry); see config
}

export interface ClientRoutingVerifierDeps {
  pagePool: PagePool;
  options: ClientRoutingVerifierOptions;
}

/**
 * Decides whether a swapped value is honoured by the app's own client-side routing — the whole DOM
 * verification subsystem, isolated behind two methods (`verifyQueryParam` / `verifyPathSegment`) that
 * each return a rejection reason or null to accept. Everything flaky and safety-critical about IDOR
 * confirmation lives here: the retried pushState probe, the cheap->expensive stage ladder, the shared
 * content guard and the not-found calibration. Callers never see a `ClientRoutingResult` or a snapshot.
 *
 * The guards inside are justified one-by-one in .claude/rules/analysis.md; each exists because a
 * specific reference site produced a false positive (or lost a real finding) without it. Do not relax
 * one without re-running `scripts/recheckFindings.ts` on all four reference sites.
 */
export class ClientRoutingVerifier {
  // Per-run cache of the app's "not found" screenshot for each route template (the candidate URL with
  // its id slot blanked out): calibrated once per template by rendering a garbage value, then reused
  // to recognize any candidate on that template whose render is just the not-found page. `undefined`
  // means calibration was attempted but produced no usable shot, so don't keep retrying it. Holds the
  // in-flight PROMISE, not the resolved buffer, so concurrent probes on the same template (now that
  // the pool runs them in parallel) share one calibration instead of each rendering the garbage value.
  // per route template: the garbage-id render (the app's not-found page) and the garbage value itself,
  // so that value can be masked out of the baseline exactly as the candidate's own value is
  private notFoundBaselines = new Map<string, Promise<{ snapshot: DomSnapshot; value: string } | undefined>>();

  constructor(private deps: ClientRoutingVerifierDeps) {}

  /** Drops the per-run not-found calibrations. Call once at the start of each site's analysis. */
  reset(): void {
    this.notFoundBaselines.clear();
  }

  /**
   * Verifies a swapped QUERY PARAM: probes whether the SPA reads it (the hooked URLSearchParams.get
   * plus a DOM reaction), then runs the stage ladder. `candidateUrl` is the page's own route with the
   * param swapped — what the content guard renders and what a finding records.
   */
  async verifyQueryParam({ pageUrl, candidateUrl, paramName, candidateValue, referenceValue, highSuspicion }: {
    pageUrl: string; candidateUrl: string; paramName: string; candidateValue: string;
    referenceValue: string; highSuspicion: boolean;
  }): Promise<string | null> {
    const probe = this.deps.options.clientRoutingProbe;
    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl,
      run: (p) => checkClientSideRouting({ page: p, paramName, paramValue: candidateValue, ...probe }),
    });
    return this.clientSideConfirmed({ pageUrl, candidateUrl, candidateValue, referenceValue, clientRouting, highSuspicion });
  }

  /**
   * Verifies a swapped PATH SEGMENT: same ladder, but the probe has no `URLSearchParams.get` hook to
   * lean on (there is no cross-router way to observe "the app read path segment N"), so stage 1 rests
   * on the DOM reaction alone — see checkClientSideRoutingForPath's own doc comment.
   */
  async verifyPathSegment({ pageUrl, candidateUrl, candidateValue, referenceValue, highSuspicion }: {
    pageUrl: string; candidateUrl: string; candidateValue: string;
    referenceValue: string; highSuspicion: boolean;
  }): Promise<string | null> {
    const probe = this.deps.options.clientRoutingProbe;
    const clientRouting = await this.enqueueClientRoutingCheck({
      pageUrl,
      run: (p) => checkClientSideRoutingForPath({ page: p, targetUrl: candidateUrl, candidateValue, ...probe }),
    });
    return this.clientSideConfirmed({ pageUrl, candidateUrl, candidateValue, referenceValue, clientRouting, highSuspicion });
  }

  /**
   * Captures the CONTENT key (reactContentKey) of the candidate route's rendered React state — the
   * client-side evidence a client-routing finding has, the analog of an HTTP forge's response body.
   * Deliberately a SEPARATE real navigation, run only AFTER the (heavily-guarded) verifier has already
   * accepted a candidate: it keeps the verifier's accept/reject ladder untouched, and costs one extra
   * render on the few accepted findings, not every probe. A micro-test showed a synthetic popstate often
   * does NOT update the React tree (Next.js ignores it for sibling routes), so a real goto is required
   * to read the candidate's true state. Returns undefined when the extension is absent or the graph can't
   * be read — the caller then keeps the finding (never drops on missing evidence).
   */
  async captureReactContentKey({ pageUrl, candidateUrl }: { pageUrl: string; candidateUrl: string }): Promise<string | undefined> {
    const maxWaitMs = this.deps.options.clientRoutingProbe.maxWaitMs;
    return this.deps.pagePool.withPage({ pageUrl, run: async (page) => {
      try {
        await page.goto(candidateUrl, { waitUntil: 'load', timeout: 30_000 });
        // Extension absent (no __RAPIDOR__ API) → bail at once, no polling: the guard is simply inactive.
        const hasApi = await page.evaluate(() => typeof (window as unknown as { __RAPIDOR__getLatestState?: unknown }).__RAPIDOR__getLatestState === 'function').catch(() => false);
        if (!hasApi) return undefined;
        await page.waitForLoadState('networkidle', { timeout: maxWaitMs }).catch(() => {});
        // Poll the extension's MAIN-world API until the app has mounted and emitted a non-empty graph.
        let graph: RapidorGraph | undefined;
        for (let i = 0; i < 20 && !(graph?.nodes && Object.keys(graph.nodes).length > 0); i++) {
          graph = await page.evaluate(() => (window as unknown as { __RAPIDOR__getLatestState?: () => RapidorGraph | undefined }).__RAPIDOR__getLatestState?.() ?? undefined).catch(() => undefined);
          if (!(graph?.nodes && Object.keys(graph.nodes).length > 0)) await sleep(150);
        }
        return reactContentKey({ graph });
      } catch {
        return undefined;
      }
    } });
  }

  /**
   * Runs checkClientSideRouting* on a pool page (parallel across candidates, exclusive per page), and
   * retries a negative result up to MAX_CLIENT_ROUTING_ATTEMPTS times.
   *
   * The probe itself (clientRouting.ts) now AWAITS its own rollback re-render to settle before
   * resolving, so it leaves the shared pool page quiet for the next candidate — this is what removed
   * the order-dependent cross-candidate pollution that used to make *some* probe miss in the first
   * round or two (confirmed empirically via scripts/debugClientRoutingFlakiness.ts). This retry is
   * now only a secondary backstop for a genuinely slow FIRST render (a route whose render is gated on
   * a network fetch slower than the probe's own ceiling): it costs nothing when the first attempt
   * already succeeds, and a bounded re-run recovers that rare case — the same "redundant capture beats
   * a silent loss" tradeoff already made for react-state capture (see ReactStateStore.record()). The
   * retry loop stays on one page, and each attempt is itself self-cleaning.
   */
  private enqueueClientRoutingCheck({ pageUrl, run }: {
    pageUrl: string; run: (page: Page) => Promise<ClientRoutingResult>;
  }): Promise<ClientRoutingResult> {
    return this.deps.pagePool.withPage({ pageUrl, run: async (page) => {
      let attempt: ClientRoutingResult = { hasMutatedDom: false, isUsingNewParams: false, appReadParam: false, stayedOnRoute: false, finalUrl: pageUrl, probeRequests: [] };
      for (let i = 0; i < MAX_CLIENT_ROUTING_ATTEMPTS; i++) {
        attempt = await run(page);
        // A decisive positive ends the retries: the app rendered the candidate's OWN route (client
        // digestion), or the backend answered its fetch with a 2xx. The final accept/reject (incl. the
        // not-found guard) is decided later in clientSideConfirmed.
        if ((attempt.hasMutatedDom && attempt.stayedOnRoute) || networkConfirmsCandidate(attempt.probeRequests)) return attempt;
        if (i < MAX_CLIENT_ROUTING_ATTEMPTS - 1) await sleep(CLIENT_ROUTING_RETRY_DELAY_MS);
      }
      return attempt; // every attempt came back negative: a genuine "no", not a retry left on the table
    } });
  }

  /**
   * Decides whether a client-routing probe is evidence of an access-control issue. The primary signal
   * is CLIENT DIGESTION — the SPA rendered the candidate's own route and stayed on it (`hasMutatedDom
   * && stayedOnRoute`); a query param (or path segment) honoured entirely client-side, with no network
   * traffic at all, is a real finding, so the network is a filter here, never a veto (RAPIDOR's whole
   * point for this fallback: confirm the app consumed the mutated value). A content guard then
   * compares normalized DOM snapshots (domSnapshot.ts: text nodes + <img> src + element count, keyed by
   * structural path, with the route's remount noise calibrated out, see renderGuardDecision) to decide
   * whether the swapped value actually changed what the page shows:
   *
   * - **Inert value** (always, even when corroborated): the candidate's render equals the reference's.
   *   The app read the value (or even sent it to a backend that answered 2xx) and ignored it. The
   *   lingualeo false positive that motivated this: `buy/...?refclmark=2 -> refclmark=1`, a tracking
   *   param Next.js re-fetches through `_next/data/...json?refclmark=1` (a 2xx carrying the value, so
   *   the network "confirmed" it) while the page renders exactly the same. A DOM mutation alone is not
   *   new content: a framework re-render or a re-mounted widget mutates the DOM without showing anything
   *   new, which is why the probe's `hasMutatedDom` is not enough on its own.
   * - **Not found** (only when nothing corroborates): the candidate's render matches the app's own
   *   not-found page, see looksLikeNotFound.
   *
   * The guard runs in two passes (see the body): pushState first (cheap, the mechanism for a genuinely
   * client-routed app), and a real navigation only as a fallback when pushState left the candidate
   * identical to the reference (the SSR case). Each side is masked with its own value first (maskValue),
   * so a page that only echoes the id it was given compares equal. A `4xx` on an incidental request does
   * not reject on its own. Returns a rejection reason (for the debug log) or null to accept.
   */
  private async clientSideConfirmed({ pageUrl, candidateUrl, candidateValue, referenceValue, clientRouting, highSuspicion }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string;
    clientRouting: ClientRoutingResult; highSuspicion: boolean;
  }): Promise<string | null> {
    // Use the probe's ceiling, not its floor: a snapshot wants the fully-settled render of the route,
    // so give it the most generous window (the floor only bounds how early the DOM probe may report a
    // reaction, which is not what a content comparison needs).
    const settleMs = this.deps.options.clientRoutingProbe.maxWaitMs;
    const corroborated = clientRouting.appReadParam || networkConfirmsCandidate(clientRouting.probeRequests);
    const common = { pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, settleMs };

    // The stages run CHEAPEST-FIRST; the first to reach a verdict wins, an inconclusive stage falls
    // through to the next, and the costliest (a real page load) is always last and runs only when every
    // cheaper stage could not decide.

    // STAGE 1 — pushState digestion (no reload, the cheapest mechanism and the one a genuinely
    // client-routed SPA honours). Meaningful only when the app rendered the candidate's OWN route and
    // stayed on it; busuu/pimsleur decide entirely here, paying for nothing below.
    if (clientRouting.hasMutatedDom && clientRouting.stayedOnRoute) {
      const viaPush = await this.renderGuardDecision({ ...common, navigate: false });
      if (viaPush !== INERT) return viaPush; // accept, or a concrete reject (not-found)

      // STAGE 2 — SSR navigation fallback (LENIENT). pushState rendered nothing new, but a server-rendered
      // route (lingualeo's /en/training/<type>) produces its content only on a real load (0 vs ~96
      // differing nodes). The app ALREADY proved it digests this route in stage 1, so a failed capture
      // KEEPS (the pre-guard policy — never lose a find on a flaky load).
      const viaNav = await this.renderGuardDecision({ ...common, navigate: true });
      return viaNav === INERT ? INERT_CONTENT_REASON : viaNav;
    }

    // The app did NOT digest the value under pushState (no DOM reaction, or it redirected away). The cheap
    // probe is inconclusive. STAGE 3 — STRICT full navigation — is the only way left to tell a real
    // client-trusting IDOR (ejoy: Next.js ignores a synthetic popstate for a sibling lesson, so stage 1
    // sees nothing, yet a real load renders the sibling) from noise. It runs ONLY for a HIGH-SUSPICION
    // candidate (its props diff already crossed an authorization boundary — the caller's authz gate),
    // since it has no prior client-routing signal to lean on, and it re-imposes the pushState gate's
    // safety on the real load (a redirect-away or a failed capture is a REJECT, unlike stage 2). Kill
    // switch: config.analysis.clientRoutingFullNavigationEscalation.
    if (!highSuspicion || !this.deps.options.clientRoutingFullNavigationEscalation) {
      return describeClientRoutingRejection(clientRouting);
    }
    return this.confirmByFullNavigation({ ...common });
  }

  /**
   * STAGE 3 of clientSideConfirmed: a real page load (page.goto), run only for a high-suspicion candidate
   * whose cheaper pushState stage was inconclusive (no reaction / redirect-away). STRICT, because there is
   * no prior client-routing signal to lean on — unlike the lenient SSR fallback in stage 2:
   *  - a failed capture is a REJECT (not a "keep");
   *  - a goto the app redirected AWAY from the candidate's own path is a REJECT (the pushState gate's
   *    `stayedOnRoute`, re-imposed on the real load — this is what keeps busuu's dashboard/review ->
   *    dashboard/timeline redirect from flagging here);
   *  - otherwise the SHARED content guard decides (inert -> reject; distinct and not the not-found page ->
   *    accept), identical to every other stage.
   */
  private async confirmByFullNavigation(args: {
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string; corroborated: boolean; settleMs: number;
  }): Promise<string | null> {
    // Retry the escalation on a FLAKY reject: a single real load of a fetch-gated route (ejoy's lessons
    // fetch their content by id over XHR) can snapshot an incomplete render and read as a false NEGATIVE,
    // flipping which paid siblings surface run-to-run. An ACCEPT (null) ends immediately, and so does a
    // DETERMINISTIC redirect-away (re-navigating can't change where the app sends us). Only ever recovers
    // a finding — a genuine inert/not-found still rejects on the last attempt. See config.
    const attempts = Math.max(1, this.deps.options.clientRoutingEscalationAttempts);
    let reason: string | null = null;
    for (let i = 0; i < attempts; i++) {
      reason = await this.confirmByFullNavigationOnce(args);
      if (reason === null || reason.startsWith(REDIRECT_AWAY_PREFIX)) return reason;
      if (i < attempts - 1) await sleep(CLIENT_ROUTING_RETRY_DELAY_MS);
    }
    return reason;
  }

  /** One stage-3 full-navigation pass: capture, redirect-away guard, shared content guard. See confirmByFullNavigation. */
  private async confirmByFullNavigationOnce({ pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, settleMs }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string; corroborated: boolean; settleMs: number;
  }): Promise<string | null> {
    const renders = await this.deps.pagePool.withPage({ pageUrl, run: (page) => this.captureAroundCandidate({ page, pageUrl, candidateUrl, navigate: true, settleMs }) });
    if (!renders) return 'full-navigation capture failed (strict escalation needs a decisive render)';
    if (renders.candidateFinalUrl && !sameRoutePath(renders.candidateFinalUrl, candidateUrl)) {
      return `${REDIRECT_AWAY_PREFIX} from the candidate route (${safePath(renders.candidateFinalUrl)} != ${safePath(candidateUrl)})`;
    }
    const verdict = await this.judgeRenderedContent({ renders, pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate: true, settleMs });
    return verdict === INERT ? INERT_CONTENT_REASON : verdict;
  }

  /**
   * One pass of the content guard with a given capture mechanism (pushState when `navigate` is false,
   * a real navigation when true). Captures reference -> candidate -> reference on one held page,
   * calibrates the route's remount noise from the two reference renders, and returns:
   *  - `INERT` when the candidate's DOM equals the reference's (nothing to see) — the caller decides
   *    whether to stop (nav pass) or try the costlier mechanism (push pass);
   *  - a rejection string when it renders the app's not-found page;
   *  - `null` to ACCEPT (a real, distinct render), also when the capture failed and it cannot decide
   *    (keep — the pre-guard policy).
   */
  private async renderGuardDecision({ pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate, settleMs }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string;
    corroborated: boolean; navigate: boolean; settleMs: number;
  }): Promise<string | null | typeof INERT> {
    const renders = await this.deps.pagePool.withPage({ pageUrl, run: (page) => this.captureAroundCandidate({ page, pageUrl, candidateUrl, navigate, settleMs }) });
    // No snapshot: cannot decide with this mechanism. On the push pass, fall through to the fallback
    // (INERT); on the nav pass the caller turns INERT into "keep", the pre-guard policy.
    if (!renders) return navigate ? null : INERT;
    // A real load the app redirected AWAY from the candidate route is positive evidence of no access
    // (clozemaster bounces every paid story to /pro), never "new content": stage 2 is lenient only on a
    // FAILED capture, so it gets the same redirect-away guard as stage 1 (stayedOnRoute) and stage 3.
    if (navigate && renders.candidateFinalUrl && !sameRoutePath(renders.candidateFinalUrl, candidateUrl)) {
      return `${REDIRECT_AWAY_PREFIX} from the candidate route (${safePath(renders.candidateFinalUrl)} != ${safePath(candidateUrl)})`;
    }
    return this.judgeRenderedContent({ renders, pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate, settleMs });
  }

  /**
   * The SHARED content guard, independent of HOW the three renders were captured: masks both the
   * reference and candidate value out of every side (so a page that only echoes the id it was given
   * compares equal), calibrates the route's remount noise from the two bracketing reference renders,
   * then classifies the candidate's render — INERT (equals the reference, the swap changed nothing), the
   * app's own not-found page (a rejection string), or a genuinely distinct render (null → accept). Every
   * stage runs this verbatim, so the accept bar is identical whether the capture was a pushState or a
   * real navigation.
   */
  private async judgeRenderedContent({ renders, pageUrl, candidateUrl, candidateValue, referenceValue, corroborated, navigate, settleMs }: {
    renders: { before: DomSnapshot; candidate: DomSnapshot; after: DomSnapshot };
    pageUrl: string; candidateUrl: string; candidateValue: string; referenceValue: string;
    corroborated: boolean; navigate: boolean; settleMs: number;
  }): Promise<string | null | typeof INERT> {
    // Mask BOTH values out of every side. Masking each side with only its own value breaks on a stale
    // render: a pushState to an SSR route leaves the candidate showing the REFERENCE's value in its
    // content (it never re-rendered), and masking that candidate with only the candidate value leaves
    // the reference value in place, so it reads as "different" from the (masked) reference and even
    // matches the equally-stale not-found baseline — a route that is actually inert under pushState and
    // should fall through to the navigation fallback. Masking both values makes a stale render read
    // identical to the reference (-> INERT -> fallback), while a genuine leak still differs by its own
    // data (another user's name), which neither value masks.
    const mask = (snapshot: DomSnapshot): DomSnapshot =>
      maskValue({ snapshot: maskValue({ snapshot, value: referenceValue }), value: candidateValue });
    const candidateSnap = mask(renders.candidate);
    const before = mask(renders.before);
    const after = mask(renders.after);
    // Remount noise: what the reference route shows differently between its two renders with the value
    // unchanged (randomized quiz words, a carousel, a clock). Paths where the second reference render
    // shows the CANDIDATE's content are not noise but a stale render (the SPA did not re-render back):
    // counting them as noise could absorb exactly the leaking nodes.
    const noise = domNoise({ a: before, b: after, candidate: candidateSnap });

    const diff = diffDomSnapshots({ a: before, b: candidateSnap, noise });
    if (diff.changed.length === 0 && diff.nodeDelta === 0) return INERT;
    // what made it differ: the first thing to look at when a kept candidate looks wrong
    log.debug(`AnalysisPipeline: ${candidateUrl} differs from the reference (${navigate ? 'navigation' : 'pushState'}) by ${diff.changed.length} text node(s), ${diff.nodeDelta} element(s) (remount noise: ${noise.keys.size} path(s)): ${diff.changed.slice(0, 3).map((c) => `${c.key.split('/').slice(-3).join('/')} ${JSON.stringify(c.a)?.slice(0, 60)} -> ${JSON.stringify(c.b)?.slice(0, 60)}`).join(' | ')}`);

    if (!corroborated && await this.looksLikeNotFound({ pageUrl, candidateUrl, candidateValue, candidateSnap, referenceSnap: before, noise, navigate, settleMs })) {
      return "renders the app's not-found page";
    }
    return null;
  }

  /**
   * Reference -> candidate -> reference, on one exclusively-held page. `navigate` picks the mechanism:
   * a real page load (captureRouteByNavigation) or a pushState+popstate (captureDomSnapshot). Per
   * candidate, not cached per page: the two reference renders must bracket THIS candidate's render, so
   * whatever the route shows differently on every render is measured under the same conditions the
   * candidate was rendered in — lingualeo's training pages draw random quiz words every time, so
   * without the bracketing a genuinely different candidate route could not be told from that churn.
   * Undefined when any capture failed.
   */
  private async captureAroundCandidate({ page, pageUrl, candidateUrl, navigate, settleMs }: {
    page: Page; pageUrl: string; candidateUrl: string; navigate: boolean; settleMs: number;
  }): Promise<{ before: DomSnapshot; candidate: DomSnapshot; after: DomSnapshot; candidateFinalUrl?: string } | undefined> {
    const capture = navigate ? captureRouteByNavigation : captureDomSnapshot;
    const before = await capture({ page, testUrl: pageUrl, settleMs });
    const candidate = await capture({ page, testUrl: candidateUrl, settleMs });
    // The real load leaves the page on the candidate's FINAL url (after any app-side redirect); read it
    // now, before the `after` capture below navigates away. Only meaningful for the navigate mechanism
    // (pushState captures roll the url back) — the strict stage-3 redirect-away guard consumes it.
    const candidateFinalUrl = navigate ? page.url() : undefined;
    const after = await capture({ page, testUrl: pageUrl, settleMs });
    return before && candidate && after ? { before, candidate, after, candidateFinalUrl } : undefined;
  }

  /**
   * Not-found guard for a client-routing candidate that has no decisive network signal (no backend
   * response carried its value, or none was 2xx): compares the candidate's normalized DOM against the
   * app's own not-found page — calibrated once per route template by rendering a garbage id in the
   * same slot, with the SAME mechanism the candidate was captured with (pushState vs a real load give
   * different baselines, so they are cached separately). Unlike the inert guard this one is a
   * THRESHOLD, not equality: a not-found page often varies a little with the id beyond a plain echo (a
   * "did you mean" list, a tracking pixel). Both the text-node fraction and the element-count fraction
   * must be within `notFoundDomMaxDiff`.
   *
   * The baseline is used only when it is itself a USABLE not-found signal — meaningfully different from
   * the known-good reference page (`referenceSnap`). If rendering a garbage id looks like the real
   * reference, "looks like garbage" proves nothing: that happens for a soft-404 app (every id renders
   * the same shell) and, critically, when a capture failed to render the route at all (pimsleur behind
   * a cookie wall rendered the same consent shell for the reference AND the garbage id). Rejecting a
   * candidate for matching such a baseline would drop real findings on a flaky load, so the guard backs
   * off (returns false) instead. Returns false (keep the candidate) whenever it cannot decide.
   */
  private async looksLikeNotFound({ pageUrl, candidateUrl, candidateValue, candidateSnap, referenceSnap, noise, navigate, settleMs }: {
    pageUrl: string; candidateUrl: string; candidateValue: string; candidateSnap: DomSnapshot; referenceSnap: DomSnapshot; noise?: DomNoise; navigate: boolean; settleMs: number;
  }): Promise<boolean> {
    const template = `${navigate ? 'nav' : 'push'}\u0000${candidateUrl.split(candidateValue).join('\u0000')}`;   // id slot blanked out, keyed by mechanism
    // Calibrate once per template, deduping concurrent probes: store the in-flight promise so parallel
    // candidates on the same template await the same garbage-value render instead of each doing one.
    let calibration = this.notFoundBaselines.get(template);
    if (!calibration) {
      const garbageValue = makeGarbageValue(candidateValue);
      const garbageUrl = candidateUrl.split(candidateValue).join(garbageValue);
      const capture = navigate ? captureRouteByNavigation : captureDomSnapshot;
      calibration = this.deps.pagePool.withPage({ pageUrl, run: async (page) => {
        const snapshot = await capture({ page, testUrl: garbageUrl, settleMs });
        return snapshot ? { snapshot, value: garbageValue } : undefined;
      } });
      this.notFoundBaselines.set(template, calibration);
    }
    const baseline = await calibration;
    if (!baseline) return false;
    const maxDiff = this.deps.options.notFoundDomMaxDiff;

    // Is the garbage render actually a distinct "not found" page, or does it look like the real
    // reference (soft-404 / a failed render)? If the latter, it cannot tell a leak from a miss — back off.
    const vsReference = diffDomSnapshots({ a: maskValue({ snapshot: baseline.snapshot, value: baseline.value }), b: referenceSnap, noise });
    if (vsReference.textFraction <= maxDiff && vsReference.nodeFraction <= maxDiff) return false;

    const diff = diffDomSnapshots({ a: maskValue({ snapshot: baseline.snapshot, value: baseline.value }), b: candidateSnap, noise });
    return diff.textFraction <= maxDiff && diff.nodeFraction <= maxDiff;
  }
}
