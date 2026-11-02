//===================
// Import
//===================
import { sleep } from '../../utils/utils.js';



//===================
// Class
//===================
/**
 * Tracks how much analysis work is in flight across the pipeline (match loop -> request generation
 * -> response evaluation), so a crawler can wait until RAPIDOR has finished analysing the current
 * page before it navigates away. Each stage wraps its async work with track(); whenIdle() resolves
 * once nothing has been in flight for a short quiet window.
 *
 * The three stages chain synchronously (startAnalysis emit GEN_REQ emit EVALUATE), and each
 * subscriber calls begin() synchronously inside that emit, so the counter never briefly drops to 0
 * between stages.
 */
export class AnalysisActivity {
  constructor() {
    this.inFlight = 0;
    this.lastChange = Date.now();
  }

  begin() {
    this.inFlight++;
    this.lastChange = Date.now();
  }

  end() {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.lastChange = Date.now();
  }

  // Counts `promise` as in-flight analysis work until it settles.
  track(promise) {
    this.begin();
    return Promise.resolve(promise).finally(() => this.end());
  }

  // Resolves true once nothing has been in flight for `quietMs`, or false if `timeoutMs` elapses
  // first (a page whose analysis never settles must not stall the crawler forever).
  async whenIdle({ quietMs = 400, timeoutMs = 8000, pollMs = 50 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (this.inFlight === 0 && Date.now() - this.lastChange >= quietMs) { return true; }
      if (Date.now() >= deadline) { return false; }
      await sleep(pollMs);
    }
  }
}

// Single instance shared by every analysis stage and by the bridge's waitForAnalysis().
export const analysisActivity = new AnalysisActivity();
