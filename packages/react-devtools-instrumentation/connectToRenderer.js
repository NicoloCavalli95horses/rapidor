//===================
// Import
//===================
import { log, sendPostMessage } from './utils.js';
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';

//===================
// Functions
//===================
export function connectToRenderer() {
  return new Promise((resolve) => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

    hook?.on('renderer', ({ renderer, reactBuildType, rendererID }) => {
      // `rendererInterface` exposes devtools utilities to get info about single components
      const rendererInterface = attach(hook, rendererID, renderer, window);
      log('[INFO] Renderer attached');

      // `getFiberRoots` exposes react utilities to get info about global state and components
      // It is empty at the beginning, we need to wait for the first commit
      const origCommit = hook.onCommitFiberRoot;

      hook.onCommitFiberRoot = function (root, ...rest) {
        // Restore after first commit
        renderer.onCommitFiberRoot = origCommit;

        console.log('FiberRoot committed:', root);

        const roots = hook.getFiberRoots(rendererID);
        console.log('Roots:', roots);
        resolve({rendererInterface, roots})
      };
    });
  })
}