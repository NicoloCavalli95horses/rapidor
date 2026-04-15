//===================
// Import
//===================
import { eventBus, events, emit } from "../../utils/eventBus.js";
import { filter } from 'rxjs/operators';
import { ResponseEvaluator } from "./responseEvaluator.js";
import { log, sleep, getCurrentDOM } from "../../utils/utils.js";
import { config } from "../../config.js";
import { analyzeHTTP } from "../HTTP/HTTPAnalyzer.js";


//===================
// Functions
//===================
export class RequestGenerator {
  constructor() {
    this.evaluator = new ResponseEvaluator();
    this.pendingRequests = new Map();
    this.httpAnalyzer = new analyzeHTTP();
    this.alreadyDone = new Set();

    this.accessedParams = new Set(); // history of query parameters accessed by the AUT

    this.navigationQueue = undefined;
    this.usedQueryParams = new Set();
  }

  init() {
    this.evaluator.init();
    this.detectParamsUsage();

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



  detectParamsUsage() {
    const self = this;
    const origGet = URLSearchParams.prototype.get;

    URLSearchParams.prototype.get = function (key) {
      self.accessedParams.add(key);
      return Reflect.apply(origGet, this, [key]);
    };
  }



  async handleEvent(event) {
    const { httpEvent, results } = event;
    const { request: referenceReq, response: referenceRes, type } = httpEvent; // [TODO] if response is empty, look at the first available graph matching the nav id

    for (const { reference, candidates } of results) {
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const node = candidate.node;
        const relations = candidate.relations;
        const request = this.buildRequest({ reference: referenceReq, target: candidate.target });
        const id = this.httpAnalyzer.getFingerprint(request);

        if (this.alreadyDone.has(id)) {
          log({ module: 'request generator', msg: `Request already done, skipping` });
          continue;
        }

        const payload = {
          reference: {
            node: reference.node,
            relations: reference.relations,
            analysis: { path: reference.path, target: reference.target },
            request: referenceReq,
            response: referenceRes,
          },
          candidate: {
            node,
            relations,
            analysis: { path: candidate.path, target: candidate.target },
            request: await this.serializedReqObj(request),
            response: await this.navigationHandler(request, type),
          }
        }

        emit({ type: events.EVALUATE, payload });
        this.alreadyDone.add(id);
        await sleep(config.timeBetweenRequests);
      }
    }
  }


  // Implicit navigation queue
  // We do not immediatly get the server response, we set up a queue in case we need to manually test new query parameters
  // This function ensures that we do not have overlapping navigations
  async navigationHandler(request, type) {
    if (this.navigationQueue) {
      await this.navigationQueue; // wait for previous navigation to finish
    }

    this.navigationQueue = (async () => {
      try {
        return await this.handleResponse(request, type);
      } finally {
        this.navigationQueue = null;
      }
    })();

    return this.navigationQueue;
  }



  async handleResponse(request, type) {
    const response = await this.executeRequest(request, type);

    // Best scenario: return the server-side response
    if ((response.status >= 200 && response.status < 300) || !config.testClientSideQueryParamsUsage) {
      return response;
    }

    // The server has rejected the request, but the new endpoint may still be valid
    // In the context of a SPA, routing can be handled entirely on the client side
    const result = await this.isUsingQueryParams(request);

    return  {
      isClientSide: true,
      ...result,
    }
  }



  // Returns true if the SPA uses the new query parameters (they are accessed and the DOM changes);
  async isUsingQueryParams(request) {
    const baseUrl = new URL(request.url);
    const originalUrl = window.location.href;
    const params = baseUrl.searchParams;
    let result = {isUsingNewParams: false, hasMutatedDom: false, dom: {}};

    // The length of params is 1 by design (ie, we mutate one segment at the time)
    const entry = params.entries().next().value;
    if (!entry) { return result; }
    const [param, value] = entry;
    const key = `${param}=${value}`;

    if (this.usedQueryParams.has(key)) {
      return result;
    }

    this.accessedParams.clear();

    const testUrl = new URL(baseUrl.toString());
    testUrl.searchParams.set(param, value);
    let state = {};

    try {
      window.history.pushState({ ignore: true }, "", testUrl);
      window.dispatchEvent(new Event("popstate"));
      state = await this.waitDOMIdle();
    } finally { // rollback
      window.history.pushState({ ignore: true }, "", originalUrl);
      window.dispatchEvent(new Event("popstate"));
    }

    result = {
      ...result,
      ...state,
      isUsingNewParams: (this.accessedParams.has(param) && state.hasMutatedDom) ? true : false,
    };
  
    this.usedQueryParams.add(key);

    return result;
  }



  // Wait for the DOM to stabilize (idle), return true if there are DOM changes, wait at least 500ms
  waitDOMIdle({ minWait = 500, idleTime = 100 } = {}) {
    return new Promise((resolve) => {
      let hasMutatedDom = false;
      let lastChange = Date.now();
      const start = Date.now();

      const obs = new MutationObserver(() => {
        hasMutatedDom = true;
        lastChange = Date.now();
      });

      obs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });

      const check = () => {
        const now = Date.now();
        const waitedEnough = now - start >= minWait;
        const isStable = now - lastChange >= idleTime;

        if (waitedEnough && isStable) {
          obs.disconnect();
          resolve({hasMutatedDom, dom: getCurrentDOM()});
        } else {
          requestAnimationFrame(check);
        }
      };

      check();
    });
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

    if (!!request.bodyUsed && !["GET", "HEAD"].includes(request.method)) {
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