//===================
// Import
//===================
import { emit, eventBus, events } from '../eventBus.js';
import { log } from '../utils.js';
import { config } from '../config.js';



//===================
// Const
//===================
const FILE_MIME_HINTS = [
  'json',
  'blob',
  'text',
  'image',
  'audio',
  'video',
  'pdf',
  'zip',
  'arraybuffer',
  'application',
  'octet-stream',
];


const FILE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'zip', 'rar', '7z',
  'mp4', 'mp3', 'avi',
  'css', 'js', 'json', 'xml', 'html',
  'woff', 'woff2', 'ttf', 'eot',
];


//===================
// Functions
//===================
export class analyzeHTTP {
  constructor() {
  }

  init() {
  }



  parseHTTP({ type = events.FETCH_EVENT, request, response }) {
    if (!request) { return; } // response can be empty. In this case it will be filled with the first available graph matching the endpoint
    const uri = this.getURI(request?.uri);
    if (!uri) { return; }
    if (!this.isAllowed(uri)) { return; }

    // full path (hostname + port + protocol, more robust if we then will have to generate a cross-origin request)
    const fullPath = decodeURIComponent(uri.origin + uri.pathname); // path name can be encoded
    const property = this.getProperty(fullPath);
    const fingerprint = this.getFingerprint(fullPath, request.verb);

    // query parameters
    const rawQueries = uri.search; // ?page=1order=asc...
    const params = this.searchParamsToObj(uri.searchParams); // { page:1,order:'asc' }
    const queryParams = params ? this.getParamsAnalysis(params, fullPath, property.value) : undefined;

    const analysis = {
      fullPath,
      rawQueries,
      toEvaluate: [property, ...queryParams]
    }

    emit({
      type: events.HTTP_EVENT, payload: {
        type,
        request: { ...request, analysis },
        response,
        doneOn: new Set(),
        ignore: request._requestId ? 1 : 0, // apparently, booleans are not valid keys in indexedDB https://stackoverflow.com/questions/13672906/indexeddb-boolean-index
        fingerprint,
      }
    });
  }



  // [TODO] design a system that infers the part to be fuzzed
  // by comparing past requests and checking the part that changes
  // > In Busuu, we have `/api/.../id1` and `api/.../id2`
  // > In Memrise, we have `/api/.../grammar/chat` and `/api/.../role-play/chat`
  getProperty(fullPath) {
    let parts;
    let value;
    let ext;

    const url = new URL(fullPath);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments.pop();
    if (!last) { return { parts, value, index: 1 } };

    const lastDot = last.lastIndexOf('.');
    const hasExt = lastDot > 0;


    if (!hasExt) {
      value = last;
      ext = '';
    } else {
      value = last.slice(0, lastDot);
      ext = last.slice(lastDot); // include "."
    }

    const basePath = '/' + (segments.length ? segments.join('/') + '/' : '');
    parts = [(url.origin + basePath), ext];

    return { parts, value, index: 1 };
  }



  getParamsAnalysis(params, fullPath, filterVal) {
    const result = [];
    for (const [key, value] of Object.entries(params)) {
      if (['true', 'false', filterVal].includes(value)) { continue; }
      const parts = [`${fullPath}?${key}=`];
      result.push({ parts, value, index: 1 });
    }
    return result;
  }



  getFingerprint(fullPath, method) {
    return `${method.toLowerCase()}:${fullPath}`;
  }



  getExtension(fullPath) {
    const segments = fullPath.split('/').filter(Boolean);
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) { return; }
    return filename.slice(lastDot).toLowerCase(); // with the dot
  }



  // we accept the same domain and all its subdomains
  isAllowed(uri) {
    if (!config.domainRequestOnly) { return true; }
    const receivedHost = new URL(uri).hostname;
    const currentHost = window.location.hostname;
    const baseDomain = this.getBaseDomain(currentHost);
    const toKeep = (receivedHost === baseDomain) || receivedHost.endsWith(`.${baseDomain}`);
    // console.log({ receivedHost, currentHost, baseDomain, toKeep });

    return toKeep;
  }



  getBaseDomain(hostname) {
    const parts = hostname.split('.');
    return parts.slice(-2).join('.');
  }



  getURI(uri) {
    if (!uri) { return; }

    try {
      return new URL(uri, window?.location?.href);
    } catch (e) {
      return;
    }
  }



  searchParamsToObj(searchParams) {
    const paramsMap = Array.from(searchParams).reduce((params, [key, val]) => params.set(key, val), new Map());
    return Object.fromEntries(paramsMap);
  }
}