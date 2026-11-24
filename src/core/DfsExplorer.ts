import type { Page } from 'playwright';
import { log } from 'crawlee';
import type {
  IStabilityWaiter, IActionExecutor, IStateCapturer, IStateNavigator, IStateStore, IStateGraph, IExplorationHooks,
} from './interfaces';
import type { UIState, Action, ElementDescriptor, ExplorationStopReason } from './types';
import { formatDuration } from './duration';
import { shuffled } from '../utils/utils';

export interface ExplorationLimits {
  maxDepth: number;
  maxStates: number;   // per tab: guarantees termination even on very rich UIs
  maxDurationSecs: number;  // time budget: shuts down before the Crawlee timeout
  randomizeClickOrder?: boolean;  // try a state's clickables in random order (see config.randomizeClickOrder)
}

/** Outcome of attempting one (state, element) pair. */
interface StepResult {
  reached: boolean;         // the element was located and clicked (vs only missed on this landing)
  next: UIState | null;     // the resulting state, when it is new and worth recursing into
}

/** A tab that explores: it has its own page and its own count of saved states. */
interface Worker {
  page: Page;
  saved: number;
  limitLogged: boolean;
}

const IDLE_POLL_MS = 50;

export class DfsExplorer {
  private deadline = Infinity;
  private limitHit: 'max-states' | 'max-duration' | null = null;   // first limit any tab reached (for onEnd)
  /** States with elements still to try: an idle tab takes work from another one here. */
  private frontier: UIState[] = [];
  private active = 0;   // tabs currently visiting a state

  constructor(
    private waiter: IStabilityWaiter,
    private executor: IActionExecutor,
    private capturer: IStateCapturer,
    private navigator: IStateNavigator,
    private store: IStateStore,
    private graph: IStateGraph,
    private limits: ExplorationLimits,
    private hooks?: IExplorationHooks,
  ) {}

  /**
   * Each tab runs a DFS; tabs share the store and the graph. Work splits by itself:
   * markExplored is synchronous, so whoever calls it first claims the (state, element) pair.
   * `extraPages` are extra tabs of the same context; hooks run only on `page`.
   */
  async explore(page: Page, extraPages: Page[] = []): Promise<void> {
    const startedAt = Date.now();
    this.deadline = startedAt + this.limits.maxDurationSecs * 1000;
    this.limitHit = null;
    // 'error' unless the DFS work settles without a worker failure (then: a limit, or the frontier ran dry)
    let stopReason: ExplorationStopReason = 'error';
    // Set right after the DFS work itself is done (success or a worker's own failure — allSettled
    // never rejects), so it reflects "time spent clicking around", separate from onEnd's analysis
    // time below, which only starts once this value is final. Stays 0 if onStart/the root capture
    // itself throws before any work ever runs.
    let explorationMs = 0;
    try {
      await this.hooks?.onStart(page);
      const workers: Worker[] = [page, ...extraPages].map((p) => ({ page: p, saved: 0, limitLogged: false }));
      const root = await this.capture(page, [], 0);
      await this.save(workers[0], root);
      const results = await Promise.allSettled(workers.map((w) => this.work(w)));
      explorationMs = Date.now() - startedAt;
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason;
      stopReason = this.limitHit ?? 'completed';
    } finally {
      await this.hooks?.onEnd(page, explorationMs, stopReason);
      // even if the exploration is interrupted, the graph collected so far is saved
      await this.graph.persist();
      log.info(`Exploration finished: ${this.store.count()} states, ${this.graph.edgeCount()} edges (${formatDuration(explorationMs)})`);
    }
  }

  /** Visits one state after another while there is work; if there is none but other tabs are still discovering, waits. */
  private async work(w: Worker): Promise<void> {
    for (;;) {
      if (this.limitReached(w)) return;
      const state = this.claimable();
      if (state) {
        this.active++;   // no await between claimable and here: no other tab can conclude that the work is done
        try {
          await this.visit(w, state);
        } finally {
          this.active--;
        }
      } else if (this.active === 0) {
        return;
      } else {
        await new Promise((resolve) => setTimeout(resolve, IDLE_POLL_MS));
      }
    }
  }

  /**
   * The oldest state that still has an element claimable right now (shorter path first, hence a
   * cheaper restore). A state whose every element is done is retired from the frontier. A state that
   * has only in-progress elements left (all currently claimed by other tabs) is kept but skipped
   * over, since a missed attempt may release one of them back for a retry — so, unlike the elements
   * being done, it is not safe to drop it.
   */
  private claimable(): UIState | null {
    let i = 0;
    while (i < this.frontier.length) {
      const s = this.frontier[i];
      if (s.clickables.every((el) => this.store.isDone(s.id, el.id))) {
        this.frontier.splice(i, 1);   // fully explored (clicked or given up): retire it
        continue;
      }
      if (s.clickables.some((el) => this.store.isClaimable(s.id, el.id))) return s;
      i++;   // only in-progress elements left here: keep it, look at the next state
    }
    return null;
  }

  private async save(w: Worker, state: UIState): Promise<void> {
    w.saved++;
    if (state.depth < this.limits.maxDepth && state.clickables.length > 0) this.frontier.push(state);
    await this.store.save(w.page, state);
  }

  private async visit(w: Worker, state: UIState): Promise<void> {
    if (state.depth >= this.limits.maxDepth) return;

    // Capture order is DOM/reading order, so nav/header chrome comes first and a budget-bounded DFS drains
    // it before reaching the page-centre buttons. Trying the clickables in RANDOM order instead samples the
    // whole set, giving central lesson buttons an early chance. A per-tab local shuffle of a COPY (never the
    // shared state.clickables): claimable()/claim() are order-independent, so this needs no cross-tab
    // coordination and does not affect restore (which replays the recorded path, not this order).
    const clickables = this.limits.randomizeClickOrder ? shuffled(state.clickables) : state.clickables;
    for (const el of clickables) {
      if (this.limitReached(w)) return;
      // claim is the synchronous, exclusive gate: skips a pair that is already done or that another
      // tab is attempting right now. A pair missed earlier (but still within budget) is claimable
      // again, so it is retried here on this later landing of the state.
      if (!this.store.claim(state.id, el.id)) continue;

      let result: StepResult;
      try {
        result = await this.step(w, state, el);
      } catch (err) {
        // an exception is a real error, not volatility: close the pair (don't hammer it) and move
        // on — a problematic element still only costs its own branch
        log.warning(`Error on "${el.text ?? el.selector}" in state ${state.id}: ${(err as Error).message}`);
        this.store.release(state.id, el.id, 'done');
        continue;
      }
      // reached === the element was found and clicked; a miss is released for a later retry so an
      // intermittent interstitial never permanently prunes this branch (see StateStore.release)
      this.store.release(state.id, el.id, result.reached ? 'done' : 'miss');
      if (result.next) await this.visit(w, result.next);
    }
  }

  /**
   * Restores the state, clicks the element, captures the result. `reached` tells visit whether the
   * element was actually found and clicked (so the pair is done) or only missed (so it is worth
   * retrying later); `next` is the resulting state when it is new and worth recursing into.
   */
  private async step(w: Worker, state: UIState, el: ElementDescriptor): Promise<StepResult> {
    const { page } = w;
    if (!(await this.navigator.restore(page, state, el))) {
      log.debug(`State ${state.id} could not be restored for "${el.text ?? el.selector}" — will retry if budget allows`);
      return { reached: false, next: null };
    }

    // we are now on `state`: let hooks (e.g. the extension) record it before we click away from it
    await this.hooks?.beforeAction?.(page);

    const action: Action = { type: 'click', target: el };
    if (!(await this.executor.execute(page, action))) return { reached: false, next: null };

    const next = await this.capture(page, [...state.path, action], state.depth + 1);
    // still on the clicked result and stable: let hooks (e.g. the extension) finish analysing it
    // before the next element's restore reloads the page. Runs even for already-seen states, since
    // the click may have loaded a different query-param resource worth analysing.
    await this.hooks?.afterAction?.(page);
    this.graph.addEdge(state.id, action, next.id);
    // has and save are synchronous up to the insertion: of two tabs arriving together, only the first one saves
    if (this.store.has(next.id)) return { reached: true, next: null };   // state already seen: no recursion

    await this.save(w, next);
    await this.graph.persist();   // the graph grows along with the states: readers see it up to date while the exploration is running
    log.info(`New state ${next.id} at depth ${next.depth} (${next.clickables.length} clickables)`);
    return { reached: true, next };
  }

  private limitReached(w: Worker): boolean {
    let reason: string | null = null;
    if (w.saved >= this.limits.maxStates) {
      reason = `limit of ${this.limits.maxStates} states`;
      this.limitHit ??= 'max-states';
    } else if (Date.now() >= this.deadline) {
      reason = `budget of ${this.limits.maxDurationSecs}s`;
      this.limitHit ??= 'max-duration';
    }
    if (reason && !w.limitLogged) {
      log.warning(`Reached the ${reason}: exploration stopped`);
      w.limitLogged = true;
    }
    return reason !== null;
  }

  private async capture(page: Page, path: Action[], depth: number): Promise<UIState> {
    await this.waiter.waitForStable(page);
    const snapshot = await this.capturer.capture(page);
    return { ...snapshot, depth, path };
  }
}
