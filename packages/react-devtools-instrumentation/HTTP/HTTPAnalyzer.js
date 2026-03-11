//===================
// Import
//===================
import { emit, eventBus, events } from '../eventBus.js';
import { log } from '../utils.js';
import { config } from '../config.js';


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

    const protocol = uri.protocol;
    const port = uri.port;
    const rawQueries = uri.search; // ?page=1order=asc...
    const params = this.searchParamsToObj(uri.searchParams); // { page:1,order:'asc' }
    const hostname = uri.hostname;
    const fullPath = decodeURIComponent(uri.pathname); // path name can be encoded
    const segments = fullPath.split('/').filter(Boolean);

    const meta = {
      protocol,
      port,
      rawQueries,
      params,
      hostname,
      path: { fullPath, segments },
    }

    emit({
      type: events.HTTP_EVENT, payload: {
        type,
        request: { ...request, meta },
        response,
        done: !!request._requestId,
      }
    });
  }



  // we accept the same domain and all its subdomains
  isAllowed(uri) {
    if (!config.domainRequestOnly) { return true; }
    const receivedHost = new URL(uri).hostname;
    const currentHost = window.location.hostname;
    const baseDomain = this.getBaseDomain(currentHost);
    const toKeep = receivedHost === baseDomain || receivedHost.endsWith(`.${baseDomain}`);
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