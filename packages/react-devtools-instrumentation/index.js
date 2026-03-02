//===================
// Import
//===================
import { log, showDownloadBtn } from './utils.js';
import { eventBus } from './eventBus.js';
import { Bridge } from './state/bridge.js';
import { StateManager } from './state/stateManager.js';
import { HTTPTracker } from './HTTP/HTTPTracker.js';
import { AnalysisManager } from './analysis/analysisManager.js';



//===================
// Functions
//===================
export async function instrumentationMain() {
  // Download log for further analysis
  showDownloadBtn(document);

  log({ module: 'index', msg: "main module loaded from 'packages/react-devtools-extensions/src/contentScripts/installHook.js'" });

  // Track HTTP messages
  const tracker = new HTTPTracker();
  await tracker.init();

  // Get and save GUI state
  const stateManager = new StateManager();
  await stateManager.init();

  // Connect to framework-specific APIs and listen to component tree changes
  const bridge = new Bridge();
  bridge.init();

  // Listen to HTTP events, search for similar data in other istances of components, generate and evaluate tests
  const analysisManager = new AnalysisManager(stateManager);
  analysisManager.init();
}