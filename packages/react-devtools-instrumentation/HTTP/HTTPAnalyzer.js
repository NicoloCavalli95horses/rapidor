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
  'blob',
  'arraybuffer',
  'image/',
  'audio/',
  'video/',
  'application/pdf',
  'application/octet-stream',
  'application/zip'
];


//===================
// Functions
//===================
export class analyzeHTTP {
  constructor() {
  }

  init() {
  }



  parseHTTP({ type, request, response }) {
    if (!response || !request) { return; }

    const uri = this.getURI(request?.uri);
    if (!uri) { return; }
    if (!this.isAllowed(uri)) { return; }

    const contentType = response.type || response.rawType;
    const isFileByMime = FILE_MIME_HINTS.some(t => contentType.includes(t));

    const protocol = uri.protocol;
    const port = uri.port;
    const rawQueries = uri.search; // ?page=1order=asc...
    const params = this.searchParamsToObj(uri.searchParams); // { page:1,order:'asc' }
    const hostname = uri.hostname;
    const fullPath = decodeURIComponent(uri.pathname); // path name can be encoded
    const segments = fullPath.split('/').filter(Boolean);
    let property = segments.slice(-1).pop();
    const extension = this.getExtension(property);

    if (extension) {
      property = property.split('.')[0];
    }

    // [TODO] `property` is the last part of the URL by default
    // However, sometimes this is not the part we need to fuzz
    // would be nice to design a system that infers the part to be fuzzed
    // by comparing past requests and checking the part that changes
    // > In Busuu, we have `/api/.../id1` and `api/.../id2`
    // > In Memrise, we have `/api/.../grammar/chat` and `/api/.../role-play/chat`

    const meta = {
      protocol,
      port,
      rawQueries,
      params,
      hostname,
      isFileByMime,
      path: { fullPath, segments, property, extension },
    }

    emit({
      type: events.HTTP_EVENT, payload: {
        type,
        request: { ...request, meta },
        response,
        doneOn: new Set(),
        ignore: request._requestId ? 1 : 0, // apparently, booleans are not valid keys in indexedDB https://stackoverflow.com/questions/13672906/indexeddb-boolean-index
      }
    });
  }


  getExtension(filename) {
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
      return new URL(uri, window?.location?.origin);
    } catch (e) {
      return;
    }
  }



  searchParamsToObj(searchParams) {
    const paramsMap = Array.from(searchParams).reduce((params, [key, val]) => params.set(key, val), new Map());
    return Object.fromEntries(paramsMap);
  }
}