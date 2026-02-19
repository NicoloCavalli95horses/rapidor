//===================
// Import
//===================
import { log } from './utils.js';
import { analyzeHTTP } from './HTTPManager/HTTPAnalyzer.js';
import { StateManager } from './stateManager/stateManager.js';
import { HTTPTracker } from './HTTPManager/HTTPTracker.js';
import { eventBus } from './eventBus.js';
import { TestGenerator } from './testGenerator/testGenerator.js';
import { Bridge } from './stateManager/bridge.js';

//===================
// Functions
//===================
export async function instrumentationMain() {
  log('[INFO] main module loaded from "packages/react-devtools-extensions/src/contentScripts/installHook.js"');

  debug();

  // Track HTTP messages
  const tracker = new HTTPTracker();
  await tracker.init();

  // Get and save GUI state
  const stateManager = new StateManager();
  stateManager.init();

  // Connect to framework-specific APIs and listen to component tree changes
  const bridge = new Bridge();
  bridge.init();

  // Listen to HTTP events, search for similar data in other istances of components, generate and evaluate tests
  const testGenerator = new TestGenerator();
  testGenerator.init();
};


function debug() {
  eventBus.subscribe(e => {
    switch (e.type) {
      case 'STATE_UPDATE':
        log('[DEBUG] state update:', e.payload);
        break;

      case 'HTTP_EVENT':
        log('[DEBUG] HTTP request event received', e.payload);
        break;

      default:
        log('[DEBUG] Unknown event type', e.type);
    }
  });
}