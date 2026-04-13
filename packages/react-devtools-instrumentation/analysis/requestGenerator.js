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
  constructor() {
    this.evaluator = new ResponseEvaluator();
    this.pendingRequests = new Map();
    this.HTTPAnalyzer = new analyzeHTTP();
    this.alreadyDone = new Set();
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
    const { httpEvent, results } = event;
    const { request: referenceReq, response: referenceRes, type } = httpEvent; // [TODO] if response is empty, look at the first available graph matching the nav id

    for (const { referenceNode, candidateNodes } of results) {
      for (let i = 0; i < candidateNodes.length; i++) {
        const candidate = candidateNodes[i];
        const node = candidate.node;
        const relations = candidate.relations;
        const request = this.buildRequest({ reference: referenceReq, target: candidate.target });

        if (this.alreadyDone.has(request._requestId)) {
          log({ module: 'request generator', msg: 'new request already sent' });
          continue;
        }

        const response = await this.executeRequest(request, type);
        // [TODO] if response is 40X, and we have query parameters, try using the React routing system
        // > This is the Pimsleur scenario

        const payload = {
          reference: {
            node: referenceNode.node,
            relations: referenceNode.relations,
            request: referenceReq,
            response: httpEvent.response
          },
          candidate: {
            node,
            relations,
            request: await this.serializedReqObj(request),
            response
          }
        }

        emit({ type: events.EVALUATE, payload });
        this.alreadyDone.add(request._requestId);
        await sleep(config.timeBetweenRequests);
      }
    }
  }



  // Returns serialized request object (needed to save to DB)
  async serializedReqObj(request) {
    const headers = {};
    let body = null;

    if (request.headers) {
      for (const [key, value] of request.headers.entries()) {
        headers[key] = value;
      }
    }

    if (!!request.bodyUsed && request.method !== "GET" && request.method !== "HEAD") {
      try {
        body = await request.clone().text();
      } catch (e) {
        body = null;
      }
    }

    return {
      url: request.url,
      method: request.method,
      headers,
      body,
      mode: request.mode,
      credentials: request.credentials,
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      integrity: request.integrity,
      keepalive: request.keepalive,
    };
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
    const JSONBody = this.bodyToJSON(body);

    target.parts.splice(target.index, 0, target.value);
    const path = target.parts.join('').trim();

    const options = {
      method,
      ...(headers && { headers }),
      ...(["POST", "PUT", "PATCH"].includes(method) && body ? { body: JSONBody } : {})
    };

    const request = new Request(path, options);
    request._requestId = crypto.randomUUID(); // this is read by HTTPTracker so we can use its analysis
    return request;
  }



  bodyToJSON(body) {
    try {
      return JSON.stringify(body);
    } catch (e) {
      log({ module: 'request generator', msg: 'Invalid body, fallback to empty JSON', type: 'warning' });
      return "{}";
    }
  }



  // execute the HTTP request, wait for the payload (req, res) from HTTPTRacker
  async executeRequest(request, type) {
    const requestId = request._requestId;
    const self = this;

    return new Promise((resolve) => {
      // register the Promise in order to be resolved later
      self.pendingRequests.set(requestId, resolve);

      if (type === events.FETCH_EVENT) {
        window.fetch(request).catch((err) => {
          self.pendingRequests.delete(requestId);
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