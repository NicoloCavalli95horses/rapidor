//===================
// Import
//===================
import { Subject } from 'rxjs';

//===================
// Export
//===================
export const eventBus = new Subject();


export function emit( {type, payload, meta} ) {
  eventBus.next({
    type,
    payload,
    meta: {
      timestamp: Date.now(),
      ...meta
    }
  });
}