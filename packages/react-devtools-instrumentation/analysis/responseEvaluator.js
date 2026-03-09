//===================
// Import
//===================
import { eventBus, events, emit } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../utils.js";


//===================
// Functions
//===================
export class ResponseEvaluator {
  constructor() {
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.EVALUATE))
      .subscribe(e => this.handleEvent(e.payload));
  }


  handleEvent(event) {
    const { newHttp, referenceHttp } = event;
    
    console.log(event);
  }
}