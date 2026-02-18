//===================
// Import
//===================
import { log } from './utils.js';


//===================
// Functions
//===================
export function analyzeHTTP(data) {
  const res = data?.response;
  const req = data?.request;
  if (!res || !req) { return; }

  const uri = new URL(req.uri);
  const protocol = uri.protocol;
  const port = uri.port;
  const rawQueries = uri.search; // ?page=1order=asc...
  const params = searchParamsToObj(uri.searchParams); // { page:1,order:'asc' }
  const hostname = uri.hostname;
  const pathname = uri.pathname;

  console.log({
    protocol,
    port,
    rawQueries,
    params,
    hostname,
    pathname
  })
}


function searchParamsToObj(searchParams) {
  const paramsMap = Array.from(searchParams).reduce((params, [key, val]) => params.set(key, val), new Map());
  return Object.fromEntries(paramsMap);
}