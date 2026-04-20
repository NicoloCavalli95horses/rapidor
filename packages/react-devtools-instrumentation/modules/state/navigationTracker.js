//===================
// Import
//===================
import { emit, events } from '../../utils/eventBus.js';
import { log, getCurrentDOM } from '../../utils/utils.js';
import { config } from '../../config.js';
import { analyzeHTTP } from '../HTTP/HTTPAnalyzer.js';



//===================
// Class
//===================

export class NavigationTracker {
  constructor() {
    this.HTTPanalyzer = new analyzeHTTP();
    this.lastUri = undefined;
  }

  init() {
    this.addEventListeners();
    this.update(); // URL of the page the user first lands on
    log({ module: 'navigation tracker', msg: 'Init' });
  }



  addEventListeners() {
    const pushState = history.pushState;

    history.pushState = function (state, title, url) {
      pushState.apply(this, arguments);

      window.dispatchEvent(new CustomEvent('urlchange', {
        detail: { state }
      }));
    };

    window.addEventListener('popstate', (event) => {
      window.dispatchEvent(new CustomEvent('urlchange', {
        detail: { state: event.state }
      }));
    });

    window.addEventListener('urlchange', (event) => {
      const state = event.detail?.state;
      if (!state?.ignore) {
        this.update();
      }
    });
  }



  // In SPA, routing changes can occur without HTTP requests being executed. In this scenario:
  // > A routing change (with query parameters) is treated as an independent GET request
  // > The last state snapshot is treated as the server's response for this GET request
  update() {
    const uri = decodeURIComponent(window.location.href);
    if (this.lastUri == uri) { return; }

    if (new URL(uri).searchParams?.size) { // send new HTTP event to analyze only if we have search parameters
      const request = { uri, verb: 'GET' };
      const response = { isClientSide: true, dom: getCurrentDOM() }
      this.HTTPanalyzer.parseHTTP({ request, response });
    }

    emit({ type: events.NAV, payload: uri });
    this.lastUri = uri;
  }
}
