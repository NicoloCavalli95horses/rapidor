import type { Rect } from './geometry';

export interface ElementDescriptor {
  id: string;          // hash of tag + rounded rectangle (+ normalized text, if enabled)
  selector: string;    // structural CSS path, without ids or classes
  tag: string;
  rect: Rect;          // document coordinates (viewport if the element is fixed)
  fixed: boolean;      // true if the element or an ancestor has position: fixed
  text?: string;
  role?: string;
  href?: string;
}
export interface Action { type: 'click'; target: ElementDescriptor }

/** Why an exploration ended: frontier exhausted, a limit (per-tab maxStates / maxDurationSecs), or a failure. */
export type ExplorationStopReason = 'completed' | 'max-states' | 'max-duration' | 'error';

/** Snapshot of the page at a given moment: what is needed to identify the state. */
export interface Snapshot {
  id: string;
  url: string;
  clickables: ElementDescriptor[];
  texts: string[];     // visible text blocks, as they appear
}

export interface UIState extends Snapshot {
  depth: number;
  path: Action[];      // actions from the root: used for restoring
}

/** What gets persisted for each state. */
export interface StateRecord {
  id: string;
  url: string;
  depth: number;
  path: { type: Action['type']; targetId: string; text?: string }[];
  clickables: ElementDescriptor[];
  texts: string[];
}

/** A click edge in the state graph. */
export interface Edge {
  from: string;
  to: string;
  action: { type: Action['type']; targetId: string; text?: string; selector: string };
}
