import { log } from 'crawlee';
import type { Page } from 'playwright';
import type { IExplorationHooks } from '../core/interfaces';
import type { ExplorationStopReason } from '../core/types';
import type { CrawlConfig } from '../config';
import type { RunMetadataStore } from '../db/RunMetadataStore';

/**
 * The config to persist: the effective one (env overrides applied), minus what is not a parameter of the
 * crawl or must not travel with the DB (published on Zenodo): the local profile path and the other sites.
 */
export function runConfigSnapshot(cfg: CrawlConfig): string {
  const { userDataDir: _profile, startUrl: _url, startUrls: _urls, ...rest } = cfg;
  return JSON.stringify(rest);
}

/** Writes the site's run_metadata row at the end of the exploration, before the analysis hooks run. */
export class RunMetadataHooks implements IExplorationHooks {
  private startedAt = new Date();

  constructor(
    private store: RunMetadataStore,
    private run: { site: string; startUrl: string; config: CrawlConfig },   // startUrl: the seed as given
  ) {}

  async onStart(): Promise<void> {
    this.startedAt = new Date();
  }

  async onEnd(_page: Page, explorationMs: number, stopReason: ExplorationStopReason = 'completed'): Promise<void> {
    // metadata must never cost the analysis that follows
    try {
      this.store.record({
        site: this.run.site, startUrl: this.run.startUrl,
        startedAt: this.startedAt.toISOString(), endedAt: new Date().toISOString(),
        explorationMs, stopReason, config: runConfigSnapshot(this.run.config),
      });
    } catch (err) {
      log.warning(`run_metadata not recorded for ${this.run.site}: ${(err as Error).message}`);
    }
  }
}
