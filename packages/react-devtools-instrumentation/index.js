//===================
// Import
//===================
import { log, printConfig, exposeGlobalAPI, captureRuntimeErrors } from './utils/utils.js';
import { config } from './config.js';
import { Bridge } from './modules/state/bridge.js';
import { StateManager } from './modules/state/stateManager.js';
import { HTTPTracker } from './modules/HTTP/HTTPTracker.js';
import { AnalysisManager } from './modules/analysis/analysisManager.js';
import { DOMhandler } from './modules/DOM/DOMhandler.js';
import { NavigationTracker } from "./modules/state/navigationTracker.js";
import { initClientToBridge } from './utils/clientToBridge.js';


//===================
// Functions
//===================
export async function instrumentationMain() {
  // Record runtime errors into the logs so a crawler sees them via __RAPIDOR__getData (which returns
  // { logs, stats }); installed first so failures during init are captured too.
  captureRuntimeErrors();

  // Public API for an external crawler to pull logs/stats "from below" (page.evaluate), as early as possible
  exposeGlobalAPI();

  // DOM handler (floating "Download logs"/"Print stats" buttons), fully opt-in
  if (config.domHandlerEnabled) {
    const DOM = new DOMhandler();
    DOM.init();
  }

  // Client bridge
  initClientToBridge();
  
  log({ module: 'index', msg: "Main module loaded" });
  printConfig();

  // Track HTTP messages ('minimal' mode only emits React state: no HTTP tracking/analysis)
  if (config.mode !== 'minimal') {
    const tracker = new HTTPTracker();
    await tracker.init();
  }

  // Get and save GUI state
  const stateManager = new StateManager();
  await stateManager.init();

  // Connect to framework-specific APIs and listen to component tree changes
  const bridge = new Bridge(stateManager);
  bridge.init();

  // Crawler-facing controls, exposed here (after the DB and bridge are ready) rather than in
  // exposeGlobalAPI(), which runs before initialisation:
  //  - reset(): wipe the shared IndexedDB once at the start of a run (it is no longer reset on page
  //    load, so it survives reloads and is shared across tabs).
  //  - waitToAction(): resolves true once the current page has at least one captured state in the
  //    DB, so the crawler does not navigate away before RAPIDOR has recorded it.
  //  - waitForAnalysis(): resolves once the analysis pipeline has gone idle, so the crawler lets
  //    RAPIDOR finish analysing a clicked result before it reloads to the next element.
  //  - getLatestState(): returns the most recently captured state graph (kept in memory by Bridge
  //    regardless of mode), so a crawler can pull it "from below" right after the handshakes above.
  if (typeof window !== 'undefined') {
    window.__RAPIDOR__reset = () => stateManager.reset();
    window.__RAPIDOR__waitToAction = (opts) => bridge.waitToAction(opts);
    window.__RAPIDOR__waitForAnalysis = (opts) => bridge.waitForAnalysis(opts);
    window.__RAPIDOR__getLatestState = () => bridge.getLastState();
  }

  // 'minimal' mode stops here: Bridge+StateManager already emit React state on their own.
  if (config.mode !== 'minimal') {
    // Navigation tracker
    const navTracker = new NavigationTracker(bridge);
    navTracker.init();

    // Listen to HTTP events, search for similar data in other istances of components, generate and evaluate tests
    const analysisManager = new AnalysisManager(stateManager);
    analysisManager.init();
  }
}


(async () => {
  await instrumentationMain();
})();