//===================
// Import
//===================
import { emit, events } from '../eventBus.js';
import { log } from '../utils.js';
import { config } from '../config.js';



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
    const url = decodeURIComponent(window.location.href);
    emit({ type: events.NAV, payload: url });
  }
}
