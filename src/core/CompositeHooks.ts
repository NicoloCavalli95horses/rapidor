import type { Page } from 'playwright';
import type { IExplorationHooks } from './interfaces';
import type { ExplorationStopReason } from './types';

/** Runs several hooks as one, in order. Lets buildExplorer wire more than one IExplorationHooks. */
export class CompositeHooks implements IExplorationHooks {
  constructor(private hooks: IExplorationHooks[]) {}

  async onStart(page: Page): Promise<void> {
    for (const h of this.hooks) await h.onStart(page);
  }

  async onEnd(page: Page, explorationMs: number, stopReason?: ExplorationStopReason): Promise<void> {
    for (const h of this.hooks) await h.onEnd(page, explorationMs, stopReason);
  }

  async beforeAction(page: Page): Promise<void> {
    for (const h of this.hooks) await h.beforeAction?.(page);
  }

  async afterAction(page: Page): Promise<void> {
    for (const h of this.hooks) await h.afterAction?.(page);
  }
}
