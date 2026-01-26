//==============================
// Import
//==============================
import {
  log,
  deepObjCopy,
  sendPostMessage,
} from './utils.js';


export class trackHTTPRequests {
  constructor() {
  }

  async init() {
    await this.captureXMLHttpRequest();
    await this.captureFetchRequest();
    log('HTTP tracker initialized');
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
        body: self.getRequestBody(data)
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

        sendPostMessage({ type: 'XML_EVENT', data: { request, response } });
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
    const ret = {
      body: data || {},
      is_json: false,
      is_text: false,
      is_blob: false,
    };

    if (!data) {
      return ret;
    }

    // Type can appear in uppercase or camelCase
    type = (type || '').toLowerCase();

    try {
      if (type.includes('json')) {
        // Fetch API has its own .json() variant
        ret.body = (typeof data.json === 'function') ? await data.json() : JSON.parse(data);
        ret.is_json = true;
      } else if (type.startsWith('text/')) {
        // Data can be a string already
        ret.body = (typeof data.text === 'function') ? await data.text() : String(data);
        ret.is_text = true;
      } else {
        // Data can be already parsed
        ret.body = (typeof data.blob === 'function') ? await data.blob() : data;
        ret.is_blob = true;
      }
    } catch (error) {
      log(`Error parsing response of type "${type}":`, error);
    }

    return ret;
  }

  getRequestBody(data) {
    if (!data) { return; }
    if (["object", "number", "boolean"].includes(typeof data) || Array.isArray(data)) { return data; }
    if (["string"].includes(typeof data)) {
      try {
        return JSON.parse(data);
      } catch (error) {
        log(`Error parsing request body`, error);
        return data;
      }
    }
  }

  async captureFetchRequest() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (...args) {
      try {
        const res = await originalFetch.apply(this, args);
        const _res = res.clone();

        const request = {
          uri: decodeURIComponent(args[0]),
          verb: args[1]?.method,
          headers: args[1]?.headers,
          body: self.getRequestBody(args[1]?.body),
        };

        const response = {
          status: _res?.status,
          ...await self.getFetchResponseHeaders(_res?.headers),
          ...await self.getResponseBody({
            data: _res,
            type: _res.headers.get('Content-Type')
          })
        };

        sendPostMessage({ type: 'FETCH_EVENT', data: { request, response } });
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