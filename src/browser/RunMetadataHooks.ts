import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from 'crawlee';
import type { Page } from 'playwright';
import type { IExplorationHooks } from '../core/interfaces';
import type { ExplorationStopReason } from '../core/types';
import type { CrawlConfig } from '../config';
import type { RunMetadataStore } from '../db/RunMetadataStore';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** HEAD of this repo, suffixed `-dirty` when tracked files have local changes; null when git is unavailable. */
export function gitRevision(): string | null {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    return dirty ? `${head}-dirty` : head;
  } catch {
    return null;
  }
}

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
    private run: { site: string; startUrl: string; config: CrawlConfig },
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
        explorationMs, stopReason, gitCommit: gitRevision(), config: runConfigSnapshot(this.run.config),
      });
    } catch (err) {
      log.warning(`run_metadata not recorded for ${this.run.site}: ${(err as Error).message}`);
    }
  }
}
