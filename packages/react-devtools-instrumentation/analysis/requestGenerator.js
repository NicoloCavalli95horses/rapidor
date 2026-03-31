//===================
// Import
//===================
import { eventBus, events, emit } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { ResponseEvaluator } from "./responseEvaluator.js";
import { log, sleep } from "../utils.js";
import { config } from "../config.js";
import { analyzeHTTP } from "../HTTP/HTTPAnalyzer.js";


//===================
// Functions
//===================
export class RequestGenerator {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.evaluator = new ResponseEvaluator();
    this.pendingRequests = new Map();
    this.HTTPAnalyzer = new analyzeHTTP();
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
    const { http, results } = event;
    const { request: referenceReq, response: referenceRes, type } = http; // [TODO] if response is empty, look at the first available graph matching the nav id
    log({ module: 'request generator', msg: 'received matches, building requests...' });
    const self = this;

    for (const { referenceNode, candidateNodes } of results) {
      for (let i = 0; i < candidateNodes.length; i++) {
        const candidate = candidateNodes[i];
        const node = candidate.node;
        const request = self.buildRequest({ reference: referenceReq, target: candidate.target });

        if (await self.alreadyDone(request)) {
          log({ module: 'request generator', msg: 'new request already sent' });
          continue;
        }
        const response = await self.executeRequest(request, type);
        // [TODO] if response is 40X, and we have query parameters, try using the React routing system
        // > This is the Pimsleur scenario

        const payload = {
          reference: {
            node: referenceNode.node,
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



  async alreadyDone(request) {
    const uri = this.HTTPAnalyzer.getURI(request.url);
    const method = request.method;
    const fullPath = decodeURIComponent(uri.href);
    const fingerprint = this.HTTPAnalyzer.getFingerprint(fullPath, method);
    const res = await this.stateManager.hasAlreadyDoneRequest(fingerprint);
    return res;
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
  buildRequest({ reference, target }) {
    const { uri, body, headers, verb, analysis } = reference;
    const method = verb.toUpperCase();

    target.parts.splice(target.index, 0, target.value);
    const path = target.parts.join('').trim();

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