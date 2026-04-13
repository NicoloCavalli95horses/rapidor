// [INFO]
// This runs as background script (web worker)
// Does not have access to the same IndexedDB instance as the main thread
// Can communicate to the MAIN world via the backgroundToMainBridge.js

//===================
// Import
//===================
import { config } from "../../../react-devtools-instrumentation/config.js";
import { events } from "../../../react-devtools-instrumentation/utils/eventBus.js";



//===================
// Class
//===================
export class ServiceWorker {
  constructor() {
  }

  init() {
  }
}