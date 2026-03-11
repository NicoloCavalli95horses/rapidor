//===================
// Import
//===================
import { eventBus, events, emit } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { ResponseEvaluator } from "./responseEvaluator.js";
import { log, sleep } from "../utils.js";
import { config } from "../config.js";



//===================
// Functions
//===================
export class RequestGenerator {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.evaluator = new ResponseEvaluator();
    this.pendingRequests = new Map();
  }

  init() {
    this.evaluator.init();

    eventBus.subscribe(e => {
      switch (e.type) {
        case events.GEN_REQ:
          this.handleEvent(e.payload);
          break;
        case events.HTTP_EVENT:
          this.handleTracked(e.payload);
          break;
      }
    });
  }



  async handleEvent(event) {
    const { matchingSets, http } = event;
    const { request: referenceReq, response: referenceRes, type } = http;
    log({ module: 'request generator', msg: 'received matches, building requests...' });
    const self = this;

    for (const { referenceNode, siblingNodes } of matchingSets) {
      const originalPath = referenceNode.match;

      for (let i = 0; i < siblingNodes.length; i++) {
        const node = siblingNodes[i];
        if (node.isOriginalMatch) { return; } // do not replay the original

        const request = self.buildRequest({ reference: referenceReq, originalPath, newPath: node.match });
        const response = await self.executeRequest(request, type);

        const payload = {
          reference: {
            node: referenceNode,
            request: http.request,
            response: http.response
          },
          candidate: {
            node,
            request,
            response
          }
        }

        emit({ type: events.EVALUATE, payload });
        await sleep(config.timeBetweenRequests);
      }
    }
  }



  handleTracked(event) {
    const { request, response } = event;
    const _requestId = request._requestId;
    const resolver = this.pendingRequests.get(_requestId);

    if (!resolver) { return; }
    resolver(response);
    this.pendingRequests.delete(_requestId);
  }



  // build new request object given reference HTTP request
  buildRequest({ reference, originalPath, newPath }) {
    const { uri, body, headers, verb } = reference;
    const method = verb.toUpperCase();
    const path = uri.replace(originalPath, newPath);

    const options = {
      method,
      ...(headers && { headers }),
      ...(["POST", "PUT", "PATCH"].includes(method) && body ? { body } : {})
    };

    const request = new Request(path, options);
    request._requestId = crypto.randomUUID(); // this is read by HTTPTracker so we can use its analysis
    return request;
  }



  // execute the HTTP request, wait for the payload (req, res) from HTTPTRacker
  async executeRequest(request, type) {
    const requestId = request._requestId;
    const self = this;

    return new Promise((resolve) => {
      // register the Promise in order to be resolved later
      this.pendingRequests.set(requestId, resolve);

      if (type === events.FETCH_EVENT) {
        window.fetch(request).catch((err) => {
          this.pendingRequests.delete(requestId);
          resolve({ error: err });
        });
      } else if (type === events.XML_EVENT) {
        // [TODO] to test properly
        const xhr = new XMLHttpRequest();
        xhr._requestId = request._requestId;
        xhr.open(request.method, request.url);
        request.headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });
        xhr.send(request.body);
      }
    });
  }
}