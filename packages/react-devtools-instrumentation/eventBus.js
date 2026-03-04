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
  STATE_UPDATE: "STATE_UPDATE", // new state snapshot
  HTTP_EVENT: "HTTP_EVENT", // XML or FETCH API
  DB_SUCCESS: "DB_SUCCESS", // successfully saved onto DB
  GEN_REQ: "GENERATE_HTTP_REQUEST", // a match is found, generate new HTTP requests
  GEN_HTTP_EVENT_FLAG: "GENERATED_HTTP_EVENT_FLAG", // new HTTP requests are issued by the browser extension, do not analyze their responses as regular HTTP events 
});