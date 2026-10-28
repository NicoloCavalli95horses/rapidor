//===================
// Import
//===================
import { log, printConfig } from './utils/utils.js';
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
  // DOM handler
  const DOM = new DOMhandler();
  DOM.init();

  // Client bridge
  initClientToBridge();
  
  log({ module: 'index', msg: "Main module loaded" });
  printConfig();

  // Track HTTP messages
  const tracker = new HTTPTracker();
  await tracker.init();

  // Get and save GUI state
  const stateManager = new StateManager();
  await stateManager.init();

  // Connect to framework-specific APIs and listen to component tree changes
  const bridge = new Bridge(stateManager);
  bridge.init();

  // Navigation tracker
  const navTracker = new NavigationTracker(bridge);
  navTracker.init();

  // Listen to HTTP events, search for similar data in other istances of components, generate and evaluate tests
  const analysisManager = new AnalysisManager(stateManager);
  analysisManager.init();
}


(async () => {
  await instrumentationMain();
})();