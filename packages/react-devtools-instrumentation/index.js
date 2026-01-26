import { TrackRequests } from './trackRequests.js';
import { log } from './utils.js';
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';


export async function _main() {
  log('_main() loaded from "installHook.js"')
  onGlobalRenderer();
};

function onGlobalRenderer() {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.on('renderer', ({ renderer, reactBuildType, rendererID }) => {
    const _renderer = renderer;
    const _rendererID = rendererID;
    const _reactBuildType = reactBuildType;

    const rendererInterface = attach(
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
      rendererID,
      renderer,
      window
    );
    log('Renderer attached');
    onUserEvent(rendererInterface);
  });
}

function onUserEvent(rendererInterface) {
  let requestID = 0;

  window.addEventListener('click', (e) => {
    const domEl = e.target;
    const id = rendererInterface.getElementIDForHostInstance(domEl);
    if (!id) { return; }

    // Parent component
    const owners = rendererInterface.getOwnersList(id);

    if (!owners || !owners.length) { return; }

    const componentID = owners[0].id;
    const path = null; // path to traverse InspectedElement (null = root)
    const forceFullData = true;
    const inspected = rendererInterface.inspectElement(requestID, componentID, path, forceFullData);
    log(inspected);

    requestID++;
  });
  log('Added global click event listener');
}