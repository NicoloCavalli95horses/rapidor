// This runs as content script, ie. in the context of the current web page

//==============================
// Import
//==============================
import { log, deepObjCopy } from '../utils.js';
import { analyzeHTTP } from './HTTPAnalyzer.js';



export class HTTPTracker {
  constructor() {
    this.analyzer = new analyzeHTTP();
  }

  static TYPES = {
    FETCH: "FETCH_EVENT",
    XML: "XML_EVENT"
  }



  async init() {
    this.analyzer.init();

    await this.captureXMLHttpRequest();
    await this.captureFetchRequest();
    log({ module: 'HTTP tracker', msg: 'HTTP tracker initialized' });
  }



  captureXMLHttpRequest() {
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;
    const setRequestHeader = XHR.setRequestHeader;

    // Override open to capture method and URL
    XHR.open = function (method, url) {
      this._method = method;
      this._url = url;
      this._requestHeaders = {};
      return open.apply(this, arguments);
    };

    // Override setRequestHeader to capture headers
    XHR.setRequestHeader = function (header, value) {
      this._requestHeaders[header] = value;
      return setRequestHeader.apply(this, arguments);
    };

    const self = this;

    // Centralized function to build request object
    const buildRequest = function (data) {
      const uri = decodeURIComponent(this._url);

      return {
        uri: uri,
        verb: this._method,
        headers: this._requestHeaders,
        body: self.getRequestBody({ data, headers: this._requestHeaders }),
        _requestId: this._requestId // from requestGenerator
      };
    };

    // Override send to handle response and errors
    XHR.send = async function (data) {
      const handleResponse = async (_) => {
        const request = buildRequest.call(this, data); // Use request builder
        const responseText = await self.getXHResponseText(this);
        const response = {
          status: this.status,
          headers: this.getAllResponseHeaders(),
          ...await self.getResponseBody({
            data: responseText,
            type: this.getResponseHeader("Content-Type")
          }),
        };

        self.analyzer.parseHTTP({ type: HTTPTracker.TYPES.XML, request, response });
      };

      this.addEventListener('load', handleResponse); // successful response
      this.addEventListener('error', handleResponse); // error
      this.addEventListener('timeout', handleResponse); // timeout

      return send.apply(this, arguments);
    };
  }



  async getXHResponseText(data) {
    if (['json', 'document', 'formdata'].includes(data.responseType)) {
      return data.response;
    }

    if (['text', ''].includes(data.responseType)) {
      return data.responseText;
    }

    if (data.responseType === 'blob') {
      return await new Response(data.response).text() // blob object
    }

    if (data.responseType === 'arraybuffer') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data.response);
    }
  }



  async getResponseBody({ data, type }) {
    const contentType = (type || '').toLowerCase();

    const ret = {
      body: data || {},
      rawBody: {}, //unparsed
      type: 'unknown',
      rawType: contentType, //unparsed
      error: {},
    };

    if (!data) {
      return ret;
    }


    try {
      // JSON
      if (contentType.includes('json')) {
        if (data instanceof Response) { // is a fetch response
          ret.body = await data.clone().json();
        } else if (typeof data === 'string') {
          ret.body = JSON.parse(data); // XMLHttpRequest case
        } else if (typeof data === 'object') {
          ret.body = data;
        }
        ret.type = "json";
        return ret;
      }

      // Text
      if (contentType.startsWith('text/') || ['javascript', 'xml', 'html'].includes(contentType)) {
        if (data instanceof Response) {
          ret.body = await data.clone().text();
        } else {
          ret.body = String(data);
        }
        ret.type = 'text';
        return ret;
      }

      // Blob / unknown
      if (data instanceof Response) {
        ret.body = await data.clone().arrayBuffer();
      } else {
        ret.body = data;
      }
      ret.type = 'blob';
      return ret;
    } catch (error) {
      ret.error = error;
      ret.rawBody = data;
      log({ module: 'HTTP tracker', type: 'error', msg: `Error parsing HTTP response body: ${error}.\nRaw response type: ${contentType}.\nRaw data: ${data}` });
    }

    return ret;
  }



  getRequestBody({ data, headers }) {
    if (!data) { return; }
    const contentType = headers['content-type']?.toLowerCase();

    if (typeof data === 'object') {
      return data;
    }

    if (typeof data === 'string' && contentType?.includes('application/json')) {
      try {
        return JSON.parse(data);
      } catch (err) {
        return data;
      }
    }

    return data;
  }



  async captureFetchRequest() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (...args) {
      // Normalize the request object: this allows us to read `_requestId` from requestGenerator
      const originalRequest = args[0] instanceof Request ? args[0] : new Request(...args);
      const _requestId = originalRequest._requestId || crypto.randomUUID();

      try {
        const res = await originalFetch.apply(this, args);
        const _res = res.clone();

        const verb = originalRequest.method || 'GET';
        const headers = {};
        originalRequest.headers?.forEach((v, k) => { headers[k] = v; });


        let body = {};

        try {
          const text = await originalRequest.clone().text();
          body = text ? JSON.parse(text) : undefined;
        } catch {
          body = await originalRequest.clone().text();
        }

        const request = {
          uri: originalRequest.url,
          verb,
          headers,
          body: self.getRequestBody({ data: body, headers }),
          _requestId
        };

        const response = {
          status: _res?.status,
          ...await self.getFetchResponseHeaders(_res?.headers),
          ...await self.getResponseBody({ data: _res, type: _res.headers.get('Content-Type') })
        };
        self.analyzer.parseHTTP({ type: HTTPTracker.TYPES.FETCH, request, response });
        return res;

      } catch (error) {
        throw error;
      }
    }
  }



  async getFetchResponseHeaders(data) {
    const ret = {};
    data.forEach((value, name) => ret[name] = value);
    return ret;
  }
}