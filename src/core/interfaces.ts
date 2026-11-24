import type { Page } from 'playwright';
import type { Action, ElementDescriptor, ExplorationStopReason, Snapshot, UIState } from './types.js';

export interface IClickableExtractor { extract(page: Page): Promise<ElementDescriptor[]> }
export interface IPageTextExtractor { extract(page: Page): Promise<string[]> }
export interface IStabilityWaiter { waitForStable(page: Page): Promise<void> }
export interface IActionExecutor {
  execute(page: Page, a: Action): Promise<boolean>;
  /** True if the target can be located on the current page (same overlay handling as a click, but no click). */
  locate(page: Page, a: Action): Promise<boolean>;
}

export interface FingerprintInput { url: string; clickables: ElementDescriptor[]; texts: string[] }
/** Pure function: same data, same hash. No browser access. */
export interface IStateFingerprinter { fingerprint(input: FingerprintInput): string }

/** Extracts clickables and texts and computes the id: the only way the engine "looks" at the page. */
export interface IStateCapturer { capture(page: Page): Promise<Snapshot> }

export interface IStateNavigator { restore(page: Page, s: UIState, el: ElementDescriptor): Promise<boolean> }

export interface IStateStore {
  has(id: string): boolean;
  count(): number;
  save(page: Page, s: UIState): Promise<void>;
  /**
   * Synchronously takes ownership of a (state, element) attempt. Returns false if the pair is
   * already done (successfully clicked, or given up after the attempt budget) or currently being
   * attempted by another tab. Being synchronous and side-effecting, it is the claim that keeps two
   * tabs from clicking the same element: whoever calls it first wins, with no await in between.
   */
  claim(stateId: string, elId: string): boolean;
  /**
   * Reports the outcome of a claimed attempt. 'done' closes the pair for good (a successful click,
   * or an error that is not worth hammering). 'miss' means the element could not be located this
   * time (an intermittent interstitial, a not-yet-rendered target): it is released for a later
   * retry, until the attempt budget runs out, after which it too becomes 'done'.
   */
  release(stateId: string, elId: string, outcome: 'done' | 'miss'): void;
  /** True once the pair is closed (clicked or given up): used to skip it and to retire a state. */
  isDone(stateId: string, elId: string): boolean;
  /** True if the pair can be claimed right now (never tried, or missed but not yet out of budget). */
  isClaimable(stateId: string, elId: string): boolean;
}
export interface IStateGraph {
  addEdge(from: string, a: Action, to: string): void;
  edgeCount(): number;
  persist(): Promise<void>;
}

/** Points where external code (e.g. a browser extension) observes the exploration. */
export interface IExplorationHooks {
  /** Before the initial state is captured. */
  onStart(page: Page): Promise<void>;
  /**
   * After the last state, even if the exploration was interrupted by an error. `explorationMs` is
   * the wall-clock time DfsExplorer spent clicking around, measured end to end — so AnalysisHooks
   * can log/persist it alongside its own analysis time, which only starts once this fires.
   * `stopReason` says why it ended (RunMetadataHooks persists it); hooks that don't need it ignore it.
   */
  onEnd(page: Page, explorationMs: number, stopReason?: ExplorationStopReason): Promise<void>;
  /** Before each action on `page` (every tab). Must never throw. Used to let the extension record
   * the current page's state before the crawler navigates away. */
  beforeAction?(page: Page): Promise<void>;
  /** After each action, on the resulting `page`. Must never throw. Used to let the extension finish
   * analysing the result before the crawler reloads to the next element. */
  afterAction?(page: Page): Promise<void>;
}
