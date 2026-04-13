//===================
// Import
//===================
import { emit, events } from '../../utils/eventBus.js';
import { log } from '../../utils/utils.js';
import { config } from '../../config.js';
import { analyzeHTTP } from '../HTTP/HTTPAnalyzer.js';



//===================
// Class
//===================

// [TODO] sometimes the route change without an HTTP request being fired
// - the new route may have queryParameters that may be interesting to fuzz
// - we need an independent navigation tracker that saves each new URL
//   and use HTTPAnalyzer to emit an HTTP event that will be then analyzed
// > In Pimsleur, we go from `/MiniLearn` to `/MiniLearn/MiniLesson?id=112...`
export class NavigationTracker {
  constructor() {
    this.HTTPanalyzer = new analyzeHTTP();
  }

  init() {
    this.addEventListeners();
    this.update(); // URL of the page the user first lands on
    log({ module: 'navigation tracker', msg: 'init' });
  }



  addEventListeners() {
    const pushState = history.pushState;

    history.pushState = function () {
      pushState.apply(this, arguments);
      window.dispatchEvent(new Event('urlchange'));
    };

    window.addEventListener('popstate', () => {
      window.dispatchEvent(new Event('urlchange'));
    });

    window.addEventListener('urlchange', () => {
      this.update();
    });
  }



  update() {
    const uri = decodeURIComponent(window.location.href);
    emit({ type: events.NAV, payload: uri });

    // In SPA, routing changes can occur without HTTP requests being executed
    // We treat new URLs as GET requests: the new route may have queryParameters that may be important to fuzz
    this.HTTPanalyzer.parseHTTP({
      request: { uri, verb: 'GET' },
      response: {} // [TODO] if empty, will be filled with the matching state snapshot, ie. the first available graph for the provided URI (if any)
    });
  }
}
