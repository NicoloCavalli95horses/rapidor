//===================
// Import
//===================
import { eventBus, events, emit } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { ResponseEvaluator } from "./responseEvaluator.js";
import { log, sleep } from "../utils.js";

//===================
// Functions
//===================
export class RequestGenerator {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.evaluator = new ResponseEvaluator();
  }

  init() {
    this.evaluator.init();

    eventBus
      .pipe(filter(e => e.type === events.GEN_REQ))
      .subscribe(e => this.handleEvent(e.payload));
  }



  async handleEvent(event) {
    const { matchingSets, http } = event;
    const { request: referenceReq, response: referenceRes } = http;
    log({ module: 'request generator', msg: 'received matches, building requests...' });
    const self = this;

    matchingSets.forEach(async (set) => {
      set.forEach(async (node) => {
        // if (node.isOriginalMatch) { return; }

        const request = self.buildRequest(referenceReq, node.match);
        const response = await self.executeRequest(request);

        const payload = {
          node,
          referenceHttp: http,
          newHttp: { request, response }
        }

        emit({ type: events.EVALUATE, payload });
        sleep(200);
      });
    });
  }



  // build new request object given reference HTTP request
  buildRequest(request, value) {
    const method = request.verb.toUpperCase();
    const path = (this.removeLastSegment(request.uri) + '/' + value).toString();
    const options = {
      method,
      ...(request.headers && { headers: request.headers }),
      ...(["POST", "PUT", "PATCH"].includes(method) && request.body ? { body: request.body } : {})
    };

    return { path, options };
  }



  async executeRequest(request) {
    // flag the request in order not to process it as a regular HTTP event
    emit({ type: events.GEN_HTTP_EVENT_FLAG, payload: request.path });
    return await this.fetchRequest(request);
  }



  removeLastSegment(endpoint) {
    const url = new URL(endpoint);
    const segments = url.pathname.split('/').filter(Boolean);
    segments.pop();
    url.pathname = '/' + segments.join('/');
    return url.toString();
  }



  async fetchRequest({ path, options }) {
    try {
      const response = await fetch(path, options);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      log({ module: 'request generator', type: 'error', msg: `Request ${path} failed with ${error.message}` });
    }
  }
}