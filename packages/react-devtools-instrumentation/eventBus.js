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
  STATE_UPDATE: "STATE_UPDATE",
  HTTP_EVENT: "HTTP_EVENT",
  DB_SUCCESS: "DB_SUCCESS",
});