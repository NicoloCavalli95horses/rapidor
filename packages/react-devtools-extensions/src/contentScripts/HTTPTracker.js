import {trackHTTPRequests} from '../../../react-devtools-instrumentation/trackHTTPRequests.js';


(async () => {
  const tracker = new trackHTTPRequests();
  await tracker.init();
})();