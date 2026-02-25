//===================
// Import
//===================
import { emit } from '../eventBus.js';


//===================
// Functions
//===================
export class analyzeHTTP {
  constructor() {
  }

  parseHTTP({ type, request, response }) {
    if (!response || !request) { return; }

    const uri = this.getURI(request?.uri)
    if (!uri) { return; }

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
      type: "HTTP_EVENT", payload: {
        type,
        request: { ...request, meta },
        response
      }
    });
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