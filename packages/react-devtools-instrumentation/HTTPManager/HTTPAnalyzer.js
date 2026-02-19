//===================
// Import
//===================
import { log } from '../utils.js';
import { emit } from '../eventBus.js';


//===================
// Functions
//===================
export class analyzeHTTP {
  constructor() {
  }

  parseHTTP({ type, request, response }) {
    const res = response;
    const req = request;
    if (!res || !req) { return; }

    const uri = req?.url ? new URL(req.uri) : null;
    if (!uri) { return; }
    const protocol = uri.protocol;
    const port = uri.port;
    const rawQueries = uri.search; // ?page=1order=asc...
    const params = this.searchParamsToObj(uri.searchParams); // { page:1,order:'asc' }
    const hostname = uri.hostname;
    const pathname = uri.pathname;

    const detail = {
      protocol,
      port,
      rawQueries,
      params,
      hostname,
      pathname
    }

    emit({ type: "HTTP_EVENT", payload: {
      type,
      request: { ...request, detail },
      response
    }});
  }

  searchParamsToObj(searchParams) {
    const paramsMap = Array.from(searchParams).reduce((params, [key, val]) => params.set(key, val), new Map());
    return Object.fromEntries(paramsMap);
  }
}