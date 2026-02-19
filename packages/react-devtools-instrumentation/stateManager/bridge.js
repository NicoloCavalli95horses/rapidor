//===================
// Import
//===================
import { attach } from 'react-devtools-shared/src/backend/fiber/renderer.js';
import { emit } from '../eventBus.js';
import { log, sendPostMessage } from '../utils.js';


//===================
// Consts
//===================



//===================
// Functions
//===================
export class Bridge {
  constructor() {
  }
  #hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  init() {
    this.listenToFiberCommits();
    this.connectToRenderer();
  }



  // Returns the rendererInterface object with functions to inspect specific components
  connectToRenderer() {
    this.#hook?.on('renderer', ({ renderer, reactBuildType, rendererID }) => {
      // `rendererInterface` exposes devtools utilities to get info about single components
      const rendererInterface = attach(this.#hook, rendererID, renderer, window);
      emit({ type: 'RENDERER', payload: rendererInterface });
      log('[INFO] Renderer attached');
    });
  }


  // Returns snapshots of the current state of the component tree
  // The state is updated automatically by React
  listenToFiberCommits() {
    const original = this.#hook?.onCommitFiberRoot;

    // The component tree is updated at every `onCommitFiberRoot` event. This may be asynch to user interactions (!)
    // We intercept the event and get the GUI state
    const self = this;
    this.#hook.onCommitFiberRoot = function (rendererID, root, ...rest) {
      const currentState = self.walkFiberTree(root.current);
      emit({ type: 'STATE_UPDATE', payload: currentState });
      return original?.call(this, rendererID, root, ...rest);
    };

    log('[INFO] listening to component tree changes');
  }


  // [TODO]
  // - minimize the data we get
  // - find a way to map props to closest DOM element (we have both props and DOM els but in different objects)
  // - this mapping will be used in metamorphic relations to solve oracle problem
  walkFiberTree(fiber) {
    const result = [];
    const self = this;

    function visit(node) {
      if (!node) { return };

      const name = node.type?.name || node.type;
      const key = node.key;
      const props = node.memoizedProps;
      const dom = node.stateNode;
      const tag = node.tag;

      if (self.isUserComponent(tag)) {
        result.push({ name, key, props, dom, tag });
      }

      visit(node.child);
      visit(node.sibling);
    }

    visit(fiber);
    return result;
  }

  // Tags are defined in ReactWorkTags.js
  // Useful tags are found empirically
  isUserComponent(tag) {
    return (
      tag === 0 // FunctionComponent
      || tag === 1 // ClassComponent
      || tag === 5 // HostComponent
      // tag === 11 // ForwardRef
      // tag === 13 // SuspenseComponent
      || tag === 14 // MemoComponent
      // || tag === 15 // SimpleMemoComponent
      // || tag === 16 // LazyComponent
      // || tag === 17 // IncompleteClassComponent
      // || tag === 19 // SuspenseListComponent
      // || tag === 21 // ScopeComponent
      // || tag === 22 // OffscreenComponent
      // || tag === 23 // LegacyHiddenComponent
      // || tag === 24 // CacheComponent
      // || tag === 25 // TracingMarkerComponent
      // || tag === 28 // IncompleteFunctionComponent
      // || tag === 30 // ViewTransitionComponent
      // || tag === 31 // ActivityComponent
    );
  }
}
