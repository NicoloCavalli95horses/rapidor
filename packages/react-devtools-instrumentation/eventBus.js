//===================
// Import
//===================
import { Subject } from 'rxjs';

//===================
// Export
//===================
export const eventBus = new Subject();


export function emit({ type, payload, meta }) {
  eventBus.next({
    type,
    payload,
    meta: {
      timestamp: Date.now(),
      ...meta
    }
  });
}



export const events = Object.freeze({
  FETCH_EVENT: "FETCH_EVENT",
  XML_EVENT: "XML_EVENT",
  HTTP_EVENT: "HTTP_EVENT", // XML or FETCH API

  STATE_UPDATE: "STATE_UPDATE", // new state snapshot
  DB_SUCCESS: "DB_SUCCESS", // successfully saved onto DB

  NAV: "NAVIGATION", // nav to new page
  
  GEN_REQ: "GENERATE_HTTP_REQUEST", // a match is found, generate new HTTP requests
  GEN_HTTP_EVENT_FLAG: "GENERATED_HTTP_EVENT_FLAG", // new HTTP requests are issued by the browser extension, do not analyze their responses as regular HTTP events 
  
  START_ANALYSIS: "START_ANALYSIS",
  ANALYSIS_IN_PROGRESS: "ANALYSIS_IN_PROGRESS", // the analysis is ongoing/finished (payload true/false)
  ANALYSIS_DONE: "ANALYSIS_DONE",
  
  EVALUATE: "EVALUATE", // new requests and responses, combined with related nodes and DOM info, are emitted
  REPORT: "REPORT_VULNERABILITY", // at least strategy confirmed an access-control issue
});