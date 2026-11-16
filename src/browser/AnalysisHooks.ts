import type { Page } from 'playwright';
import { log } from 'crawlee';
import type { IExplorationHooks } from '../core/interfaces';
import type { AnalysisPipeline } from '../analysis/AnalysisPipeline';
import { exportSiteToDemoDb } from '../db/demoExport';

/** Runs the analysis pipeline once, at the end of a site's exploration, on the still-open main page. */
export class AnalysisHooks implements IExplorationHooks {
  constructor(
    private pipeline: AnalysisPipeline,
    private site: string,
    // When set (config.db.exportDemoAfterRun), refresh the HTTP-only demo snapshot for this site right
    // after its analysis — same effect as running scripts/buildDemo.ts for it. See src/db/demoExport.ts.
    private demoExport?: { sourceDbPath: string; destDbPath: string },
  ) {}

  async onStart(): Promise<void> {}

  async onEnd(page: Page, explorationMs: number): Promise<void> {
    try {
      await this.pipeline.runForSite({ page, site: this.site, explorationMs });
    } catch (err) {
      log.warning(`AnalysisPipeline failed: ${(err as Error).message}`);
    }
    if (this.demoExport) {
      try {
        const { counts } = exportSiteToDemoDb({ ...this.demoExport, site: this.site });
        log.info(`Demo snapshot refreshed for ${this.site} at ${this.demoExport.destDbPath} (${counts.forged_requests} forged responses cached)`);
      } catch (err) {
        log.warning(`Demo export failed for ${this.site}: ${(err as Error).message}`);
      }
    }
  }
}
