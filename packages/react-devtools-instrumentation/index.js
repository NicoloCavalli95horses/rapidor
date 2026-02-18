//===================
// Import
//===================
import { analyzeHTTP } from './HTTPAnalyzer.js';
import { connectToRenderer } from './connectToRenderer.js';
import { StateManager } from './stateManager.js';
import { HTTPTracker } from './HTTPTracker.js';
import { log } from './utils.js';



//===================
// Functions
//===================
export async function instrumentationMain() {
  log('[INFO] main module loaded from "packages/react-devtools-extensions/src/contentScripts/installHook.js"');

  onPostMessage();

  // Track HTTP messages
  const tracker = new HTTPTracker();
  await tracker.init();

  // Connect to framework-specific APIs
  const {rendererInterface} = await connectToRenderer();

  // Get and save GUI state to DB
  const stateManager = new StateManager(rendererInterface);

  window.addEventListener('click', (e) => {
    stateManager.saveGlobalState();
    stateManager.saveComponentState(e);
  });
};



function onPostMessage() {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.origin) { return; }

    if (event.data.type === 'XML_EVENT') {
      log('[HTTP]', event.data);
      analyzeHTTP(event.data.data);
    } else if (event.data.type === 'FETCH_EVENT') {
      log('[HTTP]', event.data);
      analyzeHTTP(event.data.data);
    }
  });
}