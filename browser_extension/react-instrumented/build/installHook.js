/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "../../build/oss-experimental/react-debug-tools/cjs/react-debug-tools.development.js":
/*!*******************************************************************************************!*\
  !*** ../../build/oss-experimental/react-debug-tools/cjs/react-debug-tools.development.js ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


 true && function () {
  function getPrimitiveStackCache() {
    if (null === primitiveStackCache) {
      var cache = new Map();
      try {
        Dispatcher.useContext({
          _currentValue: null
        });
        Dispatcher.useState(null);
        Dispatcher.useReducer(function (s) {
          return s;
        }, null);
        Dispatcher.useRef(null);
        "function" === typeof Dispatcher.useCacheRefresh && Dispatcher.useCacheRefresh();
        Dispatcher.useLayoutEffect(function () {});
        Dispatcher.useInsertionEffect(function () {});
        Dispatcher.useEffect(function () {});
        Dispatcher.useImperativeHandle(void 0, function () {
          return null;
        });
        Dispatcher.useDebugValue(null);
        Dispatcher.useCallback(function () {});
        Dispatcher.useTransition();
        Dispatcher.useSyncExternalStore(function () {
          return function () {};
        }, function () {
          return null;
        }, function () {
          return null;
        });
        Dispatcher.useDeferredValue(null);
        Dispatcher.useMemo(function () {
          return null;
        });
        Dispatcher.useOptimistic(null, function (s) {
          return s;
        });
        Dispatcher.useFormState(function (s) {
          return s;
        }, null);
        Dispatcher.useActionState(function (s) {
          return s;
        }, null);
        Dispatcher.useHostTransitionStatus();
        "function" === typeof Dispatcher.useMemoCache && Dispatcher.useMemoCache(0);
        if ("function" === typeof Dispatcher.use) {
          Dispatcher.use({
            $$typeof: REACT_CONTEXT_TYPE,
            _currentValue: null
          });
          Dispatcher.use({
            $$typeof: REACT_RECOVERABLE_TYPE,
            _reason: void 0
          });
          Dispatcher.use({
            then: function () {},
            status: "fulfilled",
            value: null
          });
          try {
            Dispatcher.use({
              then: function () {}
            });
          } catch (x) {}
        }
        Dispatcher.useId();
        "function" === typeof Dispatcher.useEffectEvent && Dispatcher.useEffectEvent(function () {});
      } finally {
        var readHookLog = hookLog;
        hookLog = [];
      }
      for (var i = 0; i < readHookLog.length; i++) {
        var hook = readHookLog[i];
        cache.set(hook.primitive, ErrorStackParser.parse(hook.stackError));
      }
      primitiveStackCache = cache;
    }
    return primitiveStackCache;
  }
  function nextHook() {
    var hook = currentHook;
    null !== hook && (currentHook = hook.next);
    return hook;
  }
  function readContext(context) {
    if (null === currentFiber) return context._currentValue;
    if (null === currentContextDependency) throw Error("Context reads do not line up with context dependencies. This is a bug in React Debug Tools.");
    hasOwnProperty.call(currentContextDependency, "memoizedValue") ? (context = currentContextDependency.memoizedValue, currentContextDependency = currentContextDependency.next) : context = context._currentValue;
    return context;
  }
  function findSharedIndex(hookStack, rootStack, rootIndex) {
    var source = rootStack[rootIndex].source,
      i = 0;
    a: for (; i < hookStack.length; i++) if (hookStack[i].source === source) {
      for (var a = rootIndex + 1, b = i + 1; a < rootStack.length && b < hookStack.length; a++, b++) if (hookStack[b].source !== rootStack[a].source) continue a;
      return i;
    }
    return -1;
  }
  function isReactWrapper(functionName, wrapperName) {
    functionName = parseHookName(functionName);
    return "HostTransitionStatus" === wrapperName ? functionName === wrapperName || "FormStatus" === functionName : functionName === wrapperName;
  }
  function parseHookName(functionName) {
    if (!functionName) return "";
    var startIndex = functionName.lastIndexOf("[as ");
    if (-1 !== startIndex) return parseHookName(functionName.slice(startIndex + 4, -1));
    startIndex = functionName.lastIndexOf(".");
    startIndex = -1 === startIndex ? 0 : startIndex + 1;
    functionName.slice(startIndex).startsWith("unstable_") && (startIndex += 9);
    functionName.slice(startIndex).startsWith("experimental_") && (startIndex += 13);
    if ("use" === functionName.slice(startIndex, startIndex + 3)) {
      if (3 === functionName.length - startIndex) return "Use";
      startIndex += 3;
    }
    return functionName.slice(startIndex);
  }
  function buildTree(rootStack$jscomp$0, readHookLog) {
    for (var rootChildren = [], prevStack = null, levelChildren = rootChildren, nativeHookID = 0, stackOfChildren = [], i = 0; i < readHookLog.length; i++) {
      var hook = readHookLog[i];
      var rootStack = rootStack$jscomp$0,
        hook$jscomp$0 = hook;
      var parseResult = ErrorStackParser.parse(hook$jscomp$0.stackError);
      b: {
        var hookStack = parseResult,
          rootIndex = findSharedIndex(hookStack, rootStack, mostLikelyAncestorIndex);
        if (-1 !== rootIndex) rootStack = rootIndex;else {
          for (var i$jscomp$0 = 0; i$jscomp$0 < rootStack.length && 5 > i$jscomp$0; i$jscomp$0++) if (rootIndex = findSharedIndex(hookStack, rootStack, i$jscomp$0), -1 !== rootIndex) {
            mostLikelyAncestorIndex = i$jscomp$0;
            rootStack = rootIndex;
            break b;
          }
          rootStack = -1;
        }
      }
      b: {
        hookStack = parseResult;
        rootIndex = getPrimitiveStackCache().get(hook$jscomp$0.primitive);
        if (void 0 !== rootIndex) for (i$jscomp$0 = 0; i$jscomp$0 < rootIndex.length && i$jscomp$0 < hookStack.length; i$jscomp$0++) if (rootIndex[i$jscomp$0].source !== hookStack[i$jscomp$0].source) {
          i$jscomp$0 < hookStack.length - 1 && isReactWrapper(hookStack[i$jscomp$0].functionName, hook$jscomp$0.dispatcherHookName) && i$jscomp$0++;
          i$jscomp$0 < hookStack.length - 1 && isReactWrapper(hookStack[i$jscomp$0].functionName, hook$jscomp$0.dispatcherHookName) && i$jscomp$0++;
          hook$jscomp$0 = i$jscomp$0;
          break b;
        }
        hook$jscomp$0 = -1;
      }
      parseResult = -1 === rootStack || -1 === hook$jscomp$0 || 2 > rootStack - hook$jscomp$0 ? -1 === hook$jscomp$0 ? [null, null] : [parseResult[hook$jscomp$0 - 1], null] : [parseResult[hook$jscomp$0 - 1], parseResult.slice(hook$jscomp$0, rootStack - 1)];
      rootStack = parseResult[0];
      parseResult = parseResult[1];
      hook$jscomp$0 = hook.displayName;
      null === hook$jscomp$0 && null !== rootStack && (hook$jscomp$0 = parseHookName(rootStack.functionName) || parseHookName(hook.dispatcherHookName));
      if (null !== parseResult) {
        rootStack = 0;
        if (null !== prevStack) {
          for (; rootStack < parseResult.length && rootStack < prevStack.length && parseResult[parseResult.length - rootStack - 1].source === prevStack[prevStack.length - rootStack - 1].source;) rootStack++;
          for (prevStack = prevStack.length - 1; prevStack > rootStack; prevStack--) levelChildren = stackOfChildren.pop();
        }
        for (prevStack = parseResult.length - rootStack - 1; 1 <= prevStack; prevStack--) rootStack = [], hookStack = parseResult[prevStack], hookStack = {
          id: null,
          isStateEditable: !1,
          name: parseHookName(parseResult[prevStack - 1].functionName),
          value: void 0,
          subHooks: rootStack,
          debugInfo: null,
          hookSource: {
            lineNumber: void 0 === hookStack.lineNumber ? null : hookStack.lineNumber,
            columnNumber: void 0 === hookStack.columnNumber ? null : hookStack.columnNumber,
            functionName: void 0 === hookStack.functionName ? null : hookStack.functionName,
            fileName: void 0 === hookStack.fileName ? null : hookStack.fileName
          }
        }, levelChildren.push(hookStack), stackOfChildren.push(levelChildren), levelChildren = rootStack;
        prevStack = parseResult;
      }
      rootStack = hook.primitive;
      hookStack = hook.debugInfo;
      hook = {
        id: "Context" === rootStack || "Context (use)" === rootStack || "DebugValue" === rootStack || "Promise" === rootStack || "Unresolved" === rootStack || "HostTransitionStatus" === rootStack ? null : nativeHookID++,
        isStateEditable: "Reducer" === rootStack || "State" === rootStack,
        name: hook$jscomp$0 || rootStack,
        value: hook.value,
        subHooks: [],
        debugInfo: hookStack,
        hookSource: null
      };
      hook$jscomp$0 = {
        lineNumber: null,
        functionName: null,
        fileName: null,
        columnNumber: null
      };
      parseResult && 1 <= parseResult.length && (parseResult = parseResult[0], hook$jscomp$0.lineNumber = void 0 === parseResult.lineNumber ? null : parseResult.lineNumber, hook$jscomp$0.functionName = void 0 === parseResult.functionName ? null : parseResult.functionName, hook$jscomp$0.fileName = void 0 === parseResult.fileName ? null : parseResult.fileName, hook$jscomp$0.columnNumber = void 0 === parseResult.columnNumber ? null : parseResult.columnNumber);
      hook.hookSource = hook$jscomp$0;
      levelChildren.push(hook);
    }
    processDebugValues(rootChildren, null);
    return rootChildren;
  }
  function processDebugValues(hooksTree, parentHooksNode) {
    for (var debugValueHooksNodes = [], i = 0; i < hooksTree.length; i++) {
      var hooksNode = hooksTree[i];
      "DebugValue" === hooksNode.name && 0 === hooksNode.subHooks.length ? (hooksTree.splice(i, 1), i--, debugValueHooksNodes.push(hooksNode)) : processDebugValues(hooksNode.subHooks, hooksNode);
    }
    null !== parentHooksNode && (1 === debugValueHooksNodes.length ? parentHooksNode.value = debugValueHooksNodes[0].value : 1 < debugValueHooksNodes.length && (parentHooksNode.value = debugValueHooksNodes.map(function (_ref) {
      return _ref.value;
    })));
  }
  function handleRenderFunctionError(error) {
    if (error !== SuspenseException) {
      if (error instanceof Error && "ReactDebugToolsUnsupportedHookError" === error.name) throw error;
      var wrapperError = Error("Error rendering inspected component", {
        cause: error
      });
      wrapperError.name = "ReactDebugToolsRenderError";
      wrapperError.cause = error;
      throw wrapperError;
    }
  }
  function inspectHooksImpl(renderFunction, props, currentDispatcher) {
    var previousDispatcher = currentDispatcher.H;
    currentDispatcher.H = DispatcherProxy;
    try {
      var ancestorStackError = Error();
      renderFunction(props);
    } catch (error) {
      handleRenderFunctionError(error);
    } finally {
      renderFunction = hookLog, hookLog = [], currentDispatcher.H = previousDispatcher;
    }
    currentDispatcher = void 0 === ancestorStackError ? [] : ErrorStackParser.parse(ancestorStackError);
    return buildTree(currentDispatcher, renderFunction);
  }
  function restoreContexts(contextMap) {
    contextMap.forEach(function (value, context) {
      return context._currentValue = value;
    });
  }
  function inspectHooksOfFiberImpl(fiber, currentDispatcher) {
    if (0 !== fiber.tag && 15 !== fiber.tag && 11 !== fiber.tag) throw Error("Unknown Fiber. Needs to be a function component to inspect hooks.");
    getPrimitiveStackCache();
    currentHook = fiber.memoizedState;
    currentFiber = fiber;
    var thenableState = fiber.dependencies && fiber.dependencies._debugThenableState;
    thenableState = thenableState ? thenableState.thenables || thenableState : null;
    currentThenableState = Array.isArray(thenableState) ? thenableState : null;
    currentThenableIndex = 0;
    if (hasOwnProperty.call(currentFiber, "dependencies")) thenableState = currentFiber.dependencies, currentContextDependency = null !== thenableState ? thenableState.firstContext : null;else if (hasOwnProperty.call(currentFiber, "dependencies_old")) thenableState = currentFiber.dependencies_old, currentContextDependency = null !== thenableState ? thenableState.firstContext : null;else if (hasOwnProperty.call(currentFiber, "dependencies_new")) thenableState = currentFiber.dependencies_new, currentContextDependency = null !== thenableState ? thenableState.firstContext : null;else if (hasOwnProperty.call(currentFiber, "contextDependencies")) thenableState = currentFiber.contextDependencies, currentContextDependency = null !== thenableState ? thenableState.first : null;else throw Error("Unsupported React version. This is a bug in React Debug Tools.");
    thenableState = fiber.type;
    var props = fiber.memoizedProps;
    if (thenableState !== fiber.elementType && thenableState && thenableState.defaultProps) {
      props = assign({}, props);
      var defaultProps = thenableState.defaultProps;
      for (propName in defaultProps) void 0 === props[propName] && (props[propName] = defaultProps[propName]);
    }
    var propName = new Map();
    try {
      if (null !== currentContextDependency && !hasOwnProperty.call(currentContextDependency, "memoizedValue")) for (defaultProps = fiber; defaultProps;) {
        if (10 === defaultProps.tag) {
          var context = defaultProps.type;
          void 0 !== context._context && (context = context._context);
          propName.has(context) || (propName.set(context, context._currentValue), context._currentValue = defaultProps.memoizedProps.value);
        }
        defaultProps = defaultProps.return;
      }
      if (11 === fiber.tag) {
        var renderFunction = thenableState.render;
        context = props;
        var ref = fiber.ref,
          previousDispatcher = currentDispatcher.H;
        currentDispatcher.H = DispatcherProxy;
        try {
          var ancestorStackError = Error();
          renderFunction(context, ref);
        } catch (error) {
          handleRenderFunctionError(error);
        } finally {
          var readHookLog = hookLog;
          hookLog = [];
          currentDispatcher.H = previousDispatcher;
        }
        var rootStack = void 0 === ancestorStackError ? [] : ErrorStackParser.parse(ancestorStackError);
        return buildTree(rootStack, readHookLog);
      }
      return inspectHooksImpl(thenableState, props, currentDispatcher);
    } finally {
      currentThenableState = currentContextDependency = currentHook = currentFiber = null, currentThenableIndex = 0, restoreContexts(propName);
    }
  }
  var ErrorStackParser = __webpack_require__(/*! error-stack-parser */ "../../node_modules/error-stack-parser/error-stack-parser.js"),
    React = __webpack_require__(/*! react */ "../../build/oss-experimental/react/index.js"),
    assign = Object.assign,
    ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
    REACT_CONTEXT_TYPE = Symbol.for("react.context"),
    REACT_MEMO_CACHE_SENTINEL = Symbol.for("react.memo_cache_sentinel"),
    REACT_RECOVERABLE_TYPE = Symbol.for("react.recoverable"),
    hasOwnProperty = Object.prototype.hasOwnProperty,
    hookLog = [],
    primitiveStackCache = null,
    currentFiber = null,
    currentHook = null,
    currentContextDependency = null,
    currentThenableIndex = 0,
    currentThenableState = null,
    SuspenseException = Error("Suspense Exception: This is not a real error! It's an implementation detail of `use` to interrupt the current render. You must either rethrow it immediately, or move the `use` call outside of the `try/catch` block. Capturing without rethrowing will lead to unexpected behavior.\n\nTo handle async errors, wrap your component in an error boundary, or call the promise's `.catch` method and pass the result to `use`."),
    Dispatcher = {
      readContext: readContext,
      use: function (usable) {
        if (null !== usable && "object" === typeof usable) {
          if ("function" === typeof usable.then) {
            usable = null !== currentThenableState && currentThenableIndex < currentThenableState.length ? currentThenableState[currentThenableIndex++] : usable;
            switch (usable.status) {
              case "fulfilled":
                var fulfilledValue = usable.value;
                hookLog.push({
                  displayName: null,
                  primitive: "Promise",
                  stackError: Error(),
                  value: fulfilledValue,
                  debugInfo: void 0 === usable._debugInfo ? null : usable._debugInfo,
                  dispatcherHookName: "Use"
                });
                return fulfilledValue;
              case "rejected":
                throw usable.reason;
            }
            hookLog.push({
              displayName: null,
              primitive: "Unresolved",
              stackError: Error(),
              value: usable,
              debugInfo: void 0 === usable._debugInfo ? null : usable._debugInfo,
              dispatcherHookName: "Use"
            });
            throw SuspenseException;
          }
          if (usable.$$typeof === REACT_RECOVERABLE_TYPE) {
            hookLog.push({
              displayName: null,
              primitive: "Recoverable",
              stackError: Error(),
              value: void 0,
              debugInfo: null,
              dispatcherHookName: "Use"
            });
            return;
          }
          if (usable.$$typeof === REACT_CONTEXT_TYPE) return fulfilledValue = readContext(usable), hookLog.push({
            displayName: usable.displayName || "Context",
            primitive: "Context (use)",
            stackError: Error(),
            value: fulfilledValue,
            debugInfo: null,
            dispatcherHookName: "Use"
          }), fulfilledValue;
        }
        throw Error("An unsupported type was passed to use(): " + String(usable));
      },
      useCallback: function (callback) {
        var hook = nextHook();
        hookLog.push({
          displayName: null,
          primitive: "Callback",
          stackError: Error(),
          value: null !== hook ? hook.memoizedState[0] : callback,
          debugInfo: null,
          dispatcherHookName: "Callback"
        });
        return callback;
      },
      useContext: function (context) {
        var value = readContext(context);
        hookLog.push({
          displayName: context.displayName || null,
          primitive: "Context",
          stackError: Error(),
          value: value,
          debugInfo: null,
          dispatcherHookName: "Context"
        });
        return value;
      },
      useEffect: function (create) {
        nextHook();
        hookLog.push({
          displayName: null,
          primitive: "Effect",
          stackError: Error(),
          value: create,
          debugInfo: null,
          dispatcherHookName: "Effect"
        });
      },
      useImperativeHandle: function (ref) {
        nextHook();
        var instance = void 0;
        null !== ref && "object" === typeof ref && (instance = ref.current);
        hookLog.push({
          displayName: null,
          primitive: "ImperativeHandle",
          stackError: Error(),
          value: instance,
          debugInfo: null,
          dispatcherHookName: "ImperativeHandle"
        });
      },
      useLayoutEffect: function (create) {
        nextHook();
        hookLog.push({
          displayName: null,
          primitive: "LayoutEffect",
          stackError: Error(),
          value: create,
          debugInfo: null,
          dispatcherHookName: "LayoutEffect"
        });
      },
      useInsertionEffect: function (create) {
        nextHook();
        hookLog.push({
          displayName: null,
          primitive: "InsertionEffect",
          stackError: Error(),
          value: create,
          debugInfo: null,
          dispatcherHookName: "InsertionEffect"
        });
      },
      useMemo: function (nextCreate) {
        var hook = nextHook();
        nextCreate = null !== hook ? hook.memoizedState[0] : nextCreate();
        hookLog.push({
          displayName: null,
          primitive: "Memo",
          stackError: Error(),
          value: nextCreate,
          debugInfo: null,
          dispatcherHookName: "Memo"
        });
        return nextCreate;
      },
      useReducer: function (reducer, initialArg, init) {
        reducer = nextHook();
        initialArg = null !== reducer ? reducer.memoizedState : void 0 !== init ? init(initialArg) : initialArg;
        hookLog.push({
          displayName: null,
          primitive: "Reducer",
          stackError: Error(),
          value: initialArg,
          debugInfo: null,
          dispatcherHookName: "Reducer"
        });
        return [initialArg, function () {}];
      },
      useRef: function (initialValue) {
        var hook = nextHook();
        initialValue = null !== hook ? hook.memoizedState : {
          current: initialValue
        };
        hookLog.push({
          displayName: null,
          primitive: "Ref",
          stackError: Error(),
          value: initialValue.current,
          debugInfo: null,
          dispatcherHookName: "Ref"
        });
        return initialValue;
      },
      useState: function (initialState) {
        var hook = nextHook();
        initialState = null !== hook ? hook.memoizedState : "function" === typeof initialState ? initialState() : initialState;
        hookLog.push({
          displayName: null,
          primitive: "State",
          stackError: Error(),
          value: initialState,
          debugInfo: null,
          dispatcherHookName: "State"
        });
        return [initialState, function () {}];
      },
      useDebugValue: function (value, formatterFn) {
        hookLog.push({
          displayName: null,
          primitive: "DebugValue",
          stackError: Error(),
          value: "function" === typeof formatterFn ? formatterFn(value) : value,
          debugInfo: null,
          dispatcherHookName: "DebugValue"
        });
      },
      useDeferredValue: function (value) {
        var hook = nextHook();
        value = null !== hook ? hook.memoizedState : value;
        hookLog.push({
          displayName: null,
          primitive: "DeferredValue",
          stackError: Error(),
          value: value,
          debugInfo: null,
          dispatcherHookName: "DeferredValue"
        });
        return value;
      },
      useTransition: function () {
        var stateHook = nextHook();
        nextHook();
        stateHook = null !== stateHook ? stateHook.memoizedState : !1;
        hookLog.push({
          displayName: null,
          primitive: "Transition",
          stackError: Error(),
          value: stateHook,
          debugInfo: null,
          dispatcherHookName: "Transition"
        });
        return [stateHook, function () {}];
      },
      useSyncExternalStore: function (subscribe, getSnapshot) {
        subscribe = nextHook();
        nextHook();
        getSnapshot = null !== subscribe ? subscribe.memoizedState : getSnapshot();
        hookLog.push({
          displayName: null,
          primitive: "SyncExternalStore",
          stackError: Error(),
          value: getSnapshot,
          debugInfo: null,
          dispatcherHookName: "SyncExternalStore"
        });
        return getSnapshot;
      },
      useId: function () {
        var hook = nextHook();
        hook = null !== hook ? hook.memoizedState : "";
        hookLog.push({
          displayName: null,
          primitive: "Id",
          stackError: Error(),
          value: hook,
          debugInfo: null,
          dispatcherHookName: "Id"
        });
        return hook;
      },
      useHostTransitionStatus: function () {
        var status = readContext({
          _currentValue: null
        });
        hookLog.push({
          displayName: null,
          primitive: "HostTransitionStatus",
          stackError: Error(),
          value: status,
          debugInfo: null,
          dispatcherHookName: "HostTransitionStatus"
        });
        return status;
      },
      useFormState: function (action, initialState) {
        var hook = nextHook();
        nextHook();
        nextHook();
        action = Error();
        var debugInfo = null,
          error = null;
        if (null !== hook) {
          if (initialState = hook.memoizedState, "object" === typeof initialState && null !== initialState && "function" === typeof initialState.then) switch (initialState.status) {
            case "fulfilled":
              var value = initialState.value;
              debugInfo = void 0 === initialState._debugInfo ? null : initialState._debugInfo;
              break;
            case "rejected":
              error = initialState.reason;
              break;
            default:
              error = SuspenseException, debugInfo = void 0 === initialState._debugInfo ? null : initialState._debugInfo, value = initialState;
          } else value = initialState;
        } else value = initialState;
        hookLog.push({
          displayName: null,
          primitive: "FormState",
          stackError: action,
          value: value,
          debugInfo: debugInfo,
          dispatcherHookName: "FormState"
        });
        if (null !== error) throw error;
        return [value, function () {}, !1];
      },
      useActionState: function (action, initialState) {
        var hook = nextHook();
        nextHook();
        nextHook();
        action = Error();
        var debugInfo = null,
          error = null;
        if (null !== hook) {
          if (initialState = hook.memoizedState, "object" === typeof initialState && null !== initialState && "function" === typeof initialState.then) switch (initialState.status) {
            case "fulfilled":
              var value = initialState.value;
              debugInfo = void 0 === initialState._debugInfo ? null : initialState._debugInfo;
              break;
            case "rejected":
              error = initialState.reason;
              break;
            default:
              error = SuspenseException, debugInfo = void 0 === initialState._debugInfo ? null : initialState._debugInfo, value = initialState;
          } else value = initialState;
        } else value = initialState;
        hookLog.push({
          displayName: null,
          primitive: "ActionState",
          stackError: action,
          value: value,
          debugInfo: debugInfo,
          dispatcherHookName: "ActionState"
        });
        if (null !== error) throw error;
        return [value, function () {}, !1];
      },
      useOptimistic: function (passthrough) {
        var hook = nextHook();
        passthrough = null !== hook ? hook.memoizedState : passthrough;
        hookLog.push({
          displayName: null,
          primitive: "Optimistic",
          stackError: Error(),
          value: passthrough,
          debugInfo: null,
          dispatcherHookName: "Optimistic"
        });
        return [passthrough, function () {}];
      },
      useMemoCache: function (size) {
        var fiber = currentFiber;
        if (null == fiber) return [];
        fiber = null != fiber.updateQueue ? fiber.updateQueue.memoCache : null;
        if (null == fiber) return [];
        var data = fiber.data[fiber.index];
        if (void 0 === data) {
          data = fiber.data[fiber.index] = Array(size);
          for (var i = 0; i < size; i++) data[i] = REACT_MEMO_CACHE_SENTINEL;
        }
        fiber.index++;
        return data;
      },
      useCacheRefresh: function () {
        var hook = nextHook();
        hookLog.push({
          displayName: null,
          primitive: "CacheRefresh",
          stackError: Error(),
          value: null !== hook ? hook.memoizedState : function () {},
          debugInfo: null,
          dispatcherHookName: "CacheRefresh"
        });
        return function () {};
      },
      useEffectEvent: function (callback) {
        nextHook();
        hookLog.push({
          displayName: null,
          primitive: "EffectEvent",
          stackError: Error(),
          value: callback,
          debugInfo: null,
          dispatcherHookName: "EffectEvent"
        });
        return callback;
      }
    };
  React = {
    get: function (target, prop) {
      if (target.hasOwnProperty(prop)) return target[prop];
      target = Error("Missing method in Dispatcher: " + prop);
      target.name = "ReactDebugToolsUnsupportedHookError";
      throw target;
    }
  };
  var DispatcherProxy = "undefined" === typeof Proxy ? Dispatcher : new Proxy(Dispatcher, React),
    mostLikelyAncestorIndex = 0;
  exports.inspectHooks = function (renderFunction, props, currentDispatcher) {
    return inspectHooksImpl(renderFunction, props, null != currentDispatcher ? currentDispatcher : ReactSharedInternals);
  };
  exports.inspectHooksOfFiber = function (fiber, currentDispatcher) {
    return inspectHooksOfFiberImpl(fiber, null != currentDispatcher ? currentDispatcher : ReactSharedInternals);
  };
  exports.inspectHooksOfFiberWithoutDefaultDispatcher = function (fiber, currentDispatcher) {
    return inspectHooksOfFiberImpl(fiber, currentDispatcher);
  };
  exports.inspectHooksWithoutDefaultDispatcher = function (renderFunction, props, currentDispatcher) {
    return inspectHooksImpl(renderFunction, props, currentDispatcher);
  };
}();

/***/ }),

/***/ "../../build/oss-experimental/react-debug-tools/index.js":
/*!***************************************************************!*\
  !*** ../../build/oss-experimental/react-debug-tools/index.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


if (false) {} else {
  module.exports = __webpack_require__(/*! ./cjs/react-debug-tools.development.js */ "../../build/oss-experimental/react-debug-tools/cjs/react-debug-tools.development.js");
}

/***/ }),

/***/ "../../build/oss-experimental/react/cjs/react.development.js":
/*!*******************************************************************!*\
  !*** ../../build/oss-experimental/react/cjs/react.development.js ***!
  \*******************************************************************/
/***/ ((module, exports, __webpack_require__) => {

"use strict";
/* module decorator */ module = __webpack_require__.nmd(module);
/* provided dependency */ var process = __webpack_require__(/*! process/browser */ "../../node_modules/process/browser.js");


 true && function () {
  function defineDeprecationWarning(methodName, info) {
    Object.defineProperty(Component.prototype, methodName, {
      get: function () {
        console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
      }
    });
  }
  function getIteratorFn(maybeIterable) {
    if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
    maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
    return "function" === typeof maybeIterable ? maybeIterable : null;
  }
  function warnNoop(publicInstance, callerName) {
    publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
    var warningKey = publicInstance + "." + callerName;
    didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = !0);
  }
  function Component(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  function ComponentDummy() {}
  function PureComponent(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  function noop() {}
  function testStringCoercion(value) {
    return "" + value;
  }
  function checkKeyStringCoercion(value) {
    try {
      testStringCoercion(value);
      var JSCompiler_inline_result = !1;
    } catch (e) {
      JSCompiler_inline_result = !0;
    }
    if (JSCompiler_inline_result) {
      JSCompiler_inline_result = console;
      var JSCompiler_temp_const = JSCompiler_inline_result.error;
      var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
      JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
      return testStringCoercion(value);
    }
  }
  function getComponentNameFromType(type) {
    if (null == type) return null;
    if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
    if ("string" === typeof type) return type;
    switch (type) {
      case REACT_FRAGMENT_TYPE:
        return "Fragment";
      case REACT_PROFILER_TYPE:
        return "Profiler";
      case REACT_STRICT_MODE_TYPE:
        return "StrictMode";
      case REACT_SUSPENSE_TYPE:
        return "Suspense";
      case REACT_SUSPENSE_LIST_TYPE:
        return "SuspenseList";
      case REACT_ACTIVITY_TYPE:
        return "Activity";
      case REACT_VIEW_TRANSITION_TYPE:
        return "ViewTransition";
    }
    if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
      case REACT_PORTAL_TYPE:
        return "Portal";
      case REACT_CONTEXT_TYPE:
        return type.displayName || "Context";
      case REACT_CONSUMER_TYPE:
        return (type._context.displayName || "Context") + ".Consumer";
      case REACT_FORWARD_REF_TYPE:
        var innerType = type.render;
        type = type.displayName;
        type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
        return type;
      case REACT_MEMO_TYPE:
        return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
      case REACT_LAZY_TYPE:
        innerType = type._payload;
        type = type._init;
        try {
          return getComponentNameFromType(type(innerType));
        } catch (x) {}
    }
    return null;
  }
  function getTaskName(type) {
    if (type === REACT_FRAGMENT_TYPE) return "<>";
    if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
    try {
      var name = getComponentNameFromType(type);
      return name ? "<" + name + ">" : "<...>";
    } catch (x) {
      return "<...>";
    }
  }
  function getOwner() {
    var dispatcher = ReactSharedInternals.A;
    return null === dispatcher ? null : dispatcher.getOwner();
  }
  function UnknownOwner() {
    return Error("react-stack-top-frame");
  }
  function hasValidKey(config) {
    if (hasOwnProperty.call(config, "key")) {
      var getter = Object.getOwnPropertyDescriptor(config, "key").get;
      if (getter && getter.isReactWarning) return !1;
    }
    return void 0 !== config.key;
  }
  function defineKeyPropWarningGetter(props, displayName) {
    function warnAboutAccessingKey() {
      specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
    }
    warnAboutAccessingKey.isReactWarning = !0;
    Object.defineProperty(props, "key", {
      get: warnAboutAccessingKey,
      configurable: !0
    });
  }
  function elementRefGetterWithDeprecationWarning() {
    var componentName = getComponentNameFromType(this.type);
    didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
    componentName = this.props.ref;
    return void 0 !== componentName ? componentName : null;
  }
  function ReactElement(type, key, props, owner, debugStack, debugTask) {
    var refProp = props.ref;
    type = {
      $$typeof: REACT_ELEMENT_TYPE,
      type: type,
      key: key,
      props: props,
      _owner: owner
    };
    null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
      enumerable: !1,
      get: elementRefGetterWithDeprecationWarning
    }) : Object.defineProperty(type, "ref", {
      enumerable: !1,
      value: null
    });
    type._store = {};
    Object.defineProperty(type._store, "validated", {
      configurable: !1,
      enumerable: !1,
      writable: !0,
      value: 0
    });
    Object.defineProperty(type, "_debugInfo", {
      configurable: !1,
      enumerable: !1,
      writable: !0,
      value: null
    });
    Object.defineProperty(type, "_debugStack", {
      configurable: !1,
      enumerable: !1,
      writable: !0,
      value: debugStack
    });
    Object.defineProperty(type, "_debugTask", {
      configurable: !1,
      enumerable: !1,
      writable: !0,
      value: debugTask
    });
    Object.freeze && (Object.freeze(type.props), Object.freeze(type));
    return type;
  }
  function cloneAndReplaceKey(oldElement, newKey) {
    newKey = ReactElement(oldElement.type, newKey, oldElement.props, oldElement._owner, oldElement._debugStack, oldElement._debugTask);
    oldElement._store && (newKey._store.validated = oldElement._store.validated);
    return newKey;
  }
  function validateChildKeys(node) {
    isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
  }
  function isValidElement(object) {
    return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
  }
  function escape(key) {
    var escaperLookup = {
      "=": "=0",
      ":": "=2"
    };
    return "$" + key.replace(/[=:]/g, function (match) {
      return escaperLookup[match];
    });
  }
  function getElementKey(element, index) {
    if ("object" === typeof element && null !== element && null != element.key) {
      if (element.key === REACT_OPTIMISTIC_KEY) return console.error("React.Children helpers don't support optimisticKey."), index.toString(36);
      checkKeyStringCoercion(element.key);
      return escape("" + element.key);
    }
    return index.toString(36);
  }
  function resolveThenable(thenable) {
    switch (thenable.status) {
      case "fulfilled":
        return thenable.value;
      case "rejected":
        throw thenable.reason;
      default:
        switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function (fulfilledValue) {
          "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
        }, function (error) {
          "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
        })), thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
        }
    }
    throw thenable;
  }
  function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
    var type = typeof children;
    if ("undefined" === type || "boolean" === type) children = null;
    var invokeCallback = !1;
    if (null === children) invokeCallback = !0;else switch (type) {
      case "bigint":
      case "string":
      case "number":
        invokeCallback = !0;
        break;
      case "object":
        switch (children.$$typeof) {
          case REACT_ELEMENT_TYPE:
          case REACT_PORTAL_TYPE:
            invokeCallback = !0;
            break;
          case REACT_LAZY_TYPE:
            return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
        }
    }
    if (invokeCallback) {
      invokeCallback = children;
      callback = callback(invokeCallback);
      var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
      isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function (c) {
        return c;
      })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
      return 1;
    }
    invokeCallback = 0;
    childKey = "" === nameSoFar ? "." : nameSoFar + ":";
    if (isArrayImpl(children)) for (var i = 0; i < children.length; i++) nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);else if (i = getIteratorFn(children), "function" === typeof i) for (i === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = !0), children = i.call(children), i = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);else if ("object" === type) {
      if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
      array = String(children);
      throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
    }
    return invokeCallback;
  }
  function mapChildren(children, func, context) {
    if (null == children) return children;
    var result = [],
      count = 0;
    mapIntoArray(children, result, "", "", function (child) {
      return func.call(context, child, count++);
    });
    return result;
  }
  function lazyInitializer(payload) {
    if (-1 === payload._status) {
      var resolveDebugValue = null,
        rejectDebugValue = null,
        ioInfo = payload._ioInfo;
      null != ioInfo && (ioInfo.start = ioInfo.end = performance.now(), ioInfo.value = new Promise(function (resolve, reject) {
        resolveDebugValue = resolve;
        rejectDebugValue = reject;
      }));
      ioInfo = payload._result;
      var thenable = ioInfo();
      thenable.then(function (moduleObject) {
        if (0 === payload._status || -1 === payload._status) {
          payload._status = 1;
          payload._result = moduleObject;
          var _ioInfo = payload._ioInfo;
          if (null != _ioInfo) {
            _ioInfo.end = performance.now();
            var debugValue = null == moduleObject ? void 0 : moduleObject.default;
            resolveDebugValue(debugValue);
            _ioInfo.value.status = "fulfilled";
            _ioInfo.value.value = debugValue;
          }
          void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
        }
      }, function (error) {
        if (0 === payload._status || -1 === payload._status) {
          payload._status = 2;
          payload._result = error;
          var _ioInfo2 = payload._ioInfo;
          null != _ioInfo2 && (_ioInfo2.end = performance.now(), _ioInfo2.value.then(noop, noop), rejectDebugValue(error), _ioInfo2.value.status = "rejected", _ioInfo2.value.reason = error);
          void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
        }
      });
      ioInfo = payload._ioInfo;
      if (null != ioInfo) {
        var displayName = thenable.displayName;
        "string" === typeof displayName && (ioInfo.name = displayName);
      }
      -1 === payload._status && (payload._status = 0, payload._result = thenable);
    }
    if (1 === payload._status) return ioInfo = payload._result, void 0 === ioInfo && console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", ioInfo), "default" in ioInfo || console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", ioInfo), ioInfo.default;
    throw payload._result;
  }
  function resolveDispatcher() {
    var dispatcher = ReactSharedInternals.H;
    null === dispatcher && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
    return dispatcher;
  }
  function useOptimistic(passthrough, reducer) {
    return resolveDispatcher().useOptimistic(passthrough, reducer);
  }
  function releaseAsyncTransition() {
    ReactSharedInternals.asyncTransitions--;
  }
  function startTransition(scope) {
    var prevTransition = ReactSharedInternals.T,
      currentTransition = {};
    currentTransition.types = null !== prevTransition ? prevTransition.types : null;
    currentTransition.gesture = null;
    currentTransition._updatedFibers = new Set();
    ReactSharedInternals.T = currentTransition;
    try {
      var returnValue = scope(),
        onStartTransitionFinish = ReactSharedInternals.S;
      null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
      "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
    } catch (error) {
      reportGlobalError(error);
    } finally {
      null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
    }
  }
  function addTransitionType(type) {
    var transition = ReactSharedInternals.T;
    if (null !== transition) {
      var transitionTypes = transition.types;
      null === transitionTypes ? transition.types = [type] : -1 === transitionTypes.indexOf(type) && transitionTypes.push(type);
    } else 0 === ReactSharedInternals.asyncTransitions && console.error("addTransitionType can only be called inside a `startTransition()` or `startGestureTransition()` callback. It must be associated with a specific Transition."), startTransition(addTransitionType.bind(null, type));
  }
  function enqueueTask(task) {
    if (null === enqueueTaskImpl) try {
      var requireString = ("require" + Math.random()).slice(0, 7);
      enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
    } catch (_err) {
      enqueueTaskImpl = function (callback) {
        !1 === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = !0, "undefined" === typeof MessageChannel && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/react/react/issues if you encounter this warning."));
        var channel = new MessageChannel();
        channel.port1.onmessage = callback;
        channel.port2.postMessage(void 0);
      };
    }
    return enqueueTaskImpl(task);
  }
  function aggregateErrors(errors) {
    return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
  }
  function popActScope(prevActQueue, prevActScopeDepth) {
    prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
    actScopeDepth = prevActScopeDepth;
  }
  function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
    var queue = ReactSharedInternals.actQueue;
    if (null !== queue) if (0 !== queue.length) try {
      flushActQueue(queue);
      enqueueTask(function () {
        return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
      });
      return;
    } catch (error) {
      ReactSharedInternals.thrownErrors.push(error);
    } else ReactSharedInternals.actQueue = null;
    0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
  }
  function flushActQueue(queue) {
    if (!isFlushing) {
      isFlushing = !0;
      var i = 0;
      try {
        for (; i < queue.length; i++) {
          var callback = queue[i];
          do {
            ReactSharedInternals.didUsePromise = !1;
            var continuation = callback(!1);
            if (null !== continuation) {
              if (ReactSharedInternals.didUsePromise) {
                queue[i] = callback;
                queue.splice(0, i);
                return;
              }
              callback = continuation;
            } else break;
          } while (1);
        }
        queue.length = 0;
      } catch (error) {
        queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
      } finally {
        isFlushing = !1;
      }
    }
  }
  "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
  var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"),
    REACT_PORTAL_TYPE = Symbol.for("react.portal"),
    REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"),
    REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"),
    REACT_PROFILER_TYPE = Symbol.for("react.profiler"),
    REACT_CONSUMER_TYPE = Symbol.for("react.consumer"),
    REACT_CONTEXT_TYPE = Symbol.for("react.context"),
    REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"),
    REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"),
    REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"),
    REACT_MEMO_TYPE = Symbol.for("react.memo"),
    REACT_LAZY_TYPE = Symbol.for("react.lazy"),
    REACT_ACTIVITY_TYPE = Symbol.for("react.activity"),
    REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"),
    MAYBE_ITERATOR_SYMBOL = Symbol.iterator,
    REACT_OPTIMISTIC_KEY = Symbol.for("react.optimistic_key"),
    didWarnStateUpdateForUnmountedComponent = {},
    ReactNoopUpdateQueue = {
      isMounted: function () {
        return !1;
      },
      enqueueForceUpdate: function (publicInstance) {
        warnNoop(publicInstance, "forceUpdate");
      },
      enqueueReplaceState: function (publicInstance) {
        warnNoop(publicInstance, "replaceState");
      },
      enqueueSetState: function (publicInstance) {
        warnNoop(publicInstance, "setState");
      }
    },
    assign = Object.assign,
    emptyObject = {};
  Object.freeze(emptyObject);
  Component.prototype.isReactComponent = {};
  Component.prototype.setState = function (partialState, callback) {
    if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, partialState, callback, "setState");
  };
  Component.prototype.forceUpdate = function (callback) {
    this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
  };
  var deprecatedAPIs = {
    isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
    replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/react/react/issues/3236)."]
  };
  for (fnName in deprecatedAPIs) deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
  ComponentDummy.prototype = Component.prototype;
  deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
  deprecatedAPIs.constructor = PureComponent;
  assign(deprecatedAPIs, Component.prototype);
  deprecatedAPIs.isPureReactComponent = !0;
  var isArrayImpl = Array.isArray,
    REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"),
    ReactSharedInternals = {
      H: null,
      A: null,
      T: null,
      S: null,
      G: null,
      actQueue: null,
      asyncTransitions: 0,
      isBatchingLegacy: !1,
      didScheduleLegacyUpdate: !1,
      didUsePromise: !1,
      thrownErrors: [],
      getCurrentStack: null,
      recentlyCreatedOwnerStacks: 0
    },
    hasOwnProperty = Object.prototype.hasOwnProperty,
    createTask = console.createTask ? console.createTask : function () {
      return null;
    };
  deprecatedAPIs = {
    react_stack_bottom_frame: function (callStackForError) {
      return callStackForError();
    }
  };
  var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
  var didWarnAboutElementRef = {};
  var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(deprecatedAPIs, UnknownOwner)();
  var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
  var didWarnAboutMaps = !1,
    userProvidedKeyEscapeRegex = /\/+/g,
    reportGlobalError = "function" === typeof reportError ? reportError : function (error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: !0,
          cancelable: !0,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error: error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    },
    didWarnAboutMessageChannel = !1,
    enqueueTaskImpl = null,
    actScopeDepth = 0,
    didWarnNoAwaitAct = !1,
    isFlushing = !1,
    queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function (callback) {
      queueMicrotask(function () {
        return queueMicrotask(callback);
      });
    } : enqueueTask;
  deprecatedAPIs = Object.freeze({
    __proto__: null,
    c: function (size) {
      return resolveDispatcher().useMemoCache(size);
    }
  });
  var fnName = {
    map: mapChildren,
    forEach: function (children, forEachFunc, forEachContext) {
      mapChildren(children, function () {
        forEachFunc.apply(this, arguments);
      }, forEachContext);
    },
    count: function (children) {
      var n = 0;
      mapChildren(children, function () {
        n++;
      });
      return n;
    },
    toArray: function (children) {
      return mapChildren(children, function (child) {
        return child;
      }) || [];
    },
    only: function (children) {
      if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
      return children;
    }
  };
  exports.Activity = REACT_ACTIVITY_TYPE;
  exports.Children = fnName;
  exports.Component = Component;
  exports.Fragment = REACT_FRAGMENT_TYPE;
  exports.Profiler = REACT_PROFILER_TYPE;
  exports.PureComponent = PureComponent;
  exports.StrictMode = REACT_STRICT_MODE_TYPE;
  exports.Suspense = REACT_SUSPENSE_TYPE;
  exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE;
  exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
  exports.__COMPILER_RUNTIME = deprecatedAPIs;
  exports.act = function (callback) {
    var prevActQueue = ReactSharedInternals.actQueue,
      prevActScopeDepth = actScopeDepth;
    actScopeDepth++;
    var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [],
      didAwaitActCall = !1;
    try {
      var result = callback();
    } catch (error) {
      ReactSharedInternals.thrownErrors.push(error);
    }
    if (0 < ReactSharedInternals.thrownErrors.length) throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
    if (null !== result && "object" === typeof result && "function" === typeof result.then) {
      var thenable = result;
      queueSeveralMicrotasks(function () {
        didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
      });
      return {
        then: function (resolve, reject) {
          didAwaitActCall = !0;
          thenable.then(function (returnValue) {
            popActScope(prevActQueue, prevActScopeDepth);
            if (0 === prevActScopeDepth) {
              try {
                flushActQueue(queue), enqueueTask(function () {
                  return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                });
              } catch (error$0) {
                ReactSharedInternals.thrownErrors.push(error$0);
              }
              if (0 < ReactSharedInternals.thrownErrors.length) {
                var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
                ReactSharedInternals.thrownErrors.length = 0;
                reject(_thrownError);
              }
            } else resolve(returnValue);
          }, function (error) {
            popActScope(prevActQueue, prevActScopeDepth);
            0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
          });
        }
      };
    }
    var returnValue$jscomp$0 = result;
    popActScope(prevActQueue, prevActScopeDepth);
    0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function () {
      didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
    }), ReactSharedInternals.actQueue = null);
    if (0 < ReactSharedInternals.thrownErrors.length) throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
    return {
      then: function (resolve, reject) {
        didAwaitActCall = !0;
        0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function () {
          return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
        })) : resolve(returnValue$jscomp$0);
      }
    };
  };
  exports.addTransitionType = addTransitionType;
  exports.cache = function (fn) {
    return function () {
      return fn.apply(null, arguments);
    };
  };
  exports.cacheSignal = function () {
    return null;
  };
  exports.captureOwnerStack = function () {
    var getCurrentStack = ReactSharedInternals.getCurrentStack;
    return null === getCurrentStack ? null : getCurrentStack();
  };
  exports.cloneElement = function (element, config, children) {
    if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
    var props = assign({}, element.props),
      key = element.key,
      owner = element._owner;
    if (null != config) {
      var JSCompiler_inline_result;
      a: {
        if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
          JSCompiler_inline_result = !1;
          break a;
        }
        JSCompiler_inline_result = void 0 !== config.ref;
      }
      JSCompiler_inline_result && (owner = getOwner());
      hasValidKey(config) && (config.key === REACT_OPTIMISTIC_KEY ? key = REACT_OPTIMISTIC_KEY : (checkKeyStringCoercion(config.key), key = "" + config.key));
      for (propName in config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
    }
    var propName = arguments.length - 2;
    if (1 === propName) props.children = children;else if (1 < propName) {
      JSCompiler_inline_result = Array(propName);
      for (var i = 0; i < propName; i++) JSCompiler_inline_result[i] = arguments[i + 2];
      props.children = JSCompiler_inline_result;
    }
    props = ReactElement(element.type, key, props, owner, element._debugStack, element._debugTask);
    for (key = 2; key < arguments.length; key++) validateChildKeys(arguments[key]);
    return props;
  };
  exports.createContext = function (defaultValue) {
    defaultValue = {
      $$typeof: REACT_CONTEXT_TYPE,
      _currentValue: defaultValue,
      _currentValue2: defaultValue,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    };
    defaultValue.Provider = defaultValue;
    defaultValue.Consumer = {
      $$typeof: REACT_CONSUMER_TYPE,
      _context: defaultValue
    };
    defaultValue._currentRenderer = null;
    defaultValue._currentRenderer2 = null;
    return defaultValue;
  };
  exports.createElement = function (type, config, children) {
    for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i]);
    var propName;
    i = {};
    var key = null;
    if (null != config) for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = !0, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (config.key === REACT_OPTIMISTIC_KEY ? key = REACT_OPTIMISTIC_KEY : (checkKeyStringCoercion(config.key), key = "" + config.key)), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
    var childrenLength = arguments.length - 2;
    if (1 === childrenLength) i.children = children;else if (1 < childrenLength) {
      for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++) childArray[_i] = arguments[_i + 2];
      Object.freeze && Object.freeze(childArray);
      i.children = childArray;
    }
    if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === i[propName] && (i[propName] = childrenLength[propName]);
    key && defineKeyPropWarningGetter(i, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
    (propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++) ? (childArray = Error.stackTraceLimit, Error.stackTraceLimit = 10, childrenLength = Error("react-stack-top-frame"), Error.stackTraceLimit = childArray) : childrenLength = unknownOwnerDebugStack;
    return ReactElement(type, key, i, getOwner(), childrenLength, propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
  };
  exports.createRef = function () {
    var refObject = {
      current: null
    };
    Object.seal(refObject);
    return refObject;
  };
  exports.experimental_useOptimistic = function (passthrough, reducer) {
    console.error("useOptimistic is now in canary. Remove the experimental_ prefix. The prefixed alias will be removed in an upcoming release.");
    return useOptimistic(passthrough, reducer);
  };
  exports.forwardRef = function (render) {
    null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : "function" !== typeof render ? console.error("forwardRef requires a render function but was given %s.", null === render ? "null" : typeof render) : 0 !== render.length && 2 !== render.length && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", 1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
    null != render && null != render.defaultProps && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
    var elementType = {
        $$typeof: REACT_FORWARD_REF_TYPE,
        render: render
      },
      ownName;
    Object.defineProperty(elementType, "displayName", {
      enumerable: !1,
      configurable: !0,
      get: function () {
        return ownName;
      },
      set: function (name) {
        ownName = name;
        render.name || render.displayName || (Object.defineProperty(render, "name", {
          value: name
        }), render.displayName = name);
      }
    });
    return elementType;
  };
  exports.isValidElement = isValidElement;
  exports.lazy = function (ctor) {
    ctor = {
      _status: -1,
      _result: ctor
    };
    var lazyType = {
        $$typeof: REACT_LAZY_TYPE,
        _payload: ctor,
        _init: lazyInitializer
      },
      ioInfo = {
        name: "lazy",
        start: -1,
        end: -1,
        value: null,
        owner: null,
        debugStack: Error("react-stack-top-frame"),
        debugTask: console.createTask ? console.createTask("lazy()") : null
      };
    ctor._ioInfo = ioInfo;
    lazyType._debugInfo = [{
      awaited: ioInfo
    }];
    return lazyType;
  };
  exports.memo = function (type, compare) {
    null == type && console.error("memo: The first argument must be a component. Instead received: %s", null === type ? "null" : typeof type);
    compare = {
      $$typeof: REACT_MEMO_TYPE,
      type: type,
      compare: void 0 === compare ? null : compare
    };
    var ownName;
    Object.defineProperty(compare, "displayName", {
      enumerable: !1,
      configurable: !0,
      get: function () {
        return ownName;
      },
      set: function (name) {
        ownName = name;
        type.name || type.displayName || (Object.defineProperty(type, "name", {
          value: name
        }), type.displayName = name);
      }
    });
    return compare;
  };
  exports.optimisticKey = REACT_OPTIMISTIC_KEY;
  exports.startTransition = startTransition;
  exports.unstable_SuspenseList = REACT_SUSPENSE_LIST_TYPE;
  exports.unstable_getCacheForType = function (resourceType) {
    var dispatcher = ReactSharedInternals.A;
    return dispatcher ? dispatcher.getCacheForType(resourceType) : resourceType();
  };
  exports.unstable_startGestureTransition = function (provider, scope, options) {
    if (null == provider) throw Error("A Timeline is required as the first argument to startGestureTransition.");
    var prevTransition = ReactSharedInternals.T,
      currentTransition = {
        types: null
      };
    currentTransition.gesture = provider;
    currentTransition._updatedFibers = new Set();
    ReactSharedInternals.T = currentTransition;
    try {
      var returnValue = scope();
      "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && console.error("Cannot use an async function in startGestureTransition. It must be able to start immediately.");
      var onStartGestureTransitionFinish = ReactSharedInternals.G;
      if (null !== onStartGestureTransitionFinish) return onStartGestureTransitionFinish(currentTransition, provider, options);
    } catch (error) {
      reportGlobalError(error);
    } finally {
      ReactSharedInternals.T = prevTransition;
    }
    return noop;
  };
  exports.unstable_useCacheRefresh = function () {
    return resolveDispatcher().useCacheRefresh();
  };
  exports.use = function (usable) {
    return resolveDispatcher().use(usable);
  };
  exports.useActionState = function (action, initialState, permalink) {
    return resolveDispatcher().useActionState(action, initialState, permalink);
  };
  exports.useCallback = function (callback, deps) {
    return resolveDispatcher().useCallback(callback, deps);
  };
  exports.useContext = function (Context) {
    var dispatcher = resolveDispatcher();
    Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
    return dispatcher.useContext(Context);
  };
  exports.useDebugValue = function (value, formatterFn) {
    return resolveDispatcher().useDebugValue(value, formatterFn);
  };
  exports.useDeferredValue = function (value, initialValue) {
    return resolveDispatcher().useDeferredValue(value, initialValue);
  };
  exports.useEffect = function (create, deps) {
    null == create && console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?");
    return resolveDispatcher().useEffect(create, deps);
  };
  exports.useEffectEvent = function (callback) {
    return resolveDispatcher().useEffectEvent(callback);
  };
  exports.useId = function () {
    return resolveDispatcher().useId();
  };
  exports.useImperativeHandle = function (ref, create, deps) {
    return resolveDispatcher().useImperativeHandle(ref, create, deps);
  };
  exports.useInsertionEffect = function (create, deps) {
    null == create && console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?");
    return resolveDispatcher().useInsertionEffect(create, deps);
  };
  exports.useLayoutEffect = function (create, deps) {
    null == create && console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?");
    return resolveDispatcher().useLayoutEffect(create, deps);
  };
  exports.useMemo = function (create, deps) {
    return resolveDispatcher().useMemo(create, deps);
  };
  exports.useOptimistic = useOptimistic;
  exports.useReducer = function (reducer, initialArg, init) {
    return resolveDispatcher().useReducer(reducer, initialArg, init);
  };
  exports.useRef = function (initialValue) {
    return resolveDispatcher().useRef(initialValue);
  };
  exports.useState = function (initialState) {
    return resolveDispatcher().useState(initialState);
  };
  exports.useSyncExternalStore = function (subscribe, getSnapshot, getServerSnapshot) {
    return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  };
  exports.useTransition = function () {
    return resolveDispatcher().useTransition();
  };
  exports.version = "19.3.0-experimental-201454e2-20261023";
  "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
}();

/***/ }),

/***/ "../../build/oss-experimental/react/index.js":
/*!***************************************************!*\
  !*** ../../build/oss-experimental/react/index.js ***!
  \***************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


if (false) {} else {
  module.exports = __webpack_require__(/*! ./cjs/react.development.js */ "../../build/oss-experimental/react/cjs/react.development.js");
}

/***/ }),

/***/ "../../node_modules/compare-versions/lib/esm/index.js":
/*!************************************************************!*\
  !*** ../../node_modules/compare-versions/lib/esm/index.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "compare": () => (/* binding */ compare),
/* harmony export */   "compareVersions": () => (/* binding */ compareVersions),
/* harmony export */   "satisfies": () => (/* binding */ satisfies),
/* harmony export */   "validate": () => (/* binding */ validate)
/* harmony export */ });
const compareVersions = (v1, v2) => {
  const n1 = validateAndParse(v1);
  const n2 = validateAndParse(v2);
  const p1 = n1.pop();
  const p2 = n2.pop();
  const r = compareSegments(n1, n2);
  if (r !== 0) return r;
  if (p1 && p2) {
    return compareSegments(p1.split('.'), p2.split('.'));
  } else if (p1 || p2) {
    return p1 ? -1 : 1;
  }
  return 0;
};
const validate = version => typeof version === 'string' && /^[v\d]/.test(version) && semver.test(version);
const compare = (v1, v2, operator) => {
  assertValidOperator(operator);
  const res = compareVersions(v1, v2);
  return operatorResMap[operator].includes(res);
};
const satisfies = (version, range) => {
  const m = range.match(/^([<>=~^]+)/);
  const op = m ? m[1] : '=';
  if (op !== '^' && op !== '~') return compare(version, range, op);
  const [v1, v2, v3,, vp] = validateAndParse(version);
  const [r1, r2, r3,, rp] = validateAndParse(range);
  const v = [v1, v2, v3];
  const r = [r1, r2 !== null && r2 !== void 0 ? r2 : 'x', r3 !== null && r3 !== void 0 ? r3 : 'x'];
  if (rp) {
    if (!vp) return false;
    if (compareSegments(v, r) !== 0) return false;
    if (compareSegments(vp.split('.'), rp.split('.')) === -1) return false;
  }
  const nonZero = r.findIndex(v => v !== '0') + 1;
  const i = op === '~' ? 2 : nonZero > 1 ? nonZero : 1;
  if (compareSegments(v.slice(0, i), r.slice(0, i)) !== 0) return false;
  if (compareSegments(v.slice(i), r.slice(i)) === -1) return false;
  return true;
};
const semver = /^[v^~<>=]*?(\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+))?(?:-([\da-z\-]+(?:\.[\da-z\-]+)*))?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;
const validateAndParse = version => {
  if (typeof version !== 'string') {
    throw new TypeError('Invalid argument expected string');
  }
  const match = version.match(semver);
  if (!match) {
    throw new Error(`Invalid argument not valid semver ('${version}' received)`);
  }
  match.shift();
  return match;
};
const isWildcard = s => s === '*' || s === 'x' || s === 'X';
const tryParse = v => {
  const n = parseInt(v, 10);
  return isNaN(n) ? v : n;
};
const forceType = (a, b) => typeof a !== typeof b ? [String(a), String(b)] : [a, b];
const compareStrings = (a, b) => {
  if (isWildcard(a) || isWildcard(b)) return 0;
  const [ap, bp] = forceType(tryParse(a), tryParse(b));
  if (ap > bp) return 1;
  if (ap < bp) return -1;
  return 0;
};
const compareSegments = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const r = compareStrings(a[i] || '0', b[i] || '0');
    if (r !== 0) return r;
  }
  return 0;
};
const operatorResMap = {
  '>': [1],
  '>=': [0, 1],
  '=': [0],
  '<=': [-1, 0],
  '<': [-1]
};
const allowedOperators = Object.keys(operatorResMap);
const assertValidOperator = op => {
  if (typeof op !== 'string') {
    throw new TypeError(`Invalid operator type, expected string but got ${typeof op}`);
  }
  if (allowedOperators.indexOf(op) === -1) {
    throw new Error(`Invalid operator, expected one of ${allowedOperators.join('|')}`);
  }
};

/***/ }),

/***/ "../../node_modules/error-stack-parser/error-stack-parser.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/error-stack-parser/error-stack-parser.js ***!
  \*******************************************************************/
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;(function (root, factory) {
  'use strict';

  if (true) {
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(/*! stackframe */ "../../node_modules/stackframe/stackframe.js")], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  } else {}
})(this, function ErrorStackParser(StackFrame) {
  'use strict';

  var FIREFOX_SAFARI_STACK_REGEXP = /(^|@)\S+:\d+/;
  var CHROME_IE_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m;
  var SAFARI_NATIVE_CODE_REGEXP = /^(eval@)?(\[native code])?$/;
  return {
    parse: function ErrorStackParser$$parse(error) {
      if (typeof error.stacktrace !== 'undefined' || typeof error['opera#sourceloc'] !== 'undefined') {
        return this.parseOpera(error);
      } else if (error.stack && error.stack.match(CHROME_IE_STACK_REGEXP)) {
        return this.parseV8OrIE(error);
      } else if (error.stack) {
        return this.parseFFOrSafari(error);
      } else {
        throw new Error('Cannot parse given Error object');
      }
    },
    extractLocation: function ErrorStackParser$$extractLocation(urlLike) {
      if (urlLike.indexOf(':') === -1) {
        return [urlLike];
      }
      var regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/;
      var parts = regExp.exec(urlLike.replace(/[()]/g, ''));
      return [parts[1], parts[2] || undefined, parts[3] || undefined];
    },
    parseV8OrIE: function ErrorStackParser$$parseV8OrIE(error) {
      var filtered = error.stack.split('\n').filter(function (line) {
        return !!line.match(CHROME_IE_STACK_REGEXP);
      }, this);
      return filtered.map(function (line) {
        if (line.indexOf('(eval ') > -1) {
          line = line.replace(/eval code/g, 'eval').replace(/(\(eval at [^()]*)|(\),.*$)/g, '');
        }
        var sanitizedLine = line.replace(/^\s+/, '').replace(/\(eval code/g, '(');
        var location = sanitizedLine.match(/ (\((.+):(\d+):(\d+)\)$)/);
        sanitizedLine = location ? sanitizedLine.replace(location[0], '') : sanitizedLine;
        var tokens = sanitizedLine.split(/\s+/).slice(1);
        var locationParts = this.extractLocation(location ? location[1] : tokens.pop());
        var functionName = tokens.join(' ') || undefined;
        var fileName = ['eval', '<anonymous>'].indexOf(locationParts[0]) > -1 ? undefined : locationParts[0];
        return new StackFrame({
          functionName: functionName,
          fileName: fileName,
          lineNumber: locationParts[1],
          columnNumber: locationParts[2],
          source: line
        });
      }, this);
    },
    parseFFOrSafari: function ErrorStackParser$$parseFFOrSafari(error) {
      var filtered = error.stack.split('\n').filter(function (line) {
        return !line.match(SAFARI_NATIVE_CODE_REGEXP);
      }, this);
      return filtered.map(function (line) {
        if (line.indexOf(' > eval') > -1) {
          line = line.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g, ':$1');
        }
        if (line.indexOf('@') === -1 && line.indexOf(':') === -1) {
          return new StackFrame({
            functionName: line
          });
        } else {
          var functionNameRegex = /((.*".+"[^@]*)?[^@]*)(?:@)/;
          var matches = line.match(functionNameRegex);
          var functionName = matches && matches[1] ? matches[1] : undefined;
          var locationParts = this.extractLocation(line.replace(functionNameRegex, ''));
          return new StackFrame({
            functionName: functionName,
            fileName: locationParts[0],
            lineNumber: locationParts[1],
            columnNumber: locationParts[2],
            source: line
          });
        }
      }, this);
    },
    parseOpera: function ErrorStackParser$$parseOpera(e) {
      if (!e.stacktrace || e.message.indexOf('\n') > -1 && e.message.split('\n').length > e.stacktrace.split('\n').length) {
        return this.parseOpera9(e);
      } else if (!e.stack) {
        return this.parseOpera10(e);
      } else {
        return this.parseOpera11(e);
      }
    },
    parseOpera9: function ErrorStackParser$$parseOpera9(e) {
      var lineRE = /Line (\d+).*script (?:in )?(\S+)/i;
      var lines = e.message.split('\n');
      var result = [];
      for (var i = 2, len = lines.length; i < len; i += 2) {
        var match = lineRE.exec(lines[i]);
        if (match) {
          result.push(new StackFrame({
            fileName: match[2],
            lineNumber: match[1],
            source: lines[i]
          }));
        }
      }
      return result;
    },
    parseOpera10: function ErrorStackParser$$parseOpera10(e) {
      var lineRE = /Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i;
      var lines = e.stacktrace.split('\n');
      var result = [];
      for (var i = 0, len = lines.length; i < len; i += 2) {
        var match = lineRE.exec(lines[i]);
        if (match) {
          result.push(new StackFrame({
            functionName: match[3] || undefined,
            fileName: match[2],
            lineNumber: match[1],
            source: lines[i]
          }));
        }
      }
      return result;
    },
    parseOpera11: function ErrorStackParser$$parseOpera11(error) {
      var filtered = error.stack.split('\n').filter(function (line) {
        return !!line.match(FIREFOX_SAFARI_STACK_REGEXP) && !line.match(/^Error created at/);
      }, this);
      return filtered.map(function (line) {
        var tokens = line.split('@');
        var locationParts = this.extractLocation(tokens.pop());
        var functionCall = tokens.shift() || '';
        var functionName = functionCall.replace(/<anonymous function(: (\w+))?>/, '$2').replace(/\([^)]*\)/g, '') || undefined;
        var argsRaw;
        if (functionCall.match(/\(([^)]*)\)/)) {
          argsRaw = functionCall.replace(/^[^(]+\(([^)]*)\)$/, '$1');
        }
        var args = argsRaw === undefined || argsRaw === '[arguments not available]' ? undefined : argsRaw.split(',');
        return new StackFrame({
          functionName: functionName,
          args: args,
          fileName: locationParts[0],
          lineNumber: locationParts[1],
          columnNumber: locationParts[2],
          source: line
        });
      }, this);
    }
  };
});

/***/ }),

/***/ "../../node_modules/lru-cache/index.js":
/*!*********************************************!*\
  !*** ../../node_modules/lru-cache/index.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


const Yallist = __webpack_require__(/*! yallist */ "../../node_modules/yallist/yallist.js");
const MAX = Symbol('max');
const LENGTH = Symbol('length');
const LENGTH_CALCULATOR = Symbol('lengthCalculator');
const ALLOW_STALE = Symbol('allowStale');
const MAX_AGE = Symbol('maxAge');
const DISPOSE = Symbol('dispose');
const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet');
const LRU_LIST = Symbol('lruList');
const CACHE = Symbol('cache');
const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet');
const naiveLength = () => 1;
class LRUCache {
  constructor(options) {
    if (typeof options === 'number') options = {
      max: options
    };
    if (!options) options = {};
    if (options.max && (typeof options.max !== 'number' || options.max < 0)) throw new TypeError('max must be a non-negative number');
    const max = this[MAX] = options.max || Infinity;
    const lc = options.length || naiveLength;
    this[LENGTH_CALCULATOR] = typeof lc !== 'function' ? naiveLength : lc;
    this[ALLOW_STALE] = options.stale || false;
    if (options.maxAge && typeof options.maxAge !== 'number') throw new TypeError('maxAge must be a number');
    this[MAX_AGE] = options.maxAge || 0;
    this[DISPOSE] = options.dispose;
    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false;
    this.reset();
  }
  set max(mL) {
    if (typeof mL !== 'number' || mL < 0) throw new TypeError('max must be a non-negative number');
    this[MAX] = mL || Infinity;
    trim(this);
  }
  get max() {
    return this[MAX];
  }
  set allowStale(allowStale) {
    this[ALLOW_STALE] = !!allowStale;
  }
  get allowStale() {
    return this[ALLOW_STALE];
  }
  set maxAge(mA) {
    if (typeof mA !== 'number') throw new TypeError('maxAge must be a non-negative number');
    this[MAX_AGE] = mA;
    trim(this);
  }
  get maxAge() {
    return this[MAX_AGE];
  }
  set lengthCalculator(lC) {
    if (typeof lC !== 'function') lC = naiveLength;
    if (lC !== this[LENGTH_CALCULATOR]) {
      this[LENGTH_CALCULATOR] = lC;
      this[LENGTH] = 0;
      this[LRU_LIST].forEach(hit => {
        hit.length = this[LENGTH_CALCULATOR](hit.value, hit.key);
        this[LENGTH] += hit.length;
      });
    }
    trim(this);
  }
  get lengthCalculator() {
    return this[LENGTH_CALCULATOR];
  }
  get length() {
    return this[LENGTH];
  }
  get itemCount() {
    return this[LRU_LIST].length;
  }
  rforEach(fn, thisp) {
    thisp = thisp || this;
    for (let walker = this[LRU_LIST].tail; walker !== null;) {
      const prev = walker.prev;
      forEachStep(this, fn, walker, thisp);
      walker = prev;
    }
  }
  forEach(fn, thisp) {
    thisp = thisp || this;
    for (let walker = this[LRU_LIST].head; walker !== null;) {
      const next = walker.next;
      forEachStep(this, fn, walker, thisp);
      walker = next;
    }
  }
  keys() {
    return this[LRU_LIST].toArray().map(k => k.key);
  }
  values() {
    return this[LRU_LIST].toArray().map(k => k.value);
  }
  reset() {
    if (this[DISPOSE] && this[LRU_LIST] && this[LRU_LIST].length) {
      this[LRU_LIST].forEach(hit => this[DISPOSE](hit.key, hit.value));
    }
    this[CACHE] = new Map();
    this[LRU_LIST] = new Yallist();
    this[LENGTH] = 0;
  }
  dump() {
    return this[LRU_LIST].map(hit => isStale(this, hit) ? false : {
      k: hit.key,
      v: hit.value,
      e: hit.now + (hit.maxAge || 0)
    }).toArray().filter(h => h);
  }
  dumpLru() {
    return this[LRU_LIST];
  }
  set(key, value, maxAge) {
    maxAge = maxAge || this[MAX_AGE];
    if (maxAge && typeof maxAge !== 'number') throw new TypeError('maxAge must be a number');
    const now = maxAge ? Date.now() : 0;
    const len = this[LENGTH_CALCULATOR](value, key);
    if (this[CACHE].has(key)) {
      if (len > this[MAX]) {
        del(this, this[CACHE].get(key));
        return false;
      }
      const node = this[CACHE].get(key);
      const item = node.value;
      if (this[DISPOSE]) {
        if (!this[NO_DISPOSE_ON_SET]) this[DISPOSE](key, item.value);
      }
      item.now = now;
      item.maxAge = maxAge;
      item.value = value;
      this[LENGTH] += len - item.length;
      item.length = len;
      this.get(key);
      trim(this);
      return true;
    }
    const hit = new Entry(key, value, len, now, maxAge);
    if (hit.length > this[MAX]) {
      if (this[DISPOSE]) this[DISPOSE](key, value);
      return false;
    }
    this[LENGTH] += hit.length;
    this[LRU_LIST].unshift(hit);
    this[CACHE].set(key, this[LRU_LIST].head);
    trim(this);
    return true;
  }
  has(key) {
    if (!this[CACHE].has(key)) return false;
    const hit = this[CACHE].get(key).value;
    return !isStale(this, hit);
  }
  get(key) {
    return get(this, key, true);
  }
  peek(key) {
    return get(this, key, false);
  }
  pop() {
    const node = this[LRU_LIST].tail;
    if (!node) return null;
    del(this, node);
    return node.value;
  }
  del(key) {
    del(this, this[CACHE].get(key));
  }
  load(arr) {
    this.reset();
    const now = Date.now();
    for (let l = arr.length - 1; l >= 0; l--) {
      const hit = arr[l];
      const expiresAt = hit.e || 0;
      if (expiresAt === 0) this.set(hit.k, hit.v);else {
        const maxAge = expiresAt - now;
        if (maxAge > 0) {
          this.set(hit.k, hit.v, maxAge);
        }
      }
    }
  }
  prune() {
    this[CACHE].forEach((value, key) => get(this, key, false));
  }
}
const get = (self, key, doUse) => {
  const node = self[CACHE].get(key);
  if (node) {
    const hit = node.value;
    if (isStale(self, hit)) {
      del(self, node);
      if (!self[ALLOW_STALE]) return undefined;
    } else {
      if (doUse) {
        if (self[UPDATE_AGE_ON_GET]) node.value.now = Date.now();
        self[LRU_LIST].unshiftNode(node);
      }
    }
    return hit.value;
  }
};
const isStale = (self, hit) => {
  if (!hit || !hit.maxAge && !self[MAX_AGE]) return false;
  const diff = Date.now() - hit.now;
  return hit.maxAge ? diff > hit.maxAge : self[MAX_AGE] && diff > self[MAX_AGE];
};
const trim = self => {
  if (self[LENGTH] > self[MAX]) {
    for (let walker = self[LRU_LIST].tail; self[LENGTH] > self[MAX] && walker !== null;) {
      const prev = walker.prev;
      del(self, walker);
      walker = prev;
    }
  }
};
const del = (self, node) => {
  if (node) {
    const hit = node.value;
    if (self[DISPOSE]) self[DISPOSE](hit.key, hit.value);
    self[LENGTH] -= hit.length;
    self[CACHE].delete(hit.key);
    self[LRU_LIST].removeNode(node);
  }
};
class Entry {
  constructor(key, value, length, now, maxAge) {
    this.key = key;
    this.value = value;
    this.length = length;
    this.now = now;
    this.maxAge = maxAge || 0;
  }
}
const forEachStep = (self, fn, node, thisp) => {
  let hit = node.value;
  if (isStale(self, hit)) {
    del(self, node);
    if (!self[ALLOW_STALE]) hit = undefined;
  }
  if (hit) fn.call(thisp, hit.value, hit.key, self);
};
module.exports = LRUCache;

/***/ }),

/***/ "../../node_modules/process/browser.js":
/*!*********************************************!*\
  !*** ../../node_modules/process/browser.js ***!
  \*********************************************/
/***/ ((module) => {

var process = module.exports = {};
var cachedSetTimeout;
var cachedClearTimeout;
function defaultSetTimout() {
  throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout() {
  throw new Error('clearTimeout has not been defined');
}
(function () {
  try {
    if (typeof setTimeout === 'function') {
      cachedSetTimeout = setTimeout;
    } else {
      cachedSetTimeout = defaultSetTimout;
    }
  } catch (e) {
    cachedSetTimeout = defaultSetTimout;
  }
  try {
    if (typeof clearTimeout === 'function') {
      cachedClearTimeout = clearTimeout;
    } else {
      cachedClearTimeout = defaultClearTimeout;
    }
  } catch (e) {
    cachedClearTimeout = defaultClearTimeout;
  }
})();
function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    return setTimeout(fun, 0);
  }
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }
  try {
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e) {
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    return clearTimeout(marker);
  }
  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }
  try {
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      return cachedClearTimeout.call(null, marker);
    } catch (e) {
      return cachedClearTimeout.call(this, marker);
    }
  }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }
  draining = false;
  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }
  if (queue.length) {
    drainQueue();
  }
}
function drainQueue() {
  if (draining) {
    return;
  }
  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;
  while (len) {
    currentQueue = queue;
    queue = [];
    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }
    queueIndex = -1;
    len = queue.length;
  }
  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}
process.nextTick = function (fun) {
  var args = new Array(arguments.length - 1);
  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }
  queue.push(new Item(fun, args));
  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
};
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
Item.prototype.run = function () {
  this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = '';
process.versions = {};
function noop() {}
process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;
process.listeners = function (name) {
  return [];
};
process.binding = function (name) {
  throw new Error('process.binding is not supported');
};
process.cwd = function () {
  return '/';
};
process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};
process.umask = function () {
  return 0;
};

/***/ }),

/***/ "../../node_modules/stackframe/stackframe.js":
/*!***************************************************!*\
  !*** ../../node_modules/stackframe/stackframe.js ***!
  \***************************************************/
/***/ (function(module, exports) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;(function (root, factory) {
  'use strict';

  if (true) {
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  } else {}
})(this, function () {
  'use strict';

  function _isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }
  function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
  }
  function _getter(p) {
    return function () {
      return this[p];
    };
  }
  var booleanProps = ['isConstructor', 'isEval', 'isNative', 'isToplevel'];
  var numericProps = ['columnNumber', 'lineNumber'];
  var stringProps = ['fileName', 'functionName', 'source'];
  var arrayProps = ['args'];
  var props = booleanProps.concat(numericProps, stringProps, arrayProps);
  function StackFrame(obj) {
    if (!obj) return;
    for (var i = 0; i < props.length; i++) {
      if (obj[props[i]] !== undefined) {
        this['set' + _capitalize(props[i])](obj[props[i]]);
      }
    }
  }
  StackFrame.prototype = {
    getArgs: function () {
      return this.args;
    },
    setArgs: function (v) {
      if (Object.prototype.toString.call(v) !== '[object Array]') {
        throw new TypeError('Args must be an Array');
      }
      this.args = v;
    },
    getEvalOrigin: function () {
      return this.evalOrigin;
    },
    setEvalOrigin: function (v) {
      if (v instanceof StackFrame) {
        this.evalOrigin = v;
      } else if (v instanceof Object) {
        this.evalOrigin = new StackFrame(v);
      } else {
        throw new TypeError('Eval Origin must be an Object or StackFrame');
      }
    },
    toString: function () {
      var fileName = this.getFileName() || '';
      var lineNumber = this.getLineNumber() || '';
      var columnNumber = this.getColumnNumber() || '';
      var functionName = this.getFunctionName() || '';
      if (this.getIsEval()) {
        if (fileName) {
          return '[eval] (' + fileName + ':' + lineNumber + ':' + columnNumber + ')';
        }
        return '[eval]:' + lineNumber + ':' + columnNumber;
      }
      if (functionName) {
        return functionName + ' (' + fileName + ':' + lineNumber + ':' + columnNumber + ')';
      }
      return fileName + ':' + lineNumber + ':' + columnNumber;
    }
  };
  StackFrame.fromString = function StackFrame$$fromString(str) {
    var argsStartIndex = str.indexOf('(');
    var argsEndIndex = str.lastIndexOf(')');
    var functionName = str.substring(0, argsStartIndex);
    var args = str.substring(argsStartIndex + 1, argsEndIndex).split(',');
    var locationString = str.substring(argsEndIndex + 1);
    if (locationString.indexOf('@') === 0) {
      var parts = /@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(locationString, '');
      var fileName = parts[1];
      var lineNumber = parts[2];
      var columnNumber = parts[3];
    }
    return new StackFrame({
      functionName: functionName,
      args: args || undefined,
      fileName: fileName,
      lineNumber: lineNumber || undefined,
      columnNumber: columnNumber || undefined
    });
  };
  for (var i = 0; i < booleanProps.length; i++) {
    StackFrame.prototype['get' + _capitalize(booleanProps[i])] = _getter(booleanProps[i]);
    StackFrame.prototype['set' + _capitalize(booleanProps[i])] = function (p) {
      return function (v) {
        this[p] = Boolean(v);
      };
    }(booleanProps[i]);
  }
  for (var j = 0; j < numericProps.length; j++) {
    StackFrame.prototype['get' + _capitalize(numericProps[j])] = _getter(numericProps[j]);
    StackFrame.prototype['set' + _capitalize(numericProps[j])] = function (p) {
      return function (v) {
        if (!_isNumber(v)) {
          throw new TypeError(p + ' must be a Number');
        }
        this[p] = Number(v);
      };
    }(numericProps[j]);
  }
  for (var k = 0; k < stringProps.length; k++) {
    StackFrame.prototype['get' + _capitalize(stringProps[k])] = _getter(stringProps[k]);
    StackFrame.prototype['set' + _capitalize(stringProps[k])] = function (p) {
      return function (v) {
        this[p] = String(v);
      };
    }(stringProps[k]);
  }
  return StackFrame;
});

/***/ }),

/***/ "../../node_modules/yallist/iterator.js":
/*!**********************************************!*\
  !*** ../../node_modules/yallist/iterator.js ***!
  \**********************************************/
/***/ ((module) => {

"use strict";


module.exports = function (Yallist) {
  Yallist.prototype[Symbol.iterator] = function* () {
    for (let walker = this.head; walker; walker = walker.next) {
      yield walker.value;
    }
  };
};

/***/ }),

/***/ "../../node_modules/yallist/yallist.js":
/*!*********************************************!*\
  !*** ../../node_modules/yallist/yallist.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


module.exports = Yallist;
Yallist.Node = Node;
Yallist.create = Yallist;
function Yallist(list) {
  var self = this;
  if (!(self instanceof Yallist)) {
    self = new Yallist();
  }
  self.tail = null;
  self.head = null;
  self.length = 0;
  if (list && typeof list.forEach === 'function') {
    list.forEach(function (item) {
      self.push(item);
    });
  } else if (arguments.length > 0) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      self.push(arguments[i]);
    }
  }
  return self;
}
Yallist.prototype.removeNode = function (node) {
  if (node.list !== this) {
    throw new Error('removing node which does not belong to this list');
  }
  var next = node.next;
  var prev = node.prev;
  if (next) {
    next.prev = prev;
  }
  if (prev) {
    prev.next = next;
  }
  if (node === this.head) {
    this.head = next;
  }
  if (node === this.tail) {
    this.tail = prev;
  }
  node.list.length--;
  node.next = null;
  node.prev = null;
  node.list = null;
  return next;
};
Yallist.prototype.unshiftNode = function (node) {
  if (node === this.head) {
    return;
  }
  if (node.list) {
    node.list.removeNode(node);
  }
  var head = this.head;
  node.list = this;
  node.next = head;
  if (head) {
    head.prev = node;
  }
  this.head = node;
  if (!this.tail) {
    this.tail = node;
  }
  this.length++;
};
Yallist.prototype.pushNode = function (node) {
  if (node === this.tail) {
    return;
  }
  if (node.list) {
    node.list.removeNode(node);
  }
  var tail = this.tail;
  node.list = this;
  node.prev = tail;
  if (tail) {
    tail.next = node;
  }
  this.tail = node;
  if (!this.head) {
    this.head = node;
  }
  this.length++;
};
Yallist.prototype.push = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    push(this, arguments[i]);
  }
  return this.length;
};
Yallist.prototype.unshift = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    unshift(this, arguments[i]);
  }
  return this.length;
};
Yallist.prototype.pop = function () {
  if (!this.tail) {
    return undefined;
  }
  var res = this.tail.value;
  this.tail = this.tail.prev;
  if (this.tail) {
    this.tail.next = null;
  } else {
    this.head = null;
  }
  this.length--;
  return res;
};
Yallist.prototype.shift = function () {
  if (!this.head) {
    return undefined;
  }
  var res = this.head.value;
  this.head = this.head.next;
  if (this.head) {
    this.head.prev = null;
  } else {
    this.tail = null;
  }
  this.length--;
  return res;
};
Yallist.prototype.forEach = function (fn, thisp) {
  thisp = thisp || this;
  for (var walker = this.head, i = 0; walker !== null; i++) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.next;
  }
};
Yallist.prototype.forEachReverse = function (fn, thisp) {
  thisp = thisp || this;
  for (var walker = this.tail, i = this.length - 1; walker !== null; i--) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.prev;
  }
};
Yallist.prototype.get = function (n) {
  for (var i = 0, walker = this.head; walker !== null && i < n; i++) {
    walker = walker.next;
  }
  if (i === n && walker !== null) {
    return walker.value;
  }
};
Yallist.prototype.getReverse = function (n) {
  for (var i = 0, walker = this.tail; walker !== null && i < n; i++) {
    walker = walker.prev;
  }
  if (i === n && walker !== null) {
    return walker.value;
  }
};
Yallist.prototype.map = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();
  for (var walker = this.head; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.next;
  }
  return res;
};
Yallist.prototype.mapReverse = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();
  for (var walker = this.tail; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.prev;
  }
  return res;
};
Yallist.prototype.reduce = function (fn, initial) {
  var acc;
  var walker = this.head;
  if (arguments.length > 1) {
    acc = initial;
  } else if (this.head) {
    walker = this.head.next;
    acc = this.head.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }
  for (var i = 0; walker !== null; i++) {
    acc = fn(acc, walker.value, i);
    walker = walker.next;
  }
  return acc;
};
Yallist.prototype.reduceReverse = function (fn, initial) {
  var acc;
  var walker = this.tail;
  if (arguments.length > 1) {
    acc = initial;
  } else if (this.tail) {
    walker = this.tail.prev;
    acc = this.tail.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }
  for (var i = this.length - 1; walker !== null; i--) {
    acc = fn(acc, walker.value, i);
    walker = walker.prev;
  }
  return acc;
};
Yallist.prototype.toArray = function () {
  var arr = new Array(this.length);
  for (var i = 0, walker = this.head; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.next;
  }
  return arr;
};
Yallist.prototype.toArrayReverse = function () {
  var arr = new Array(this.length);
  for (var i = 0, walker = this.tail; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.prev;
  }
  return arr;
};
Yallist.prototype.slice = function (from, to) {
  to = to || this.length;
  if (to < 0) {
    to += this.length;
  }
  from = from || 0;
  if (from < 0) {
    from += this.length;
  }
  var ret = new Yallist();
  if (to < from || to < 0) {
    return ret;
  }
  if (from < 0) {
    from = 0;
  }
  if (to > this.length) {
    to = this.length;
  }
  for (var i = 0, walker = this.head; walker !== null && i < from; i++) {
    walker = walker.next;
  }
  for (; walker !== null && i < to; i++, walker = walker.next) {
    ret.push(walker.value);
  }
  return ret;
};
Yallist.prototype.sliceReverse = function (from, to) {
  to = to || this.length;
  if (to < 0) {
    to += this.length;
  }
  from = from || 0;
  if (from < 0) {
    from += this.length;
  }
  var ret = new Yallist();
  if (to < from || to < 0) {
    return ret;
  }
  if (from < 0) {
    from = 0;
  }
  if (to > this.length) {
    to = this.length;
  }
  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
    walker = walker.prev;
  }
  for (; walker !== null && i > from; i--, walker = walker.prev) {
    ret.push(walker.value);
  }
  return ret;
};
Yallist.prototype.splice = function (start, deleteCount) {
  if (start > this.length) {
    start = this.length - 1;
  }
  if (start < 0) {
    start = this.length + start;
  }
  for (var i = 0, walker = this.head; walker !== null && i < start; i++) {
    walker = walker.next;
  }
  var ret = [];
  for (var i = 0; walker && i < deleteCount; i++) {
    ret.push(walker.value);
    walker = this.removeNode(walker);
  }
  if (walker === null) {
    walker = this.tail;
  }
  if (walker !== this.head && walker !== this.tail) {
    walker = walker.prev;
  }
  for (var i = 2; i < arguments.length; i++) {
    walker = insert(this, walker, arguments[i]);
  }
  return ret;
};
Yallist.prototype.reverse = function () {
  var head = this.head;
  var tail = this.tail;
  for (var walker = head; walker !== null; walker = walker.prev) {
    var p = walker.prev;
    walker.prev = walker.next;
    walker.next = p;
  }
  this.head = tail;
  this.tail = head;
  return this;
};
function insert(self, node, value) {
  var inserted = node === self.head ? new Node(value, null, node, self) : new Node(value, node, node.next, self);
  if (inserted.next === null) {
    self.tail = inserted;
  }
  if (inserted.prev === null) {
    self.head = inserted;
  }
  self.length++;
  return inserted;
}
function push(self, item) {
  self.tail = new Node(item, self.tail, null, self);
  if (!self.head) {
    self.head = self.tail;
  }
  self.length++;
}
function unshift(self, item) {
  self.head = new Node(item, null, self.head, self);
  if (!self.tail) {
    self.tail = self.head;
  }
  self.length++;
}
function Node(value, prev, next, list) {
  if (!(this instanceof Node)) {
    return new Node(value, prev, next, list);
  }
  this.list = list;
  this.value = value;
  if (prev) {
    prev.next = this;
    this.prev = prev;
  } else {
    this.prev = null;
  }
  if (next) {
    next.prev = this;
    this.next = next;
  } else {
    this.next = null;
  }
}
try {
  __webpack_require__(/*! ./iterator.js */ "../../node_modules/yallist/iterator.js")(Yallist);
} catch (er) {}

/***/ }),

/***/ "./src/contentScripts/messages.js":
/*!****************************************!*\
  !*** ./src/contentScripts/messages.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "postMessage": () => (/* binding */ postMessage)
/* harmony export */ });
function postMessage(event) {
  window.postMessage(event);
}

/***/ }),

/***/ "./src/contentScripts/reactBuildType.js":
/*!**********************************************!*\
  !*** ./src/contentScripts/reactBuildType.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createReactRendererListener": () => (/* binding */ createReactRendererListener)
/* harmony export */ });
function reduceReactBuild(currentReactBuildType, nextReactBuildType) {
  if (currentReactBuildType === null || currentReactBuildType === 'production') {
    return nextReactBuildType;
  }
  return nextReactBuildType === 'production' ? currentReactBuildType : nextReactBuildType;
}
function createReactRendererListener(target) {
  let displayedReactBuild = null;
  return function ({
    reactBuildType
  }) {
    displayedReactBuild = reduceReactBuild(displayedReactBuild, reactBuildType);
    target.postMessage({
      source: 'react-devtools-hook',
      payload: {
        type: 'react-renderer-attached',
        reactBuildType: displayedReactBuild
      }
    }, '*');
  };
}

/***/ }),

/***/ "../react-devtools-shared/src/attachRenderer.js":
/*!******************************************************!*\
  !*** ../react-devtools-shared/src/attachRenderer.js ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ attachRenderer)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_backend_flight_renderer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/backend/flight/renderer */ "../react-devtools-shared/src/backend/flight/renderer.js");
/* harmony import */ var react_devtools_shared_src_backend_fiber_renderer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-devtools-shared/src/backend/fiber/renderer */ "../react-devtools-shared/src/backend/fiber/renderer.js");
/* harmony import */ var react_devtools_shared_src_backend_legacy_renderer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-devtools-shared/src/backend/legacy/renderer */ "../react-devtools-shared/src/backend/legacy/renderer.js");
/* harmony import */ var react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");




function isMatchingRender(version) {
  return !(0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_3__.hasAssignedBackend)(version);
}
function attachRenderer(hook, id, renderer, global, shouldStartProfilingNow, profilingSettings, componentFiltersOrComponentFiltersPromise) {
  if (!isMatchingRender(renderer.reconcilerVersion || renderer.version)) {
    return;
  }
  let rendererInterface = hook.rendererInterfaces.get(id);
  if (rendererInterface == null) {
    if (typeof renderer.getCurrentComponentInfo === 'function') {
      rendererInterface = (0,react_devtools_shared_src_backend_flight_renderer__WEBPACK_IMPORTED_MODULE_0__.attach)(hook, id, renderer, global);
    } else if (typeof renderer.findFiberByHostInstance === 'function' || renderer.currentDispatcherRef != null) {
      rendererInterface = (0,react_devtools_shared_src_backend_fiber_renderer__WEBPACK_IMPORTED_MODULE_1__.attach)(hook, id, renderer, global, shouldStartProfilingNow, profilingSettings, componentFiltersOrComponentFiltersPromise);
    } else if (renderer.ComponentTree) {
      rendererInterface = (0,react_devtools_shared_src_backend_legacy_renderer__WEBPACK_IMPORTED_MODULE_2__.attach)(hook, id, renderer, global);
    } else {}
  }
  return rendererInterface;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/DevToolsNativeHost.js":
/*!******************************************************************!*\
  !*** ../react-devtools-shared/src/backend/DevToolsNativeHost.js ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getCurrentTime": () => (/* binding */ getCurrentTime),
/* harmony export */   "getNativeTag": () => (/* binding */ getNativeTag),
/* harmony export */   "getPublicInstance": () => (/* binding */ getPublicInstance)
/* harmony export */ });
const getCurrentTime = typeof performance === 'object' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();
function getPublicInstance(instance) {
  if (typeof instance === 'object' && instance !== null) {
    if (typeof instance.canonical === 'object' && instance.canonical !== null) {
      if (typeof instance.canonical.publicInstance === 'object' && instance.canonical.publicInstance !== null) {
        return instance.canonical.publicInstance;
      }
    }
    if (typeof instance._nativeTag === 'number') {
      return instance._nativeTag;
    }
  }
  return instance;
}
function getNativeTag(instance) {
  if (typeof instance !== 'object' || instance === null) {
    return null;
  }
  if (instance.canonical != null && typeof instance.canonical.nativeTag === 'number') {
    return instance.canonical.nativeTag;
  }
  if (typeof instance._nativeTag === 'number') {
    return instance._nativeTag;
  }
  return null;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/StyleX/utils.js":
/*!************************************************************!*\
  !*** ../react-devtools-shared/src/backend/StyleX/utils.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "crawlData": () => (/* binding */ crawlData),
/* harmony export */   "getStyleXData": () => (/* binding */ getStyleXData)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/isArray */ "../react-devtools-shared/src/isArray.js");

const cachedStyleNameToValueMap = new Map();
function getStyleXData(data) {
  const sources = new Set();
  const resolvedStyles = {};
  crawlData(data, sources, resolvedStyles);
  return {
    sources: Array.from(sources).sort(),
    resolvedStyles
  };
}
function crawlData(data, sources, resolvedStyles) {
  if (data == null) {
    return;
  }
  if ((0,react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_0__["default"])(data)) {
    data.forEach(entry => {
      if (entry == null) {
        return;
      }
      if ((0,react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_0__["default"])(entry)) {
        crawlData(entry, sources, resolvedStyles);
      } else {
        crawlObjectProperties(entry, sources, resolvedStyles);
      }
    });
  } else {
    crawlObjectProperties(data, sources, resolvedStyles);
  }
  resolvedStyles = Object.fromEntries(Object.entries(resolvedStyles).sort());
}
function crawlObjectProperties(entry, sources, resolvedStyles) {
  const keys = Object.keys(entry);
  keys.forEach(key => {
    const value = entry[key];
    if (typeof value === 'string') {
      if (key === value) {
        sources.add(key);
      } else {
        const propertyValue = getPropertyValueForStyleName(value);
        if (propertyValue != null) {
          resolvedStyles[key] = propertyValue;
        }
      }
    } else {
      const nestedStyle = {};
      resolvedStyles[key] = nestedStyle;
      crawlData([value], sources, nestedStyle);
    }
  });
}
function getPropertyValueForStyleName(styleName) {
  if (cachedStyleNameToValueMap.has(styleName)) {
    return cachedStyleNameToValueMap.get(styleName);
  }
  for (let styleSheetIndex = 0; styleSheetIndex < document.styleSheets.length; styleSheetIndex++) {
    const styleSheet = document.styleSheets[styleSheetIndex];
    let rules = null;
    try {
      rules = styleSheet.cssRules;
    } catch (_e) {
      continue;
    }
    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
      if (!(rules[ruleIndex] instanceof CSSStyleRule)) {
        continue;
      }
      const rule = rules[ruleIndex];
      const {
        cssText,
        selectorText,
        style
      } = rule;
      if (selectorText != null) {
        if (selectorText.startsWith(`.${styleName}`)) {
          const match = cssText.match(/{ *([a-z\-]+):/);
          if (match !== null) {
            const property = match[1];
            const value = style.getPropertyValue(property);
            cachedStyleNameToValueMap.set(styleName, value);
            return value;
          } else {
            return null;
          }
        }
      }
    }
  }
  return null;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/fiber/DevToolsFiberComponentStack.js":
/*!*********************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/fiber/DevToolsFiberComponentStack.js ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "describeFiber": () => (/* binding */ describeFiber),
/* harmony export */   "getOwnerStackByFiberInDev": () => (/* binding */ getOwnerStackByFiberInDev),
/* harmony export */   "getSourceLocationByFiber": () => (/* binding */ getSourceLocationByFiber),
/* harmony export */   "getStackByFiberInDevAndProd": () => (/* binding */ getStackByFiberInDevAndProd),
/* harmony export */   "supportsConsoleTasks": () => (/* binding */ supportsConsoleTasks),
/* harmony export */   "supportsOwnerStacks": () => (/* binding */ supportsOwnerStacks)
/* harmony export */ });
/* harmony import */ var _shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/DevToolsComponentStackFrame */ "../react-devtools-shared/src/backend/shared/DevToolsComponentStackFrame.js");
/* harmony import */ var _shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/DevToolsOwnerStack */ "../react-devtools-shared/src/backend/shared/DevToolsOwnerStack.js");


function describeFiber(workTagMap, workInProgress, currentDispatcherRef) {
  const {
    HostHoistable,
    HostSingleton,
    HostComponent,
    LazyComponent,
    SuspenseComponent,
    SuspenseListComponent,
    FunctionComponent,
    IndeterminateComponent,
    SimpleMemoComponent,
    ForwardRef,
    ClassComponent,
    ViewTransitionComponent,
    ActivityComponent
  } = workTagMap;
  switch (workInProgress.tag) {
    case HostHoistable:
    case HostSingleton:
    case HostComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)(workInProgress.type);
    case LazyComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('Lazy');
    case SuspenseComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('Suspense');
    case SuspenseListComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('SuspenseList');
    case ViewTransitionComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('ViewTransition');
    case ActivityComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('Activity');
    case FunctionComponent:
    case IndeterminateComponent:
    case SimpleMemoComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeFunctionComponentFrame)(workInProgress.type, currentDispatcherRef);
    case ForwardRef:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeFunctionComponentFrame)(workInProgress.type.render, currentDispatcherRef);
    case ClassComponent:
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeClassComponentFrame)(workInProgress.type, currentDispatcherRef);
    default:
      return '';
  }
}
function getStackByFiberInDevAndProd(workTagMap, workInProgress, currentDispatcherRef) {
  try {
    let info = '';
    let node = workInProgress;
    do {
      info += describeFiber(workTagMap, node, currentDispatcherRef);
      const debugInfo = node._debugInfo;
      if (debugInfo) {
        for (let i = debugInfo.length - 1; i >= 0; i--) {
          const entry = debugInfo[i];
          if (typeof entry.name === 'string') {
            info += (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeDebugInfoFrame)(entry.name, entry.env);
          }
        }
      }
      node = node.return;
    } while (node);
    return info;
  } catch (x) {
    return '\nError generating stack: ' + x.message + '\n' + x.stack;
  }
}
function getSourceLocationByFiber(workTagMap, fiber, currentDispatcherRef) {
  try {
    const info = describeFiber(workTagMap, fiber, currentDispatcherRef);
    if (info !== '') {
      return info.slice(1);
    }
  } catch (x) {
    console.error(x);
  }
  return null;
}
function supportsConsoleTasks(fiber) {
  return !!fiber._debugTask;
}
function supportsOwnerStacks(fiber) {
  return fiber._debugStack !== undefined;
}
function getOwnerStackByFiberInDev(workTagMap, workInProgress, currentDispatcherRef) {
  const {
    HostHoistable,
    HostSingleton,
    HostText,
    HostComponent,
    SuspenseComponent,
    SuspenseListComponent,
    ViewTransitionComponent,
    ActivityComponent
  } = workTagMap;
  try {
    let info = '';
    if (workInProgress.tag === HostText) {
      workInProgress = workInProgress.return;
    }
    switch (workInProgress.tag) {
      case HostHoistable:
      case HostSingleton:
      case HostComponent:
        info += (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)(workInProgress.type);
        break;
      case SuspenseComponent:
        info += (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('Suspense');
        break;
      case SuspenseListComponent:
        info += (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('SuspenseList');
        break;
      case ViewTransitionComponent:
        info += (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('ViewTransition');
        break;
      case ActivityComponent:
        info += (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)('Activity');
        break;
    }
    let owner = workInProgress;
    while (owner) {
      if (typeof owner.tag === 'number') {
        const fiber = owner;
        owner = fiber._debugOwner;
        let debugStack = fiber._debugStack;
        if (owner && debugStack) {
          if (typeof debugStack !== 'string') {
            debugStack = (0,_shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_1__.formatOwnerStack)(debugStack);
          }
          if (debugStack !== '') {
            info += '\n' + debugStack;
          }
        }
      } else if (owner.debugStack != null) {
        const ownerStack = owner.debugStack;
        owner = owner.owner;
        if (owner && ownerStack) {
          info += '\n' + (0,_shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_1__.formatOwnerStack)(ownerStack);
        }
      } else {
        break;
      }
    }
    return info;
  } catch (x) {
    return '\nError generating stack: ' + x.message + '\n' + x.stack;
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/fiber/renderer.js":
/*!**************************************************************!*\
  !*** ../react-devtools-shared/src/backend/fiber/renderer.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "attach": () => (/* binding */ attach)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/frontend/types */ "../react-devtools-shared/src/frontend/types.js");
/* harmony import */ var react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-devtools-shared/src/utils */ "../react-devtools-shared/src/utils.js");
/* harmony import */ var react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils */ "../react-devtools-shared/src/backend/utils/index.js");
/* harmony import */ var react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils/parseStackTrace */ "../react-devtools-shared/src/backend/utils/parseStackTrace.js");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../constants */ "../react-devtools-shared/src/constants.js");
/* harmony import */ var react_debug_tools__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-debug-tools */ "../../build/oss-experimental/react-debug-tools/index.js");
/* harmony import */ var _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../shared/ReactSymbols */ "../react-devtools-shared/src/backend/shared/ReactSymbols.js");
/* harmony import */ var react_devtools_feature_flags__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react-devtools-feature-flags */ "../react-devtools-shared/src/config/DevToolsFeatureFlags.extension-oss.js");
/* harmony import */ var _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../shared/DevToolsServerComponentLogs */ "../react-devtools-shared/src/backend/shared/DevToolsServerComponentLogs.js");
/* harmony import */ var shared_ReactIODescription__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! shared/ReactIODescription */ "../shared/ReactIODescription.js");
/* harmony import */ var react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! react-devtools-shared/src/backend/DevToolsNativeHost */ "../react-devtools-shared/src/backend/DevToolsNativeHost.js");
/* harmony import */ var _shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./shared/DevToolsFiberInspection */ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInspection.js");
/* harmony import */ var _shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./shared/DevToolsFiberChangeDetection */ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberChangeDetection.js");
/* harmony import */ var _shared_DevToolsFiberInternalReactConstants__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./shared/DevToolsFiberInternalReactConstants */ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInternalReactConstants.js");
/* harmony import */ var _shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./shared/DevToolsFiberSuspense */ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberSuspense.js");
/* harmony import */ var _DevToolsFiberComponentStack__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./DevToolsFiberComponentStack */ "../react-devtools-shared/src/backend/fiber/DevToolsFiberComponentStack.js");
/* harmony import */ var _StyleX_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../StyleX/utils */ "../react-devtools-shared/src/backend/StyleX/utils.js");
/* harmony import */ var _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./shared/DevToolsFiberTypes */ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberTypes.js");
/* harmony import */ var _shared_DevToolsReactDispatcher__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../shared/DevToolsReactDispatcher */ "../react-devtools-shared/src/backend/shared/DevToolsReactDispatcher.js");
/* harmony import */ var _shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../shared/DevToolsOwnerStack */ "../react-devtools-shared/src/backend/shared/DevToolsOwnerStack.js");






















function createFiberInstance(fiber) {
  return {
    kind: _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE,
    id: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getUID)(),
    parent: null,
    firstChild: null,
    nextSibling: null,
    source: null,
    logCount: 0,
    treeBaseDuration: 0,
    suspendedBy: null,
    suspenseNode: null,
    data: fiber
  };
}
function createFilteredFiberInstance(fiber) {
  return {
    kind: _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE,
    id: 0,
    parent: null,
    firstChild: null,
    nextSibling: null,
    source: null,
    logCount: 0,
    treeBaseDuration: 0,
    suspendedBy: null,
    suspenseNode: null,
    data: fiber
  };
}
function createVirtualInstance(debugEntry) {
  return {
    kind: _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE,
    id: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getUID)(),
    parent: null,
    firstChild: null,
    nextSibling: null,
    source: null,
    logCount: 0,
    treeBaseDuration: 0,
    suspendedBy: null,
    suspenseNode: null,
    data: debugEntry
  };
}
const NoUpdate = 0b000;
const ShouldResetChildren = 0b001;
const ShouldResetSuspenseChildren = 0b010;
const ShouldResetParentSuspenseChildren = 0b100;
function createSuspenseNode(instance) {
  return instance.suspenseNode = {
    instance: instance,
    parent: null,
    firstChild: null,
    nextSibling: null,
    rects: null,
    suspendedBy: new Map(),
    environments: new Map(),
    endTime: 0,
    hasUniqueSuspenders: false,
    hasUnknownSuspenders: false
  };
}
const knownEnvironmentNames = new Set();
const rootToFiberInstanceMap = new Map();
const idToDevToolsInstanceMap = new Map();
let focusedActivityID = null;
let focusedActivity = null;
const idToSuspenseNodeMap = new Map();
const publicInstanceToDevToolsInstanceMap = new Map();
const hostResourceToDevToolsInstanceMap = new Map();
function aquireHostInstance(nearestInstance, hostInstance) {
  const publicInstance = (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getPublicInstance)(hostInstance);
  publicInstanceToDevToolsInstanceMap.set(publicInstance, nearestInstance);
}
function releaseHostInstance(nearestInstance, hostInstance) {
  const publicInstance = (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getPublicInstance)(hostInstance);
  if (publicInstanceToDevToolsInstanceMap.get(publicInstance) === nearestInstance) {
    publicInstanceToDevToolsInstanceMap.delete(publicInstance);
  }
}
function aquireHostResource(nearestInstance, resource) {
  const hostInstance = resource && resource.instance;
  if (hostInstance) {
    const publicInstance = (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getPublicInstance)(hostInstance);
    let resourceInstances = hostResourceToDevToolsInstanceMap.get(publicInstance);
    if (resourceInstances === undefined) {
      resourceInstances = new Set();
      hostResourceToDevToolsInstanceMap.set(publicInstance, resourceInstances);
      publicInstanceToDevToolsInstanceMap.set(publicInstance, nearestInstance);
    }
    resourceInstances.add(nearestInstance);
  }
}
function releaseHostResource(nearestInstance, resource) {
  const hostInstance = resource && resource.instance;
  if (hostInstance) {
    const publicInstance = (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getPublicInstance)(hostInstance);
    const resourceInstances = hostResourceToDevToolsInstanceMap.get(publicInstance);
    if (resourceInstances !== undefined) {
      resourceInstances.delete(nearestInstance);
      if (resourceInstances.size === 0) {
        hostResourceToDevToolsInstanceMap.delete(publicInstance);
        publicInstanceToDevToolsInstanceMap.delete(publicInstance);
      } else if (publicInstanceToDevToolsInstanceMap.get(publicInstance) === nearestInstance) {
        for (const firstInstance of resourceInstances) {
          publicInstanceToDevToolsInstanceMap.set(publicInstance, firstInstance);
          break;
        }
      }
    }
  }
}
function attach(hook, rendererID, renderer, global, shouldStartProfilingNow, profilingSettings, componentFiltersOrComponentFiltersPromise) {
  const version = renderer.reconcilerVersion || renderer.version;
  const {
    getDisplayNameForFiber,
    getTypeSymbol,
    ReactPriorityLevels,
    ReactTypeOfWork,
    StrictModeBits,
    SuspenseyImagesMode
  } = (0,_shared_DevToolsFiberInternalReactConstants__WEBPACK_IMPORTED_MODULE_13__.getInternalReactConstants)(version);
  const {
    ActivityComponent,
    ClassComponent,
    DehydratedSuspenseComponent,
    ForwardRef,
    Fragment,
    FunctionComponent,
    HostRoot,
    HostHoistable,
    HostSingleton,
    HostPortal,
    HostComponent,
    HostText,
    IncompleteClassComponent,
    IncompleteFunctionComponent,
    IndeterminateComponent,
    LegacyHiddenComponent,
    MemoComponent,
    OffscreenComponent,
    SimpleMemoComponent,
    SuspenseComponent,
    SuspenseListComponent,
    TracingMarkerComponent,
    Throw,
    ViewTransitionComponent
  } = ReactTypeOfWork;
  const {
    ImmediatePriority,
    UserBlockingPriority,
    NormalPriority,
    LowPriority,
    IdlePriority,
    NoPriority
  } = ReactPriorityLevels;
  const {
    overrideHookState,
    overrideHookStateDeletePath,
    overrideHookStateRenamePath,
    overrideProps,
    overridePropsDeletePath,
    overridePropsRenamePath,
    scheduleRefresh,
    setErrorHandler,
    setSuspenseHandler,
    scheduleUpdate,
    scheduleRetry,
    getCurrentFiber
  } = renderer;
  const supportsTogglingError = typeof setErrorHandler === 'function' && typeof scheduleUpdate === 'function';
  const supportsTogglingSuspense = typeof setSuspenseHandler === 'function' && typeof scheduleUpdate === 'function';
  const supportsPerformanceTracks = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.gte)(version, '19.2.0');
  if (typeof scheduleRefresh === 'function') {
    renderer.scheduleRefresh = (...args) => {
      try {
        hook.emit('fastRefreshScheduled');
      } finally {
        return scheduleRefresh(...args);
      }
    };
  }
  const fiberToComponentLogsMap = new WeakMap();
  let needsToFlushComponentLogs = false;
  function bruteForceFlushErrorsAndWarnings(root) {
    let hasChanges = false;
    for (const devtoolsInstance of idToDevToolsInstanceMap.values()) {
      if (devtoolsInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
        const fiber = devtoolsInstance.data;
        const componentLogsEntry = fiberToComponentLogsMap.get(fiber);
        const changed = recordConsoleLogs(devtoolsInstance, componentLogsEntry);
        if (changed) {
          hasChanges = true;
          updateMostRecentlyInspectedElementIfNecessary(devtoolsInstance.id);
        }
      } else {}
    }
    if (hasChanges) {
      flushPendingEvents(root);
    }
  }
  function clearErrorsAndWarnings() {
    for (const devtoolsInstance of idToDevToolsInstanceMap.values()) {
      if (devtoolsInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
        const fiber = devtoolsInstance.data;
        fiberToComponentLogsMap.delete(fiber);
        if (fiber.alternate) {
          fiberToComponentLogsMap.delete(fiber.alternate);
        }
      } else {
        _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_8__.componentInfoToComponentLogsMap["delete"](devtoolsInstance.data);
      }
      const changed = recordConsoleLogs(devtoolsInstance, undefined);
      if (changed) {
        updateMostRecentlyInspectedElementIfNecessary(devtoolsInstance.id);
      }
    }
    flushPendingEvents(null);
  }
  function clearConsoleLogsHelper(instanceID, type) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(instanceID);
    if (devtoolsInstance !== undefined) {
      let componentLogsEntry;
      if (devtoolsInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
        const fiber = devtoolsInstance.data;
        componentLogsEntry = fiberToComponentLogsMap.get(fiber);
        if (componentLogsEntry === undefined && fiber.alternate !== null) {
          componentLogsEntry = fiberToComponentLogsMap.get(fiber.alternate);
        }
      } else {
        const componentInfo = devtoolsInstance.data;
        componentLogsEntry = _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_8__.componentInfoToComponentLogsMap.get(componentInfo);
      }
      if (componentLogsEntry !== undefined) {
        if (type === 'error') {
          componentLogsEntry.errors.clear();
          componentLogsEntry.errorsCount = 0;
        } else {
          componentLogsEntry.warnings.clear();
          componentLogsEntry.warningsCount = 0;
        }
        const changed = recordConsoleLogs(devtoolsInstance, componentLogsEntry);
        if (changed) {
          flushPendingEvents(null);
          updateMostRecentlyInspectedElementIfNecessary(devtoolsInstance.id);
        }
      }
    }
  }
  function clearErrorsForElementID(instanceID) {
    clearConsoleLogsHelper(instanceID, 'error');
  }
  function clearWarningsForElementID(instanceID) {
    clearConsoleLogsHelper(instanceID, 'warn');
  }
  function updateMostRecentlyInspectedElementIfNecessary(fiberID) {
    if (mostRecentlyInspectedElement !== null && mostRecentlyInspectedElement.id === fiberID) {
      hasElementUpdatedSinceLastInspected = true;
    }
  }
  function getComponentStack(topFrame) {
    if (getCurrentFiber == null) {
      return null;
    }
    const current = getCurrentFiber();
    if (current === null) {
      return null;
    }
    if ((0,_DevToolsFiberComponentStack__WEBPACK_IMPORTED_MODULE_15__.supportsConsoleTasks)(current)) {
      return null;
    }
    const dispatcherRef = (0,_shared_DevToolsReactDispatcher__WEBPACK_IMPORTED_MODULE_18__.getDispatcherRef)(renderer);
    if (dispatcherRef === undefined) {
      return null;
    }
    const enableOwnerStacks = (0,_DevToolsFiberComponentStack__WEBPACK_IMPORTED_MODULE_15__.supportsOwnerStacks)(current);
    let componentStack = '';
    if (enableOwnerStacks) {
      const topStackFrames = (0,_shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_19__.formatOwnerStack)(topFrame);
      if (topStackFrames) {
        componentStack += '\n' + topStackFrames;
      }
      componentStack += (0,_DevToolsFiberComponentStack__WEBPACK_IMPORTED_MODULE_15__.getOwnerStackByFiberInDev)(ReactTypeOfWork, current, dispatcherRef);
    } else {
      componentStack = (0,_DevToolsFiberComponentStack__WEBPACK_IMPORTED_MODULE_15__.getStackByFiberInDevAndProd)(ReactTypeOfWork, current, dispatcherRef);
    }
    return {
      enableOwnerStacks,
      componentStack
    };
  }
  function onErrorOrWarning(type, args) {
    if (getCurrentFiber == null) {
      return;
    }
    const fiber = getCurrentFiber();
    if (fiber === null) {
      return;
    }
    if (type === 'error') {
      if (forceErrorForFibers.get(fiber) === true || fiber.alternate !== null && forceErrorForFibers.get(fiber.alternate) === true) {
        return;
      }
    }
    const message = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.formatConsoleArgumentsToSingleString)(...args);
    let componentLogsEntry = fiberToComponentLogsMap.get(fiber);
    if (componentLogsEntry === undefined && fiber.alternate !== null) {
      componentLogsEntry = fiberToComponentLogsMap.get(fiber.alternate);
      if (componentLogsEntry !== undefined) {
        fiberToComponentLogsMap.set(fiber, componentLogsEntry);
      }
    }
    if (componentLogsEntry === undefined) {
      componentLogsEntry = {
        errors: new Map(),
        errorsCount: 0,
        warnings: new Map(),
        warningsCount: 0
      };
      fiberToComponentLogsMap.set(fiber, componentLogsEntry);
    }
    const messageMap = type === 'error' ? componentLogsEntry.errors : componentLogsEntry.warnings;
    const count = messageMap.get(message) || 0;
    messageMap.set(message, count + 1);
    if (type === 'error') {
      componentLogsEntry.errorsCount++;
    } else {
      componentLogsEntry.warningsCount++;
    }
    needsToFlushComponentLogs = true;
  }
  function debug(name, instance, parentInstance, extraString = '') {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      const displayName = instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE ? instance.data.name || 'null' : instance.data.tag + ':' + (getDisplayNameForFiber(instance.data) || 'null');
      const maybeID = instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE ? '<no id>' : instance.id;
      const parentDisplayName = parentInstance === null ? '' : parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE ? parentInstance.data.name || 'null' : parentInstance.data.tag + ':' + (getDisplayNameForFiber(parentInstance.data) || 'null');
      const maybeParentID = parentInstance === null || parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE ? '<no id>' : parentInstance.id;
      console.groupCollapsed(`[renderer] %c${name} %c${displayName} (${maybeID}) %c${parentInstance ? `${parentDisplayName} (${maybeParentID})` : ''} %c${extraString}`, 'color: red; font-weight: bold;', 'color: blue;', 'color: purple;', 'color: black;');
      console.log(new Error().stack.split('\n').slice(1).join('\n'));
      console.groupEnd();
    }
  }
  function debugTree(instance, indent = 0) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      const name = (instance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE ? getDisplayNameForFiber(instance.data) : instance.data.name) || '';
      console.log('  '.repeat(indent) + '- ' + (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE ? 0 : instance.id) + ' (' + name + ')', 'parent', instance.parent === null ? ' ' : instance.parent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE ? 0 : instance.parent.id, 'next', instance.nextSibling === null ? ' ' : instance.nextSibling.id);
      let child = instance.firstChild;
      while (child !== null) {
        debugTree(child, indent + 1);
        child = child.nextSibling;
      }
    }
  }
  const hideElementsWithDisplayNames = new Set();
  const hideElementsWithPaths = new Set();
  const hideElementsWithTypes = new Set();
  const hideElementsWithEnvs = new Set();
  let isInFocusedActivity = true;
  let traceUpdatesEnabled = false;
  const traceUpdatesForNodes = new Set();
  function applyComponentFilters(componentFilters, nextActivitySlice) {
    hideElementsWithTypes.clear();
    hideElementsWithDisplayNames.clear();
    hideElementsWithPaths.clear();
    hideElementsWithEnvs.clear();
    const previousFocusedActivityID = focusedActivityID;
    focusedActivityID = null;
    focusedActivity = null;
    isInFocusedActivity = true;
    componentFilters.forEach(componentFilter => {
      if (!componentFilter.isEnabled) {
        return;
      }
      switch (componentFilter.type) {
        case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ComponentFilterDisplayName:
          if (componentFilter.isValid && componentFilter.value !== '') {
            hideElementsWithDisplayNames.add(new RegExp(componentFilter.value, 'i'));
          }
          break;
        case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ComponentFilterElementType:
          hideElementsWithTypes.add(componentFilter.value);
          break;
        case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ComponentFilterLocation:
          if (componentFilter.isValid && componentFilter.value !== '') {
            hideElementsWithPaths.add(new RegExp(componentFilter.value, 'i'));
          }
          break;
        case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ComponentFilterHOC:
          hideElementsWithDisplayNames.add(new RegExp('\\('));
          break;
        case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ComponentFilterEnvironmentName:
          hideElementsWithEnvs.add(componentFilter.value);
          break;
        case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ComponentFilterActivitySlice:
          if (nextActivitySlice !== null && nextActivitySlice.tag === ActivityComponent) {
            focusedActivity = nextActivitySlice;
            isInFocusedActivity = false;
            if (componentFilter.rendererID !== rendererID) {
              focusedActivityID = previousFocusedActivityID;
            }
          } else {}
          break;
        default:
          console.warn(`Invalid component filter type "${componentFilter.type}"`);
          break;
      }
    });
  }
  if (Array.isArray(componentFiltersOrComponentFiltersPromise)) {
    applyComponentFilters(componentFiltersOrComponentFiltersPromise, null);
  } else {
    componentFiltersOrComponentFiltersPromise.then(componentFilters => {
      applyComponentFilters(componentFilters, null);
    });
  }
  function updateComponentFilters(componentFilters) {
    if (isProfiling) {
      throw Error('Cannot modify filter preferences while profiling');
    }
    const previousForcedFallbacks = forceFallbackForFibers.size > 0 ? new Set(forceFallbackForFibers) : null;
    const previousForcedErrors = forceErrorForFibers.size > 0 ? new Map(forceErrorForFibers) : null;
    let nextFocusedActivity = null;
    let focusedActivityFilter = null;
    for (let i = 0; i < componentFilters.length; i++) {
      const filter = componentFilters[i];
      if (filter.type === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ComponentFilterActivitySlice && filter.isEnabled) {
        focusedActivityFilter = filter;
        const instance = idToDevToolsInstanceMap.get(filter.activityID);
        if (instance !== undefined && instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
          nextFocusedActivity = instance.data;
        }
      }
    }
    hook.getFiberRoots(rendererID).forEach(root => {
      const rootInstance = rootToFiberInstanceMap.get(root);
      if (rootInstance === undefined) {
        throw new Error('Expected the root instance to already exist when applying filters');
      }
      currentRoot = rootInstance;
      unmountInstanceRecursively(rootInstance);
      rootToFiberInstanceMap.delete(root);
      currentRoot = null;
    });
    if (nextFocusedActivity !== focusedActivity && (focusedActivityFilter === null || focusedActivityFilter.rendererID === rendererID)) {
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE);
      pushOperation(0);
    }
    applyComponentFilters(componentFilters, nextFocusedActivity);
    rootDisplayNameCounter.clear();
    if (typeof scheduleUpdate === 'function') {
      if (previousForcedFallbacks !== null) {
        for (const fiber of previousForcedFallbacks) {
          if (typeof scheduleRetry === 'function') {
            scheduleRetry(fiber);
          } else {
            scheduleUpdate(fiber);
          }
        }
      }
      if (previousForcedErrors !== null && typeof setErrorHandler === 'function') {
        setErrorHandler(shouldErrorFiberAccordingToMap);
        for (const [fiber, shouldError] of previousForcedErrors) {
          forceErrorForFibers.set(fiber, false);
          if (shouldError) {
            if (typeof scheduleRetry === 'function') {
              scheduleRetry(fiber);
            } else {
              scheduleUpdate(fiber);
            }
          }
        }
      }
    }
    hook.getFiberRoots(rendererID).forEach(root => {
      const current = root.current;
      const newRoot = createFiberInstance(current);
      rootToFiberInstanceMap.set(root, newRoot);
      idToDevToolsInstanceMap.set(newRoot.id, newRoot);
      if (trackedPath !== null) {
        mightBeOnTrackedPath = true;
      }
      currentRoot = newRoot;
      setRootPseudoKey(currentRoot.id, root.current);
      mountFiberRecursively(root.current, false);
      currentRoot = null;
    });
    if (focusedActivityFilter !== null && focusedActivityID !== null) {
      focusedActivityFilter.activityID = focusedActivityID;
    }
    flushPendingEvents(null);
    needsToFlushComponentLogs = false;
  }
  function getEnvironmentNames() {
    return Array.from(knownEnvironmentNames);
  }
  function isFiberHydrated(fiber) {
    if (OffscreenComponent === -1) {
      throw new Error('not implemented for legacy suspense');
    }
    switch (fiber.tag) {
      case HostRoot:
        const rootState = fiber.memoizedState;
        return !rootState.isDehydrated;
      case SuspenseComponent:
        const suspenseState = fiber.memoizedState;
        return suspenseState === null || suspenseState.dehydrated === null;
      default:
        throw new Error('not implemented for work tag ' + fiber.tag);
    }
  }
  function shouldFilterVirtual(data, secondaryEnv) {
    if (!isInFocusedActivity) {
      return true;
    }
    if (hideElementsWithTypes.has(react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeFunction)) {
      return true;
    }
    if (hideElementsWithDisplayNames.size > 0) {
      const displayName = data.name;
      if (displayName != null) {
        for (const displayNameRegExp of hideElementsWithDisplayNames) {
          if (displayNameRegExp.test(displayName)) {
            return true;
          }
        }
      }
    }
    if ((data.env == null || hideElementsWithEnvs.has(data.env)) && (secondaryEnv === null || hideElementsWithEnvs.has(secondaryEnv))) {
      return true;
    }
    return false;
  }
  function shouldFilterFiber(fiber) {
    const {
      tag,
      type,
      key
    } = fiber;
    if (tag !== HostRoot && !isInFocusedActivity) {
      return true;
    }
    switch (tag) {
      case DehydratedSuspenseComponent:
        return true;
      case HostPortal:
      case HostText:
      case LegacyHiddenComponent:
      case OffscreenComponent:
      case Throw:
        return true;
      case HostRoot:
        return false;
      case Fragment:
        return key === null;
      default:
        const typeSymbol = getTypeSymbol(type);
        switch (typeSymbol) {
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONCURRENT_MODE_NUMBER:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONCURRENT_MODE_SYMBOL_STRING:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.DEPRECATED_ASYNC_MODE_SYMBOL_STRING:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.STRICT_MODE_NUMBER:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.STRICT_MODE_SYMBOL_STRING:
            return true;
          default:
            break;
        }
    }
    const elementType = getElementTypeForFiber(fiber);
    if (hideElementsWithTypes.has(elementType)) {
      return true;
    }
    if (hideElementsWithDisplayNames.size > 0) {
      const displayName = getDisplayNameForFiber(fiber);
      if (displayName != null) {
        for (const displayNameRegExp of hideElementsWithDisplayNames) {
          if (displayNameRegExp.test(displayName)) {
            return true;
          }
        }
      }
    }
    if (hideElementsWithEnvs.has('Client')) {
      switch (tag) {
        case ClassComponent:
        case IncompleteClassComponent:
        case IncompleteFunctionComponent:
        case FunctionComponent:
        case IndeterminateComponent:
        case ForwardRef:
        case MemoComponent:
        case SimpleMemoComponent:
          return true;
      }
    }
    return false;
  }
  function getElementTypeForFiber(fiber) {
    const {
      type,
      tag
    } = fiber;
    switch (tag) {
      case ActivityComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeActivity;
      case ClassComponent:
      case IncompleteClassComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeClass;
      case IncompleteFunctionComponent:
      case FunctionComponent:
      case IndeterminateComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeFunction;
      case ForwardRef:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeForwardRef;
      case HostRoot:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeRoot;
      case HostComponent:
      case HostHoistable:
      case HostSingleton:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeHostComponent;
      case HostPortal:
      case HostText:
      case Fragment:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown;
      case MemoComponent:
      case SimpleMemoComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeMemo;
      case SuspenseComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeSuspense;
      case SuspenseListComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeSuspenseList;
      case TracingMarkerComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeTracingMarker;
      case ViewTransitionComponent:
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeViewTransition;
      default:
        const typeSymbol = getTypeSymbol(type);
        switch (typeSymbol) {
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONCURRENT_MODE_NUMBER:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONCURRENT_MODE_SYMBOL_STRING:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.DEPRECATED_ASYNC_MODE_SYMBOL_STRING:
            return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown;
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.PROVIDER_NUMBER:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.PROVIDER_SYMBOL_STRING:
            return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeContext;
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONTEXT_NUMBER:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONTEXT_SYMBOL_STRING:
            return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeContext;
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.STRICT_MODE_NUMBER:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.STRICT_MODE_SYMBOL_STRING:
            return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown;
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.PROFILER_NUMBER:
          case _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.PROFILER_SYMBOL_STRING:
            return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeProfiler;
          default:
            return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown;
        }
    }
  }
  let currentRoot = null;
  function untrackFiber(nearestInstance, fiber) {
    if (forceErrorForFibers.size > 0) {
      forceErrorForFibers.delete(fiber);
      if (fiber.alternate) {
        forceErrorForFibers.delete(fiber.alternate);
      }
      if (forceErrorForFibers.size === 0 && setErrorHandler != null) {
        setErrorHandler(shouldErrorFiberAlwaysNull);
      }
    }
    if (forceFallbackForFibers.size > 0) {
      forceFallbackForFibers.delete(fiber);
      if (fiber.alternate) {
        forceFallbackForFibers.delete(fiber.alternate);
      }
      if (forceFallbackForFibers.size === 0 && setSuspenseHandler != null) {
        setSuspenseHandler(shouldSuspendFiberAlwaysFalse);
      }
    }
    if (fiber.tag === HostHoistable) {
      releaseHostResource(nearestInstance, fiber.memoizedState);
    } else if (fiber.tag === HostComponent || fiber.tag === HostText || fiber.tag === HostSingleton) {
      releaseHostInstance(nearestInstance, fiber.stateNode);
    }
    for (let child = fiber.child; child !== null; child = child.sibling) {
      if (shouldFilterFiber(child)) {
        untrackFiber(nearestInstance, child);
      }
    }
  }
  function getChangeDescription(prevFiber, nextFiber) {
    switch (nextFiber.tag) {
      case ClassComponent:
        if (prevFiber === null) {
          return {
            context: null,
            didHooksChange: false,
            isFirstMount: true,
            props: null,
            state: null
          };
        } else {
          const data = {
            context: (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.getContextChanged)(prevFiber, nextFiber),
            didHooksChange: false,
            isFirstMount: false,
            props: (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.getChangedKeys)(prevFiber.memoizedProps, nextFiber.memoizedProps),
            state: (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.getChangedKeys)(prevFiber.memoizedState, nextFiber.memoizedState)
          };
          return data;
        }
      case IncompleteFunctionComponent:
      case FunctionComponent:
      case IndeterminateComponent:
      case ForwardRef:
      case MemoComponent:
      case SimpleMemoComponent:
        if (prevFiber === null) {
          return {
            context: null,
            didHooksChange: false,
            isFirstMount: true,
            props: null,
            state: null
          };
        } else {
          const prevHooks = inspectHooks(prevFiber);
          const nextHooks = inspectHooks(nextFiber);
          const indices = (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.getChangedHooksIndices)(prevHooks, nextHooks);
          const data = {
            context: (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.getContextChanged)(prevFiber, nextFiber),
            didHooksChange: indices !== null && indices.length > 0,
            isFirstMount: false,
            props: (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.getChangedKeys)(prevFiber.memoizedProps, nextFiber.memoizedProps),
            state: null,
            hooks: indices
          };
          return data;
        }
      default:
        return null;
    }
  }
  const pendingOperations = [];
  const pendingRealUnmountedIDs = [];
  const pendingRealUnmountedSuspenseIDs = [];
  const pendingSuspenderChanges = new Set();
  let pendingOperationsQueue = [];
  const pendingStringTable = new Map();
  let pendingStringTableLength = 0;
  function pushOperation(op) {
    if (true) {
      if (!Number.isInteger(op)) {
        console.error('pushOperation() was called but the value is not an integer.', op);
      }
    }
    pendingOperations.push(op);
  }
  function shouldBailoutWithPendingOperations() {
    if (isProfiling) {
      if (currentCommitProfilingMetadata != null && currentCommitProfilingMetadata.durations.length > 0) {
        return false;
      }
    }
    return pendingOperations.length === 0 && pendingRealUnmountedIDs.length === 0 && pendingRealUnmountedSuspenseIDs.length === 0 && pendingSuspenderChanges.size === 0;
  }
  function flushOrQueueOperations(operations) {
    if (shouldBailoutWithPendingOperations()) {
      return;
    }
    if (pendingOperationsQueue !== null) {
      pendingOperationsQueue.push(operations);
    } else {
      hook.emit('operations', operations);
    }
  }
  function recordConsoleLogs(instance, componentLogsEntry) {
    if (componentLogsEntry === undefined) {
      if (instance.logCount === 0) {
        return false;
      }
      instance.logCount = 0;
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS);
      pushOperation(instance.id);
      pushOperation(0);
      pushOperation(0);
      return true;
    } else {
      const totalCount = componentLogsEntry.errorsCount + componentLogsEntry.warningsCount;
      if (instance.logCount === totalCount) {
        return false;
      }
      instance.logCount = totalCount;
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS);
      pushOperation(instance.id);
      pushOperation(componentLogsEntry.errorsCount);
      pushOperation(componentLogsEntry.warningsCount);
      return true;
    }
  }
  function flushPendingEvents(root) {
    if (shouldBailoutWithPendingOperations()) {
      return;
    }
    const numUnmountIDs = pendingRealUnmountedIDs.length;
    const numUnmountSuspenseIDs = pendingRealUnmountedSuspenseIDs.length;
    const numSuspenderChanges = pendingSuspenderChanges.size;
    const operations = new Array(2 + 1 + pendingStringTableLength + (numUnmountSuspenseIDs > 0 ? 2 + numUnmountSuspenseIDs : 0) + (numUnmountIDs > 0 ? 2 + numUnmountIDs : 0) + pendingOperations.length + (numSuspenderChanges > 0 ? 2 + numSuspenderChanges * 4 : 0));
    let i = 0;
    operations[i++] = rendererID;
    if (root === null) {
      operations[i++] = -1;
    } else {
      operations[i++] = root.id;
    }
    operations[i++] = pendingStringTableLength;
    pendingStringTable.forEach((entry, stringKey) => {
      const encodedString = entry.encodedString;
      const length = encodedString.length;
      operations[i++] = length;
      for (let j = 0; j < length; j++) {
        operations[i + j] = encodedString[j];
      }
      i += length;
    });
    if (numUnmountSuspenseIDs > 0) {
      operations[i++] = _constants__WEBPACK_IMPORTED_MODULE_4__.SUSPENSE_TREE_OPERATION_REMOVE;
      operations[i++] = numUnmountSuspenseIDs;
      for (let j = 0; j < pendingRealUnmountedSuspenseIDs.length; j++) {
        operations[i++] = pendingRealUnmountedSuspenseIDs[j];
      }
    }
    if (numUnmountIDs > 0) {
      operations[i++] = _constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_REMOVE;
      operations[i++] = numUnmountIDs;
      for (let j = 0; j < pendingRealUnmountedIDs.length; j++) {
        operations[i++] = pendingRealUnmountedIDs[j];
      }
    }
    for (let j = 0; j < pendingOperations.length; j++) {
      operations[i + j] = pendingOperations[j];
    }
    i += pendingOperations.length;
    if (numSuspenderChanges > 0) {
      operations[i++] = _constants__WEBPACK_IMPORTED_MODULE_4__.SUSPENSE_TREE_OPERATION_SUSPENDERS;
      operations[i++] = numSuspenderChanges;
      pendingSuspenderChanges.forEach(fiberIdWithChanges => {
        const suspense = idToSuspenseNodeMap.get(fiberIdWithChanges);
        if (suspense === undefined) {
          throw new Error(`Could not send suspender changes for "${fiberIdWithChanges}" since the Fiber no longer exists.`);
        }
        operations[i++] = fiberIdWithChanges;
        operations[i++] = suspense.hasUniqueSuspenders ? 1 : 0;
        operations[i++] = Math.round(suspense.endTime * 1000);
        const instance = suspense.instance;
        const isSuspended = (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) && instance.data.tag === SuspenseComponent && instance.data.memoizedState !== null;
        operations[i++] = isSuspended ? 1 : 0;
        operations[i++] = suspense.environments.size;
        suspense.environments.forEach((count, env) => {
          operations[i++] = getStringID(env);
        });
      });
    }
    flushOrQueueOperations(operations);
    pendingOperations.length = 0;
    pendingRealUnmountedIDs.length = 0;
    pendingRealUnmountedSuspenseIDs.length = 0;
    pendingSuspenderChanges.clear();
    pendingStringTable.clear();
    pendingStringTableLength = 0;
  }
  function measureHostInstance(instance) {
    if (typeof instance !== 'object' || instance === null) {
      return null;
    }
    if (typeof instance.getClientRects === 'function' || instance.nodeType === 3) {
      const doc = instance.ownerDocument;
      if (instance === doc.documentElement) {
        return [{
          x: 0,
          y: 0,
          width: instance.scrollWidth,
          height: instance.scrollHeight
        }];
      }
      const result = [];
      const win = doc && doc.defaultView;
      const scrollX = win ? win.scrollX : 0;
      const scrollY = win ? win.scrollY : 0;
      let rects;
      if (instance.nodeType === 3) {
        if (typeof doc.createRange !== 'function') {
          return null;
        }
        const range = doc.createRange();
        if (typeof range.getClientRects !== 'function') {
          return null;
        }
        range.selectNodeContents(instance);
        rects = range.getClientRects();
      } else {
        rects = instance.getClientRects();
      }
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        result.push({
          x: rect.x + scrollX,
          y: rect.y + scrollY,
          width: rect.width,
          height: rect.height
        });
      }
      return result;
    }
    if (instance.canonical) {
      const publicInstance = instance.canonical.publicInstance;
      if (!publicInstance) {
        return null;
      }
      if (typeof publicInstance.getBoundingClientRect === 'function') {
        return [publicInstance.getBoundingClientRect()];
      }
      if (typeof publicInstance.unstable_getBoundingClientRect === 'function') {
        return [publicInstance.unstable_getBoundingClientRect()];
      }
    }
    return null;
  }
  function measureInstance(instance) {
    const hostInstances = findAllCurrentHostInstances(instance);
    let result = null;
    for (let i = 0; i < hostInstances.length; i++) {
      const childResult = measureHostInstance(hostInstances[i]);
      if (childResult !== null) {
        if (result === null) {
          result = childResult;
        } else {
          result = result.concat(childResult);
        }
      }
    }
    return result;
  }
  function getStringID(string) {
    if (string === null) {
      return 0;
    }
    const existingEntry = pendingStringTable.get(string);
    if (existingEntry !== undefined) {
      return existingEntry.id;
    }
    const id = pendingStringTable.size + 1;
    const encodedString = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.utfEncodeString)(string);
    pendingStringTable.set(string, {
      encodedString,
      id
    });
    pendingStringTableLength += encodedString.length + 1;
    return id;
  }
  let isInDisconnectedSubtree = false;
  function recordMount(fiber, parentInstance) {
    const isRoot = fiber.tag === HostRoot;
    let fiberInstance;
    if (isRoot) {
      const entry = rootToFiberInstanceMap.get(fiber.stateNode);
      if (entry === undefined) {
        throw new Error('The root should have been registered at this point');
      }
      fiberInstance = entry;
    } else {
      fiberInstance = createFiberInstance(fiber);
    }
    idToDevToolsInstanceMap.set(fiberInstance.id, fiberInstance);
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      debug('recordMount()', fiberInstance, parentInstance);
    }
    recordReconnect(fiberInstance, parentInstance);
    return fiberInstance;
  }
  function recordReconnect(fiberInstance, parentInstance) {
    if (isInDisconnectedSubtree) {
      return;
    }
    const id = fiberInstance.id;
    const fiber = fiberInstance.data;
    const isProfilingSupported = fiber.hasOwnProperty('treeBaseDuration');
    const isRoot = fiber.tag === HostRoot;
    if (isRoot) {
      const hasOwnerMetadata = fiber.hasOwnProperty('_debugOwner');
      let profilingFlags = 0;
      if (isProfilingSupported) {
        profilingFlags = _constants__WEBPACK_IMPORTED_MODULE_4__.PROFILING_FLAG_BASIC_SUPPORT;
        if (supportsPerformanceTracks) {
          profilingFlags |= _constants__WEBPACK_IMPORTED_MODULE_4__.PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT;
        }
      }
      const isProductionBuildOfRenderer = renderer.bundleType === 0;
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_ADD);
      pushOperation(id);
      pushOperation(react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeRoot);
      pushOperation((fiber.mode & StrictModeBits) !== 0 ? 1 : 0);
      pushOperation(profilingFlags);
      pushOperation(!isProductionBuildOfRenderer && StrictModeBits !== 0 ? 1 : 0);
      pushOperation(hasOwnerMetadata ? 1 : 0);
      if (isProfiling) {
        if (displayNamesByRootID !== null) {
          displayNamesByRootID.set(id, getDisplayNameForRoot(fiber));
        }
      }
    } else {
      const suspenseNode = fiberInstance.suspenseNode;
      if (suspenseNode !== null && fiber.memoizedState === null) {
        const prevRects = suspenseNode.rects;
        const nextRects = measureInstance(fiberInstance);
        if (!(0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.areEqualRects)(prevRects, nextRects)) {
          suspenseNode.rects = nextRects;
          recordSuspenseResize(suspenseNode);
        }
      }
      const {
        key
      } = fiber;
      const displayName = getDisplayNameForFiber(fiber);
      const elementType = getElementTypeForFiber(fiber);
      const debugOwner = getUnfilteredOwner(fiber);
      const ownerInstance = findNearestOwnerInstance(parentInstance, debugOwner);
      if (ownerInstance !== null && debugOwner === fiber._debugOwner && fiber._debugStack != null && ownerInstance.source === null) {
        ownerInstance.source = fiber._debugStack;
      }
      let unfilteredParent = parentInstance;
      while (unfilteredParent !== null && unfilteredParent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
        unfilteredParent = unfilteredParent.parent;
      }
      const ownerID = ownerInstance === null ? 0 : ownerInstance.id;
      const parentID = unfilteredParent === null ? 0 : unfilteredParent.id;
      const displayNameStringID = getStringID(displayName);
      const keyString = key === null ? null : key === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.REACT_OPTIMISTIC_KEY ? 'React.optimisticKey' : String(key);
      const keyStringID = getStringID(keyString);
      const nameProp = fiber.tag === SuspenseComponent ? fiber.memoizedProps.name : fiber.tag === ActivityComponent ? fiber.memoizedProps.name : null;
      const namePropString = nameProp == null ? null : String(nameProp);
      const namePropStringID = getStringID(namePropString);
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_ADD);
      pushOperation(id);
      pushOperation(elementType);
      pushOperation(parentID);
      pushOperation(ownerID);
      pushOperation(displayNameStringID);
      pushOperation(keyStringID);
      pushOperation(namePropStringID);
      if ((fiber.mode & StrictModeBits) !== 0) {
        let parentFiber = null;
        let parentFiberInstance = parentInstance;
        while (parentFiberInstance !== null) {
          if (parentFiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
            parentFiber = parentFiberInstance.data;
            break;
          }
          parentFiberInstance = parentFiberInstance.parent;
        }
        if (parentFiber === null || (parentFiber.mode & StrictModeBits) === 0) {
          pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_SET_SUBTREE_MODE);
          pushOperation(id);
          pushOperation(react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.StrictMode);
        }
      }
      if (fiber.tag === ActivityComponent) {
        const offscreenChild = fiber.child;
        if (offscreenChild !== null && offscreenChild.tag === OffscreenComponent && offscreenChild.memoizedState !== null) {
          pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_SET_SUBTREE_MODE);
          pushOperation(id);
          pushOperation(react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ActivityHiddenMode);
        }
      }
    }
    let componentLogsEntry = fiberToComponentLogsMap.get(fiber);
    if (componentLogsEntry === undefined && fiber.alternate !== null) {
      componentLogsEntry = fiberToComponentLogsMap.get(fiber.alternate);
    }
    recordConsoleLogs(fiberInstance, componentLogsEntry);
    if (isProfilingSupported) {
      recordProfilingDurations(fiberInstance, null);
    }
  }
  function recordVirtualMount(instance, parentInstance, secondaryEnv) {
    const id = instance.id;
    idToDevToolsInstanceMap.set(id, instance);
    recordVirtualReconnect(instance, parentInstance, secondaryEnv);
  }
  function recordVirtualReconnect(instance, parentInstance, secondaryEnv) {
    if (isInDisconnectedSubtree) {
      return;
    }
    const componentInfo = instance.data;
    const key = typeof componentInfo.key === 'string' ? componentInfo.key : null;
    const env = componentInfo.env;
    let displayName = componentInfo.name || '';
    if (typeof env === 'string') {
      if (secondaryEnv !== null) {
        displayName = secondaryEnv + '(' + displayName + ')';
      }
      displayName = env + '(' + displayName + ')';
    }
    const elementType = react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeVirtual;
    const debugOwner = getUnfilteredOwner(componentInfo);
    const ownerInstance = findNearestOwnerInstance(parentInstance, debugOwner);
    if (ownerInstance !== null && debugOwner === componentInfo.owner && componentInfo.debugStack != null && ownerInstance.source === null) {
      ownerInstance.source = componentInfo.debugStack;
    }
    let unfilteredParent = parentInstance;
    while (unfilteredParent !== null && unfilteredParent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
      unfilteredParent = unfilteredParent.parent;
    }
    const ownerID = ownerInstance === null ? 0 : ownerInstance.id;
    const parentID = unfilteredParent === null ? 0 : unfilteredParent.id;
    const displayNameStringID = getStringID(displayName);
    const keyString = key === null ? null : String(key);
    const keyStringID = getStringID(keyString);
    const namePropStringID = getStringID(null);
    const id = instance.id;
    pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_ADD);
    pushOperation(id);
    pushOperation(elementType);
    pushOperation(parentID);
    pushOperation(ownerID);
    pushOperation(displayNameStringID);
    pushOperation(keyStringID);
    pushOperation(namePropStringID);
    const componentLogsEntry = _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_8__.componentInfoToComponentLogsMap.get(componentInfo);
    recordConsoleLogs(instance, componentLogsEntry);
  }
  function recordSuspenseMount(suspenseInstance, parentSuspenseInstance) {
    const fiberInstance = suspenseInstance.instance;
    if (fiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
      throw new Error('Cannot record a mount for a filtered Fiber instance.');
    }
    const fiberID = fiberInstance.id;
    let unfilteredParent = parentSuspenseInstance;
    while (unfilteredParent !== null && unfilteredParent.instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
      unfilteredParent = unfilteredParent.parent;
    }
    const unfilteredParentInstance = unfilteredParent !== null ? unfilteredParent.instance : null;
    if (unfilteredParentInstance !== null && unfilteredParentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
      throw new Error('Should not have a filtered instance at this point. This is a bug.');
    }
    const parentID = unfilteredParentInstance === null ? 0 : unfilteredParentInstance.id;
    const fiber = fiberInstance.data;
    const props = fiber.memoizedProps;
    const name = fiber.tag !== SuspenseComponent || props === null ? null : props.name || null;
    const nameStringID = getStringID(name);
    const isSuspended = fiber.tag === SuspenseComponent && fiber.memoizedState !== null;
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      console.log('recordSuspenseMount()', suspenseInstance);
    }
    idToSuspenseNodeMap.set(fiberID, suspenseInstance);
    pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.SUSPENSE_TREE_OPERATION_ADD);
    pushOperation(fiberID);
    pushOperation(parentID);
    pushOperation(nameStringID);
    pushOperation(isSuspended ? 1 : 0);
    const rects = suspenseInstance.rects;
    if (rects === null) {
      pushOperation(-1);
    } else {
      pushOperation(rects.length);
      for (let i = 0; i < rects.length; ++i) {
        const rect = rects[i];
        pushOperation(Math.round(rect.x * 1000));
        pushOperation(Math.round(rect.y * 1000));
        pushOperation(Math.round(rect.width * 1000));
        pushOperation(Math.round(rect.height * 1000));
      }
    }
  }
  function recordUnmount(fiberInstance) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      debug('recordUnmount()', fiberInstance, reconcilingParent);
    }
    recordDisconnect(fiberInstance);
    const suspenseNode = fiberInstance.suspenseNode;
    if (suspenseNode !== null) {
      recordSuspenseUnmount(suspenseNode);
    }
    idToDevToolsInstanceMap.delete(fiberInstance.id);
    untrackFiber(fiberInstance, fiberInstance.data);
  }
  function recordDisconnect(fiberInstance) {
    if (isInDisconnectedSubtree) {
      return;
    }
    if (trackedPathMatchInstance === fiberInstance) {
      setTrackedPath(null);
    }
    const id = fiberInstance.id;
    pendingRealUnmountedIDs.push(id);
  }
  function recordSuspenseResize(suspenseNode) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      console.log('recordSuspenseResize()', suspenseNode);
    }
    const fiberInstance = suspenseNode.instance;
    if (fiberInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return;
    }
    pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.SUSPENSE_TREE_OPERATION_RESIZE);
    pushOperation(fiberInstance.id);
    const rects = suspenseNode.rects;
    if (rects === null) {
      pushOperation(-1);
    } else {
      pushOperation(rects.length);
      for (let i = 0; i < rects.length; ++i) {
        const rect = rects[i];
        pushOperation(Math.round(rect.x * 1000));
        pushOperation(Math.round(rect.y * 1000));
        pushOperation(Math.round(rect.width * 1000));
        pushOperation(Math.round(rect.height * 1000));
      }
    }
  }
  function recordSuspenseSuspenders(suspenseNode) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      console.log('recordSuspenseSuspenders()', suspenseNode);
    }
    const fiberInstance = suspenseNode.instance;
    if (fiberInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return;
    }
    suspenseNode.environments.forEach((count, env) => {
      getStringID(env);
    });
    pendingSuspenderChanges.add(fiberInstance.id);
  }
  function recordSuspenseUnmount(suspenseInstance) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      console.log('recordSuspenseUnmount()', suspenseInstance, reconcilingParentSuspenseNode);
    }
    const devtoolsInstance = suspenseInstance.instance;
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      throw new Error("Can't unmount a filtered SuspenseNode. This is a bug.");
    }
    const fiberInstance = devtoolsInstance;
    const id = fiberInstance.id;
    pendingRealUnmountedSuspenseIDs.push(id);
    pendingSuspenderChanges.delete(id);
    idToSuspenseNodeMap.delete(id);
  }
  let remainingReconcilingChildren = null;
  let previouslyReconciledSibling = null;
  let reconcilingParent = null;
  let remainingReconcilingChildrenSuspenseNodes = null;
  let previouslyReconciledSiblingSuspenseNode = null;
  let reconcilingParentSuspenseNode = null;
  function insertSuspendedBy(asyncInfo) {
    if (reconcilingParent === null || reconcilingParentSuspenseNode === null) {
      throw new Error('It should not be possible to have suspended data outside the root. ' + 'Even suspending at the first position is still a child of the root.');
    }
    const parentSuspenseNode = reconcilingParentSuspenseNode;
    let parentInstance = reconcilingParent;
    while (parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE && parentInstance.parent !== null && parentInstance !== parentSuspenseNode.instance) {
      parentInstance = parentInstance.parent;
    }
    if (parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      const fiber = parentInstance.data;
      if (fiber.tag === SuspenseComponent && parentInstance !== parentSuspenseNode.instance) {
        const parent = parentInstance.parent;
        if (parent === null) {
          throw new Error('Did not find a suitable instance for this async info. This is a bug in React.');
        }
        parentInstance = parent;
      }
    }
    const suspenseNodeSuspendedBy = parentSuspenseNode.suspendedBy;
    const ioInfo = asyncInfo.awaited;
    let suspendedBySet = suspenseNodeSuspendedBy.get(ioInfo);
    if (suspendedBySet === undefined) {
      suspendedBySet = new Set();
      suspenseNodeSuspendedBy.set(ioInfo, suspendedBySet);
      const env = ioInfo.env;
      if (env != null) {
        const environmentCounts = parentSuspenseNode.environments;
        const count = environmentCounts.get(env);
        if (count === undefined || count === 0) {
          environmentCounts.set(env, 1);
          recordSuspenseSuspenders(parentSuspenseNode);
        } else {
          environmentCounts.set(env, count + 1);
        }
      }
    }
    if (!suspendedBySet.has(parentInstance)) {
      suspendedBySet.add(parentInstance);
      const virtualEndTime = (0,_shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__.getVirtualEndTime)(ioInfo);
      if (!parentSuspenseNode.hasUniqueSuspenders && !(0,_shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__.ioExistsInSuspenseAncestor)(parentSuspenseNode, ioInfo)) {
        parentSuspenseNode.hasUniqueSuspenders = true;
        if (parentSuspenseNode.endTime < virtualEndTime) {
          parentSuspenseNode.endTime = virtualEndTime;
        }
        recordSuspenseSuspenders(parentSuspenseNode);
      } else if (parentSuspenseNode.endTime < virtualEndTime) {
        parentSuspenseNode.endTime = virtualEndTime;
        recordSuspenseSuspenders(parentSuspenseNode);
      }
    }
    parentSuspenseNode.hasUnknownSuspenders = false;
    const suspendedBy = parentInstance.suspendedBy;
    if (suspendedBy === null) {
      parentInstance.suspendedBy = [asyncInfo];
    } else if (suspendedBy.indexOf(asyncInfo) === -1) {
      suspendedBy.push(asyncInfo);
    }
  }
  function unblockSuspendedBy(parentSuspenseNode, ioInfo) {
    const firstChild = parentSuspenseNode.firstChild;
    if (firstChild === null) {
      return;
    }
    let node = firstChild;
    while (node !== null) {
      if (node.suspendedBy.has(ioInfo)) {
        if (!node.hasUniqueSuspenders) {
          recordSuspenseSuspenders(node);
        }
        node.hasUniqueSuspenders = true;
        node.hasUnknownSuspenders = false;
      } else if (node.firstChild !== null) {
        node = node.firstChild;
        continue;
      }
      while (node.nextSibling === null) {
        if (node.parent === null || node.parent === parentSuspenseNode) {
          return;
        }
        node = node.parent;
      }
      node = node.nextSibling;
    }
  }
  function computeEndTime(suspenseNode) {
    let maxEndTime = 0;
    suspenseNode.suspendedBy.forEach((set, ioInfo) => {
      const virtualEndTime = (0,_shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__.getVirtualEndTime)(ioInfo);
      if (virtualEndTime > maxEndTime) {
        maxEndTime = virtualEndTime;
      }
    });
    return maxEndTime;
  }
  function removePreviousSuspendedBy(instance, previousSuspendedBy, parentSuspenseNode) {
    const suspenseNode = instance.suspenseNode === null ? parentSuspenseNode : instance.suspenseNode;
    if (previousSuspendedBy !== null && suspenseNode !== null) {
      const nextSuspendedBy = instance.suspendedBy;
      let changedEnvironment = false;
      let mayHaveChangedEndTime = false;
      for (let i = 0; i < previousSuspendedBy.length; i++) {
        const asyncInfo = previousSuspendedBy[i];
        if (nextSuspendedBy === null || nextSuspendedBy.indexOf(asyncInfo) === -1 && (0,_shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__.getAwaitInSuspendedByFromIO)(nextSuspendedBy, asyncInfo.awaited) === null) {
          const ioInfo = asyncInfo.awaited;
          const suspendedBySet = suspenseNode.suspendedBy.get(ioInfo);
          if (suspenseNode.endTime === (0,_shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__.getVirtualEndTime)(ioInfo)) {
            mayHaveChangedEndTime = true;
          }
          if (suspendedBySet === undefined || !suspendedBySet.delete(instance)) {
            let alreadyRemovedIO = false;
            for (let j = 0; j < i; j++) {
              const removedIOInfo = previousSuspendedBy[j].awaited;
              if (removedIOInfo === ioInfo) {
                alreadyRemovedIO = true;
                break;
              }
            }
            if (!alreadyRemovedIO) {
              throw new Error('We are cleaning up async info that was not on the parent Suspense boundary. ' + 'This is a bug in React.');
            }
          }
          if (suspendedBySet !== undefined && suspendedBySet.size === 0) {
            suspenseNode.suspendedBy.delete(ioInfo);
            const env = ioInfo.env;
            if (env != null) {
              const environmentCounts = suspenseNode.environments;
              const count = environmentCounts.get(env);
              if (count === undefined || count === 0) {
                throw new Error('We are removing an environment but it was not in the set. ' + 'This is a bug in React.');
              }
              if (count === 1) {
                environmentCounts.delete(env);
                changedEnvironment = true;
              } else {
                environmentCounts.set(env, count - 1);
              }
            }
            if (suspenseNode.hasUniqueSuspenders && !(0,_shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__.ioExistsInSuspenseAncestor)(suspenseNode, ioInfo)) {
              unblockSuspendedBy(suspenseNode, ioInfo);
            }
          }
        }
      }
      const newEndTime = mayHaveChangedEndTime ? computeEndTime(suspenseNode) : suspenseNode.endTime;
      if (changedEnvironment || newEndTime !== suspenseNode.endTime) {
        suspenseNode.endTime = newEndTime;
        recordSuspenseSuspenders(suspenseNode);
      }
    }
  }
  function insertChild(instance) {
    const parentInstance = reconcilingParent;
    if (parentInstance === null) {
      return;
    }
    instance.parent = parentInstance;
    if (previouslyReconciledSibling === null) {
      previouslyReconciledSibling = instance;
      parentInstance.firstChild = instance;
    } else {
      previouslyReconciledSibling.nextSibling = instance;
      previouslyReconciledSibling = instance;
    }
    instance.nextSibling = null;
    const suspenseNode = instance.suspenseNode;
    if (suspenseNode !== null) {
      const parentNode = reconcilingParentSuspenseNode;
      if (parentNode !== null) {
        suspenseNode.parent = parentNode;
        if (previouslyReconciledSiblingSuspenseNode === null) {
          previouslyReconciledSiblingSuspenseNode = suspenseNode;
          parentNode.firstChild = suspenseNode;
        } else {
          previouslyReconciledSiblingSuspenseNode.nextSibling = suspenseNode;
          previouslyReconciledSiblingSuspenseNode = suspenseNode;
        }
        suspenseNode.nextSibling = null;
      }
    }
  }
  function moveChild(instance, previousSibling) {
    removeChild(instance, previousSibling);
    insertChild(instance);
  }
  function removeChild(instance, previousSibling) {
    if (instance.parent === null) {
      if (remainingReconcilingChildren === instance) {
        throw new Error('Remaining children should not have items with no parent');
      } else if (instance.nextSibling !== null) {
        throw new Error('A deleted instance should not have next siblings');
      }
      return;
    }
    const parentInstance = reconcilingParent;
    if (parentInstance === null) {
      throw new Error('Should not have a parent if we are at the root');
    }
    if (instance.parent !== parentInstance) {
      throw new Error('Cannot remove a node from a different parent than is being reconciled.');
    }
    if (previousSibling === null) {
      if (remainingReconcilingChildren !== instance) {
        throw new Error('Expected a placed child to be moved from the remaining set.');
      }
      remainingReconcilingChildren = instance.nextSibling;
    } else {
      previousSibling.nextSibling = instance.nextSibling;
    }
    instance.nextSibling = null;
    instance.parent = null;
    const suspenseNode = instance.suspenseNode;
    if (suspenseNode !== null && suspenseNode.parent !== null) {
      const parentNode = reconcilingParentSuspenseNode;
      if (parentNode === null) {
        throw new Error('Should not have a parent if we are at the root');
      }
      if (suspenseNode.parent !== parentNode) {
        throw new Error('Cannot remove a Suspense node from a different parent than is being reconciled.');
      }
      let previousSuspenseSibling = remainingReconcilingChildrenSuspenseNodes;
      if (previousSuspenseSibling === suspenseNode) {
        remainingReconcilingChildrenSuspenseNodes = suspenseNode.nextSibling;
      } else {
        while (previousSuspenseSibling !== null) {
          if (previousSuspenseSibling.nextSibling === suspenseNode) {
            previousSuspenseSibling.nextSibling = suspenseNode.nextSibling;
            break;
          }
          previousSuspenseSibling = previousSuspenseSibling.nextSibling;
        }
      }
      suspenseNode.nextSibling = null;
      suspenseNode.parent = null;
    }
  }
  function isHiddenOffscreen(fiber) {
    switch (fiber.tag) {
      case LegacyHiddenComponent:
      case OffscreenComponent:
        return fiber.memoizedState !== null;
      default:
        return false;
    }
  }
  function isActivityHiddenOffscreen(fiber) {
    return isHiddenOffscreen(fiber) && fiber.return !== null && fiber.return.tag === ActivityComponent;
  }
  function isSuspendedOffscreen(fiber) {
    switch (fiber.tag) {
      case LegacyHiddenComponent:
      case OffscreenComponent:
        return fiber.memoizedState !== null && fiber.return !== null && fiber.return.tag === SuspenseComponent;
      default:
        return false;
    }
  }
  function unmountRemainingChildren() {
    if (reconcilingParent !== null && (reconcilingParent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || reconcilingParent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) && isSuspendedOffscreen(reconcilingParent.data) && !isInDisconnectedSubtree) {
      isInDisconnectedSubtree = true;
      try {
        let child = remainingReconcilingChildren;
        while (child !== null) {
          unmountInstanceRecursively(child);
          child = remainingReconcilingChildren;
        }
      } finally {
        isInDisconnectedSubtree = false;
      }
    } else {
      let child = remainingReconcilingChildren;
      while (child !== null) {
        unmountInstanceRecursively(child);
        child = remainingReconcilingChildren;
      }
    }
  }
  function unmountSuspenseChildrenRecursively(contentInstance, stashedSuspenseParent, stashedSuspensePrevious, stashedSuspenseRemaining) {
    unmountInstanceRecursively(contentInstance);
    reconcilingParentSuspenseNode = stashedSuspenseParent;
    previouslyReconciledSiblingSuspenseNode = stashedSuspensePrevious;
    remainingReconcilingChildrenSuspenseNodes = stashedSuspenseRemaining;
    unmountRemainingChildren();
  }
  function isChildOf(parentInstance, childInstance, grandParent) {
    let instance = childInstance.parent;
    while (instance !== null) {
      if (parentInstance === instance) {
        return true;
      }
      if (instance === parentInstance.parent || instance === grandParent) {
        break;
      }
      instance = instance.parent;
    }
    return false;
  }
  function measureUnchangedSuspenseNodesRecursively(suspenseNode) {
    if (isInDisconnectedSubtree) {
      return;
    }
    const instance = suspenseNode.instance;
    const isSuspendedSuspenseComponent = (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) && instance.data.tag === SuspenseComponent && instance.data.memoizedState !== null;
    if (isSuspendedSuspenseComponent) {
      return;
    }
    let parent = instance.parent;
    while (parent !== null) {
      if ((parent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || parent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) && isHiddenOffscreen(parent.data)) {
        return;
      }
      if (parent.suspenseNode !== null) {
        break;
      }
      parent = parent.parent;
    }
    const nextRects = measureInstance(suspenseNode.instance);
    const prevRects = suspenseNode.rects;
    if ((0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.areEqualRects)(prevRects, nextRects)) {
      return;
    }
    for (let child = suspenseNode.firstChild; child !== null; child = child.nextSibling) {
      measureUnchangedSuspenseNodesRecursively(child);
    }
    suspenseNode.rects = nextRects;
    recordSuspenseResize(suspenseNode);
  }
  function consumeSuspenseNodesOfExistingInstance(instance) {
    let suspenseNode = remainingReconcilingChildrenSuspenseNodes;
    if (suspenseNode === null) {
      return;
    }
    const parentSuspenseNode = reconcilingParentSuspenseNode;
    if (parentSuspenseNode === null) {
      throw new Error('The should not be any remaining suspense node children if there is no parent.');
    }
    let foundOne = false;
    let previousSkippedSibling = null;
    while (suspenseNode !== null) {
      if (isChildOf(instance, suspenseNode.instance, parentSuspenseNode.instance)) {
        foundOne = true;
        const nextRemainingSibling = suspenseNode.nextSibling;
        if (previousSkippedSibling === null) {
          remainingReconcilingChildrenSuspenseNodes = nextRemainingSibling;
        } else {
          previousSkippedSibling.nextSibling = nextRemainingSibling;
        }
        suspenseNode.nextSibling = null;
        if (previouslyReconciledSiblingSuspenseNode === null) {
          parentSuspenseNode.firstChild = suspenseNode;
        } else {
          previouslyReconciledSiblingSuspenseNode.nextSibling = suspenseNode;
        }
        previouslyReconciledSiblingSuspenseNode = suspenseNode;
        measureUnchangedSuspenseNodesRecursively(suspenseNode);
        suspenseNode = nextRemainingSibling;
      } else if (foundOne) {
        break;
      } else {
        previousSkippedSibling = suspenseNode;
        suspenseNode = suspenseNode.nextSibling;
      }
    }
  }
  function mountVirtualInstanceRecursively(virtualInstance, firstChild, lastChild, traceNearestHostComponentUpdate, virtualLevel) {
    const mightSiblingsBeOnTrackedPath = updateVirtualTrackedPathStateBeforeMount(virtualInstance, reconcilingParent);
    const stashedParent = reconcilingParent;
    const stashedPrevious = previouslyReconciledSibling;
    const stashedRemaining = remainingReconcilingChildren;
    reconcilingParent = virtualInstance;
    previouslyReconciledSibling = null;
    remainingReconcilingChildren = null;
    try {
      mountVirtualChildrenRecursively(firstChild, lastChild, traceNearestHostComponentUpdate, virtualLevel + 1);
      recordVirtualProfilingDurations(virtualInstance);
    } finally {
      reconcilingParent = stashedParent;
      previouslyReconciledSibling = stashedPrevious;
      remainingReconcilingChildren = stashedRemaining;
      updateTrackedPathStateAfterMount(mightSiblingsBeOnTrackedPath);
    }
  }
  function recordVirtualUnmount(instance) {
    recordVirtualDisconnect(instance);
    idToDevToolsInstanceMap.delete(instance.id);
  }
  function recordVirtualDisconnect(instance) {
    if (isInDisconnectedSubtree) {
      return;
    }
    if (trackedPathMatchInstance === instance) {
      setTrackedPath(null);
    }
    const id = instance.id;
    pendingRealUnmountedIDs.push(id);
  }
  function trackDebugInfoFromLazyType(fiber) {
    const type = fiber.elementType;
    const typeSymbol = getTypeSymbol(type);
    if (typeSymbol === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.LAZY_SYMBOL_STRING) {
      const debugInfo = type._debugInfo;
      if (debugInfo) {
        for (let i = 0; i < debugInfo.length; i++) {
          const debugEntry = debugInfo[i];
          if (debugEntry.awaited) {
            const asyncInfo = debugEntry;
            insertSuspendedBy(asyncInfo);
          }
        }
      }
    }
  }
  function trackDebugInfoFromUsedThenables(fiber) {
    const dependencies = fiber.dependencies;
    if (dependencies == null) {
      return;
    }
    const thenableState = dependencies._debugThenableState;
    if (thenableState == null) {
      return;
    }
    const usedThenables = thenableState.thenables || thenableState;
    if (!Array.isArray(usedThenables)) {
      return;
    }
    for (let i = 0; i < usedThenables.length; i++) {
      const thenable = usedThenables[i];
      const debugInfo = thenable._debugInfo;
      if (debugInfo) {
        for (let j = 0; j < debugInfo.length; j++) {
          const debugEntry = debugInfo[j];
          if (debugEntry.awaited) {
            const asyncInfo = debugEntry;
            insertSuspendedBy(asyncInfo);
          }
        }
      }
    }
  }
  const hostAsyncInfoCache = new WeakMap();
  function trackDebugInfoFromHostResource(devtoolsInstance, fiber) {
    const resource = fiber.memoizedState;
    if (resource == null) {
      return;
    }
    const existingEntry = hostAsyncInfoCache.get(resource);
    if (existingEntry !== undefined) {
      insertSuspendedBy(existingEntry);
      return;
    }
    const props = fiber.memoizedProps;
    const mayResourceSuspendCommit = resource.type === 'stylesheet' && (typeof props.media !== 'string' || typeof matchMedia !== 'function' || matchMedia(props.media));
    if (!mayResourceSuspendCommit) {
      return;
    }
    const instance = resource.instance;
    if (instance == null) {
      return;
    }
    const href = instance.href;
    if (typeof href !== 'string') {
      return;
    }
    let start = -1;
    let end = -1;
    let byteSize = 0;
    if (typeof performance.getEntriesByType === 'function') {
      const resourceEntries = performance.getEntriesByType('resource');
      for (let i = 0; i < resourceEntries.length; i++) {
        const resourceEntry = resourceEntries[i];
        if (resourceEntry.name === href) {
          start = resourceEntry.startTime;
          end = start + resourceEntry.duration;
          byteSize = resourceEntry.transferSize || 0;
        }
      }
    }
    const value = instance.sheet;
    const promise = Promise.resolve(value);
    promise.status = 'fulfilled';
    promise.value = value;
    const ioInfo = {
      name: 'stylesheet',
      start,
      end,
      value: promise,
      owner: fiber
    };
    if (byteSize > 0) {
      ioInfo.byteSize = byteSize;
    }
    const asyncInfo = {
      awaited: ioInfo,
      owner: fiber._debugOwner == null ? null : fiber._debugOwner,
      debugStack: fiber._debugStack == null ? null : fiber._debugStack,
      debugTask: fiber._debugTask == null ? null : fiber._debugTask
    };
    hostAsyncInfoCache.set(resource, asyncInfo);
    insertSuspendedBy(asyncInfo);
  }
  function trackDebugInfoFromHostComponent(devtoolsInstance, fiber) {
    if (fiber.tag !== HostComponent) {
      return;
    }
    if ((fiber.mode & SuspenseyImagesMode) === 0) {
      return;
    }
    const type = fiber.type;
    const props = fiber.memoizedProps;
    const maySuspendCommit = type === 'img' && props.src != null && props.src !== '' && props.onLoad == null && props.loading !== 'lazy';
    if (!maySuspendCommit) {
      return;
    }
    const instance = fiber.stateNode;
    if (instance == null) {
      return;
    }
    const src = instance.currentSrc;
    if (typeof src !== 'string' || src === '') {
      return;
    }
    let start = -1;
    let end = -1;
    let byteSize = 0;
    let fileSize = 0;
    if (typeof performance.getEntriesByType === 'function') {
      const resourceEntries = performance.getEntriesByType('resource');
      for (let i = 0; i < resourceEntries.length; i++) {
        const resourceEntry = resourceEntries[i];
        if (resourceEntry.name === src) {
          start = resourceEntry.startTime;
          end = start + resourceEntry.duration;
          fileSize = resourceEntry.decodedBodySize || 0;
          byteSize = resourceEntry.transferSize || 0;
        }
      }
    }
    const value = {
      currentSrc: src
    };
    if (instance.naturalWidth > 0 && instance.naturalHeight > 0) {
      value.naturalWidth = instance.naturalWidth;
      value.naturalHeight = instance.naturalHeight;
    }
    if (fileSize > 0) {
      value.fileSize = fileSize;
    }
    const promise = Promise.resolve(value);
    promise.status = 'fulfilled';
    promise.value = value;
    const ioInfo = {
      name: 'img',
      start,
      end,
      value: promise,
      owner: fiber
    };
    if (byteSize > 0) {
      ioInfo.byteSize = byteSize;
    }
    const asyncInfo = {
      awaited: ioInfo,
      owner: fiber._debugOwner == null ? null : fiber._debugOwner,
      debugStack: fiber._debugStack == null ? null : fiber._debugStack,
      debugTask: fiber._debugTask == null ? null : fiber._debugTask
    };
    insertSuspendedBy(asyncInfo);
  }
  function trackThrownPromisesFromRetryCache(suspenseNode, retryCache) {
    if (retryCache != null) {
      if (!suspenseNode.hasUniqueSuspenders) {
        recordSuspenseSuspenders(suspenseNode);
      }
      suspenseNode.hasUniqueSuspenders = true;
      suspenseNode.hasUnknownSuspenders = true;
    }
  }
  function mountVirtualChildrenRecursively(firstChild, lastChild, traceNearestHostComponentUpdate, virtualLevel) {
    let fiber = firstChild;
    let previousVirtualInstance = null;
    let previousVirtualInstanceFirstFiber = firstChild;
    while (fiber !== null && fiber !== lastChild) {
      let level = 0;
      if (fiber._debugInfo) {
        for (let i = 0; i < fiber._debugInfo.length; i++) {
          const debugEntry = fiber._debugInfo[i];
          if (debugEntry.awaited) {
            const asyncInfo = debugEntry;
            if (level === virtualLevel) {
              insertSuspendedBy(asyncInfo);
            }
            continue;
          }
          if (typeof debugEntry.name !== 'string') {
            continue;
          }
          const componentInfo = debugEntry;
          const secondaryEnv = (0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.getSecondaryEnvironmentName)(fiber._debugInfo, i);
          if (componentInfo.env != null) {
            knownEnvironmentNames.add(componentInfo.env);
          }
          if (secondaryEnv !== null) {
            knownEnvironmentNames.add(secondaryEnv);
          }
          if (shouldFilterVirtual(componentInfo, secondaryEnv)) {
            continue;
          }
          if (level === virtualLevel) {
            if (previousVirtualInstance === null || previousVirtualInstance.data !== debugEntry) {
              if (previousVirtualInstance !== null) {
                mountVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceFirstFiber, fiber, traceNearestHostComponentUpdate, virtualLevel);
              }
              previousVirtualInstance = createVirtualInstance(componentInfo);
              recordVirtualMount(previousVirtualInstance, reconcilingParent, secondaryEnv);
              insertChild(previousVirtualInstance);
              previousVirtualInstanceFirstFiber = fiber;
            }
            level++;
            break;
          } else {
            level++;
          }
        }
      }
      if (level === virtualLevel) {
        if (previousVirtualInstance !== null) {
          mountVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceFirstFiber, fiber, traceNearestHostComponentUpdate, virtualLevel);
          previousVirtualInstance = null;
        }
        mountFiberRecursively(fiber, traceNearestHostComponentUpdate);
      }
      fiber = fiber.sibling;
    }
    if (previousVirtualInstance !== null) {
      mountVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceFirstFiber, null, traceNearestHostComponentUpdate, virtualLevel);
    }
  }
  function mountChildrenRecursively(firstChild, traceNearestHostComponentUpdate) {
    mountVirtualChildrenRecursively(firstChild, null, traceNearestHostComponentUpdate, 0);
  }
  function mountSuspenseChildrenRecursively(contentFiber, traceNearestHostComponentUpdate, stashedSuspenseParent, stashedSuspensePrevious, stashedSuspenseRemaining) {
    const fallbackFiber = contentFiber.sibling;
    mountVirtualChildrenRecursively(contentFiber, fallbackFiber, traceNearestHostComponentUpdate, 0);
    reconcilingParentSuspenseNode = stashedSuspenseParent;
    previouslyReconciledSiblingSuspenseNode = stashedSuspensePrevious;
    remainingReconcilingChildrenSuspenseNodes = stashedSuspenseRemaining;
    if (fallbackFiber !== null) {
      mountVirtualChildrenRecursively(fallbackFiber, null, traceNearestHostComponentUpdate, 0);
    }
  }
  function mountFiberRecursively(fiber, traceNearestHostComponentUpdate) {
    const isFocusedActivityEntry = focusedActivity !== null && (fiber === focusedActivity || fiber.alternate === focusedActivity);
    if (isFocusedActivityEntry) {
      isInFocusedActivity = true;
    }
    const shouldIncludeInTree = !shouldFilterFiber(fiber);
    let newInstance = null;
    let newSuspenseNode = null;
    if (shouldIncludeInTree) {
      newInstance = recordMount(fiber, reconcilingParent);
      if (isFocusedActivityEntry) {
        focusedActivityID = newInstance.id;
        pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE);
        pushOperation(newInstance.id);
      }
      if (fiber.tag === SuspenseComponent || fiber.tag === HostRoot) {
        newSuspenseNode = createSuspenseNode(newInstance);
        if (fiber.tag === SuspenseComponent) {
          if (OffscreenComponent === -1) {
            const isTimedOut = fiber.memoizedState !== null;
            if (!isTimedOut) {
              newSuspenseNode.rects = measureInstance(newInstance);
            }
          } else {
            const hydrated = isFiberHydrated(fiber);
            if (hydrated) {
              const contentFiber = fiber.child;
              if (contentFiber === null) {
                throw new Error('There should always be an Offscreen Fiber child in a hydrated Suspense boundary.');
              }
            } else {}
            const isTimedOut = fiber.memoizedState !== null;
            if (!isTimedOut) {
              newSuspenseNode.rects = measureInstance(newInstance);
            }
          }
        } else {
          newSuspenseNode.rects = measureInstance(newInstance);
        }
        recordSuspenseMount(newSuspenseNode, reconcilingParentSuspenseNode);
      }
      insertChild(newInstance);
      if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
        debug('mountFiberRecursively()', newInstance, reconcilingParent);
      }
    } else if (reconcilingParent !== null && reconcilingParent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE || fiber.tag === SuspenseComponent || fiber.tag === OffscreenComponent || fiber.tag === LegacyHiddenComponent) {
      if (reconcilingParent !== null && reconcilingParent.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE && reconcilingParent.data === fiber._debugOwner && fiber._debugStack != null && reconcilingParent.source === null) {
        reconcilingParent.source = fiber._debugStack;
      }
      newInstance = createFilteredFiberInstance(fiber);
      if (fiber.tag === SuspenseComponent) {
        newSuspenseNode = createSuspenseNode(newInstance);
        if (OffscreenComponent === -1) {
          const isTimedOut = fiber.memoizedState !== null;
          if (!isTimedOut) {
            newSuspenseNode.rects = measureInstance(newInstance);
          }
        } else {
          const hydrated = isFiberHydrated(fiber);
          if (hydrated) {
            const contentFiber = fiber.child;
            if (contentFiber === null) {
              throw new Error('There should always be an Offscreen Fiber child in a hydrated Suspense boundary.');
            }
          } else {}
          const suspenseState = fiber.memoizedState;
          const isTimedOut = suspenseState !== null;
          if (!isTimedOut) {
            newSuspenseNode.rects = measureInstance(newInstance);
          }
        }
      }
      insertChild(newInstance);
      if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
        debug('mountFiberRecursively()', newInstance, reconcilingParent);
      }
    }
    const mightSiblingsBeOnTrackedPath = updateTrackedPathStateBeforeMount(fiber, newInstance);
    const stashedParent = reconcilingParent;
    const stashedPrevious = previouslyReconciledSibling;
    const stashedRemaining = remainingReconcilingChildren;
    const stashedSuspenseParent = reconcilingParentSuspenseNode;
    const stashedSuspensePrevious = previouslyReconciledSiblingSuspenseNode;
    const stashedSuspenseRemaining = remainingReconcilingChildrenSuspenseNodes;
    const stashedIsInActivitySlice = isInFocusedActivity;
    if (newInstance !== null) {
      reconcilingParent = newInstance;
      previouslyReconciledSibling = null;
      remainingReconcilingChildren = null;
    }
    let shouldPopSuspenseNode = false;
    if (newSuspenseNode !== null) {
      reconcilingParentSuspenseNode = newSuspenseNode;
      previouslyReconciledSiblingSuspenseNode = null;
      remainingReconcilingChildrenSuspenseNodes = null;
      shouldPopSuspenseNode = true;
    }
    if (!isFocusedActivityEntry && focusedActivity !== null && fiber.tag === ActivityComponent) {}
    try {
      if (traceUpdatesEnabled) {
        if (traceNearestHostComponentUpdate) {
          const elementType = getElementTypeForFiber(fiber);
          if (elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeHostComponent) {
            traceUpdatesForNodes.add(fiber.stateNode);
            traceNearestHostComponentUpdate = false;
          }
        }
      }
      trackDebugInfoFromLazyType(fiber);
      trackDebugInfoFromUsedThenables(fiber);
      if (fiber.tag === HostHoistable) {
        const nearestInstance = reconcilingParent;
        if (nearestInstance === null) {
          throw new Error('Did not expect a host hoistable to be the root');
        }
        aquireHostResource(nearestInstance, fiber.memoizedState);
        trackDebugInfoFromHostResource(nearestInstance, fiber);
      } else if (fiber.tag === HostComponent || fiber.tag === HostText || fiber.tag === HostSingleton) {
        const nearestInstance = reconcilingParent;
        if (nearestInstance === null) {
          throw new Error('Did not expect a host hoistable to be the root');
        }
        aquireHostInstance(nearestInstance, fiber.stateNode);
        trackDebugInfoFromHostComponent(nearestInstance, fiber);
      }
      if (isSuspendedOffscreen(fiber)) {
        const stashedDisconnected = isInDisconnectedSubtree;
        isInDisconnectedSubtree = true;
        try {
          if (fiber.child !== null) {
            mountChildrenRecursively(fiber.child, false);
          }
        } finally {
          isInDisconnectedSubtree = stashedDisconnected;
        }
      } else if (isHiddenOffscreen(fiber)) {
        if (isActivityHiddenOffscreen(fiber)) {
          if (fiber.child !== null) {
            mountChildrenRecursively(fiber.child, traceNearestHostComponentUpdate);
          }
        }
      } else if (fiber.tag === SuspenseComponent && OffscreenComponent === -1) {
        if (newSuspenseNode !== null) {
          trackThrownPromisesFromRetryCache(newSuspenseNode, fiber.stateNode);
        }
        const isTimedOut = fiber.memoizedState !== null;
        if (isTimedOut) {
          const primaryChildFragment = fiber.child;
          const fallbackChildFragment = primaryChildFragment ? primaryChildFragment.sibling : null;
          if (fallbackChildFragment) {
            const fallbackChild = fallbackChildFragment.child;
            if (fallbackChild !== null) {
              updateTrackedPathStateBeforeMount(fallbackChildFragment, null);
              mountChildrenRecursively(fallbackChild, traceNearestHostComponentUpdate);
            }
          }
        } else {
          const primaryChild = fiber.child;
          if (primaryChild !== null) {
            mountChildrenRecursively(primaryChild, traceNearestHostComponentUpdate);
          }
        }
      } else if (fiber.tag === SuspenseComponent && OffscreenComponent !== -1 && newInstance !== null && newSuspenseNode !== null) {
        const contentFiber = fiber.child;
        const hydrated = isFiberHydrated(fiber);
        if (hydrated) {
          if (contentFiber === null) {
            throw new Error('There should always be an Offscreen Fiber child in a hydrated Suspense boundary.');
          }
          trackThrownPromisesFromRetryCache(newSuspenseNode, fiber.stateNode);
          mountSuspenseChildrenRecursively(contentFiber, traceNearestHostComponentUpdate, stashedSuspenseParent, stashedSuspensePrevious, stashedSuspenseRemaining);
          shouldPopSuspenseNode = false;
        } else {}
      } else {
        if (fiber.child !== null) {
          mountChildrenRecursively(fiber.child, traceNearestHostComponentUpdate);
        }
      }
    } finally {
      isInFocusedActivity = stashedIsInActivitySlice;
      if (newInstance !== null) {
        reconcilingParent = stashedParent;
        previouslyReconciledSibling = stashedPrevious;
        remainingReconcilingChildren = stashedRemaining;
      }
      if (shouldPopSuspenseNode) {
        reconcilingParentSuspenseNode = stashedSuspenseParent;
        previouslyReconciledSiblingSuspenseNode = stashedSuspensePrevious;
        remainingReconcilingChildrenSuspenseNodes = stashedSuspenseRemaining;
      }
    }
    updateTrackedPathStateAfterMount(mightSiblingsBeOnTrackedPath);
  }
  function unmountInstanceRecursively(instance) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      debug('unmountInstanceRecursively()', instance, reconcilingParent);
    }
    let shouldPopSuspenseNode = false;
    const stashedParent = reconcilingParent;
    const stashedPrevious = previouslyReconciledSibling;
    const stashedRemaining = remainingReconcilingChildren;
    const stashedSuspenseParent = reconcilingParentSuspenseNode;
    const stashedSuspensePrevious = previouslyReconciledSiblingSuspenseNode;
    const stashedSuspenseRemaining = remainingReconcilingChildrenSuspenseNodes;
    const stashedIsInActivitySlice = isInFocusedActivity;
    const previousSuspendedBy = instance.suspendedBy;
    reconcilingParent = instance;
    previouslyReconciledSibling = null;
    remainingReconcilingChildren = instance.firstChild;
    instance.firstChild = null;
    instance.suspendedBy = null;
    if (instance.suspenseNode !== null) {
      reconcilingParentSuspenseNode = instance.suspenseNode;
      previouslyReconciledSiblingSuspenseNode = null;
      remainingReconcilingChildrenSuspenseNodes = instance.suspenseNode.firstChild;
      shouldPopSuspenseNode = true;
    }
    if (focusedActivity !== null) {
      if (instance.id === focusedActivityID) {
        isInFocusedActivity = true;
      } else if (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE && instance.data !== null && instance.data.tag === ActivityComponent) {}
    }
    try {
      if ((instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) && instance.data.tag === SuspenseComponent && OffscreenComponent !== -1) {
        const fiber = instance.data;
        const contentFiberInstance = remainingReconcilingChildren;
        const hydrated = isFiberHydrated(fiber);
        if (hydrated) {
          if (contentFiberInstance === null) {
            throw new Error('There should always be an Offscreen Fiber child in a hydrated Suspense boundary.');
          }
          unmountSuspenseChildrenRecursively(contentFiberInstance, stashedSuspenseParent, stashedSuspensePrevious, stashedSuspenseRemaining);
          shouldPopSuspenseNode = false;
        } else {
          if (contentFiberInstance !== null) {
            throw new Error('A dehydrated Suspense node should not have a content Fiber.');
          }
        }
      } else {
        unmountRemainingChildren();
      }
      removePreviousSuspendedBy(instance, previousSuspendedBy, reconcilingParentSuspenseNode);
    } finally {
      reconcilingParent = stashedParent;
      previouslyReconciledSibling = stashedPrevious;
      remainingReconcilingChildren = stashedRemaining;
      if (shouldPopSuspenseNode) {
        reconcilingParentSuspenseNode = stashedSuspenseParent;
        previouslyReconciledSiblingSuspenseNode = stashedSuspensePrevious;
        remainingReconcilingChildrenSuspenseNodes = stashedSuspenseRemaining;
      }
      isInFocusedActivity = stashedIsInActivitySlice;
    }
    if (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      recordUnmount(instance);
    } else if (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
      recordVirtualUnmount(instance);
    } else {
      untrackFiber(instance, instance.data);
    }
    removeChild(instance, null);
  }
  function recordProfilingDurations(fiberInstance, prevFiber) {
    const id = fiberInstance.id;
    const fiber = fiberInstance.data;
    const {
      actualDuration,
      treeBaseDuration
    } = fiber;
    fiberInstance.treeBaseDuration = treeBaseDuration || 0;
    if (isProfiling) {
      if (prevFiber == null || treeBaseDuration !== prevFiber.treeBaseDuration) {
        const convertedTreeBaseDuration = Math.floor((treeBaseDuration || 0) * 1000);
        pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_UPDATE_TREE_BASE_DURATION);
        pushOperation(id);
        pushOperation(convertedTreeBaseDuration);
      }
      if (prevFiber == null || prevFiber !== fiber && (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.didFiberRender)(ReactTypeOfWork, prevFiber, fiber)) {
        if (actualDuration != null) {
          let selfDuration = actualDuration;
          let child = fiber.child;
          while (child !== null) {
            selfDuration -= child.actualDuration || 0;
            child = child.sibling;
          }
          const metadata = currentCommitProfilingMetadata;
          metadata.durations.push(id, actualDuration, selfDuration);
          metadata.maxActualDuration = Math.max(metadata.maxActualDuration, actualDuration);
          if (recordChangeDescriptions) {
            const changeDescription = getChangeDescription(prevFiber, fiber);
            if (changeDescription !== null) {
              if (metadata.changeDescriptions !== null) {
                metadata.changeDescriptions.set(id, changeDescription);
              }
            }
          }
        }
      }
      const fiberRoot = currentRoot.data.stateNode;
      const updaters = fiberRoot.memoizedUpdaters;
      if (updaters != null && (updaters.has(fiber) || fiber.alternate !== null && updaters.has(fiber.alternate))) {
        const metadata = currentCommitProfilingMetadata;
        if (metadata.updaters === null) {
          metadata.updaters = [];
        }
        metadata.updaters.push(instanceToSerializedElement(fiberInstance));
      }
    }
  }
  function recordVirtualProfilingDurations(virtualInstance) {
    const id = virtualInstance.id;
    let treeBaseDuration = 0;
    for (let child = virtualInstance.firstChild; child !== null; child = child.nextSibling) {
      treeBaseDuration += child.treeBaseDuration;
    }
    if (isProfiling) {
      const previousTreeBaseDuration = virtualInstance.treeBaseDuration;
      if (treeBaseDuration !== previousTreeBaseDuration) {
        const convertedTreeBaseDuration = Math.floor((treeBaseDuration || 0) * 1000);
        pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_UPDATE_TREE_BASE_DURATION);
        pushOperation(id);
        pushOperation(convertedTreeBaseDuration);
      }
    }
    virtualInstance.treeBaseDuration = treeBaseDuration;
  }
  function addUnfilteredChildrenIDs(parentInstance, nextChildren) {
    let child = parentInstance.firstChild;
    while (child !== null) {
      if (child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
        const fiber = child.data;
        if (isHiddenOffscreen(fiber) && !isActivityHiddenOffscreen(fiber)) {} else {
          addUnfilteredChildrenIDs(child, nextChildren);
        }
      } else {
        nextChildren.push(child.id);
      }
      child = child.nextSibling;
    }
  }
  function recordResetChildren(parentInstance) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      if (parentInstance.firstChild !== null) {
        debug('recordResetChildren()', parentInstance.firstChild, parentInstance);
      }
    }
    const nextChildren = [];
    addUnfilteredChildrenIDs(parentInstance, nextChildren);
    const numChildren = nextChildren.length;
    if (numChildren < 2) {
      return;
    }
    pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_REORDER_CHILDREN);
    pushOperation(parentInstance.id);
    pushOperation(numChildren);
    for (let i = 0; i < nextChildren.length; i++) {
      pushOperation(nextChildren[i]);
    }
  }
  function addUnfilteredSuspenseChildrenIDs(parentInstance, nextChildren) {
    let child = parentInstance.firstChild;
    while (child !== null) {
      if (child.instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
        addUnfilteredSuspenseChildrenIDs(child, nextChildren);
      } else {
        nextChildren.push(child.instance.id);
      }
      child = child.nextSibling;
    }
  }
  function recordResetSuspenseChildren(parentInstance) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      if (parentInstance.firstChild !== null) {
        console.log('recordResetSuspenseChildren()', parentInstance.firstChild, parentInstance);
      }
    }
    const nextChildren = [];
    addUnfilteredSuspenseChildrenIDs(parentInstance, nextChildren);
    const numChildren = nextChildren.length;
    if (numChildren < 2) {
      return;
    }
    pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.SUSPENSE_TREE_OPERATION_REORDER_CHILDREN);
    pushOperation(parentInstance.instance.id);
    pushOperation(numChildren);
    for (let i = 0; i < nextChildren.length; i++) {
      pushOperation(nextChildren[i]);
    }
  }
  function updateVirtualInstanceRecursively(virtualInstance, nextFirstChild, nextLastChild, prevFirstChild, traceNearestHostComponentUpdate, virtualLevel) {
    const stashedParent = reconcilingParent;
    const stashedPrevious = previouslyReconciledSibling;
    const stashedRemaining = remainingReconcilingChildren;
    const previousSuspendedBy = virtualInstance.suspendedBy;
    reconcilingParent = virtualInstance;
    previouslyReconciledSibling = null;
    remainingReconcilingChildren = virtualInstance.firstChild;
    virtualInstance.firstChild = null;
    virtualInstance.suspendedBy = null;
    try {
      let updateFlags = updateVirtualChildrenRecursively(nextFirstChild, nextLastChild, prevFirstChild, null, traceNearestHostComponentUpdate, virtualLevel + 1);
      if ((updateFlags & ShouldResetChildren) !== NoUpdate) {
        if (!isInDisconnectedSubtree) {
          recordResetChildren(virtualInstance);
        }
        updateFlags &= ~ShouldResetChildren;
      }
      removePreviousSuspendedBy(virtualInstance, previousSuspendedBy, reconcilingParentSuspenseNode);
      const componentLogsEntry = _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_8__.componentInfoToComponentLogsMap.get(virtualInstance.data);
      recordConsoleLogs(virtualInstance, componentLogsEntry);
      recordVirtualProfilingDurations(virtualInstance);
      return updateFlags;
    } finally {
      unmountRemainingChildren();
      reconcilingParent = stashedParent;
      previouslyReconciledSibling = stashedPrevious;
      remainingReconcilingChildren = stashedRemaining;
    }
  }
  function updateVirtualChildrenRecursively(nextFirstChild, nextLastChild, prevFirstChild, prevLastChild, traceNearestHostComponentUpdate, virtualLevel) {
    let updateFlags = NoUpdate;
    let nextChild = nextFirstChild;
    let prevChildAtSameIndex = prevFirstChild;
    let previousVirtualInstance = null;
    let previousVirtualInstanceWasMount = false;
    let previousVirtualInstanceNextFirstFiber = nextFirstChild;
    let previousVirtualInstancePrevFirstFiber = prevFirstChild;
    while (nextChild !== null && nextChild !== nextLastChild) {
      let level = 0;
      if (nextChild._debugInfo) {
        for (let i = 0; i < nextChild._debugInfo.length; i++) {
          const debugEntry = nextChild._debugInfo[i];
          if (debugEntry.awaited) {
            const asyncInfo = debugEntry;
            if (level === virtualLevel) {
              insertSuspendedBy(asyncInfo);
            }
            continue;
          }
          if (typeof debugEntry.name !== 'string') {
            continue;
          }
          const componentInfo = debugEntry;
          const secondaryEnv = (0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.getSecondaryEnvironmentName)(nextChild._debugInfo, i);
          if (componentInfo.env != null) {
            knownEnvironmentNames.add(componentInfo.env);
          }
          if (secondaryEnv !== null) {
            knownEnvironmentNames.add(secondaryEnv);
          }
          if (shouldFilterVirtual(componentInfo, secondaryEnv)) {
            continue;
          }
          if (level === virtualLevel) {
            if (previousVirtualInstance === null || previousVirtualInstance.data !== componentInfo) {
              if (previousVirtualInstance !== null) {
                if (previousVirtualInstanceWasMount) {
                  mountVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceNextFirstFiber, nextChild, traceNearestHostComponentUpdate, virtualLevel);
                  updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
                } else {
                  updateFlags |= updateVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceNextFirstFiber, nextChild, previousVirtualInstancePrevFirstFiber, traceNearestHostComponentUpdate, virtualLevel);
                }
              }
              let previousSiblingOfBestMatch = null;
              let bestMatch = remainingReconcilingChildren;
              if (componentInfo.key != null && componentInfo.key !== _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.REACT_OPTIMISTIC_KEY) {
                bestMatch = remainingReconcilingChildren;
                while (bestMatch !== null) {
                  if (bestMatch.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE && bestMatch.data.key === componentInfo.key) {
                    break;
                  }
                  previousSiblingOfBestMatch = bestMatch;
                  bestMatch = bestMatch.nextSibling;
                }
              }
              if (bestMatch !== null && bestMatch.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE && bestMatch.data.name === componentInfo.name && bestMatch.data.env === componentInfo.env && bestMatch.data.key === componentInfo.key) {
                bestMatch.data = componentInfo;
                moveChild(bestMatch, previousSiblingOfBestMatch);
                previousVirtualInstance = bestMatch;
                previousVirtualInstanceWasMount = false;
              } else {
                const newVirtualInstance = createVirtualInstance(componentInfo);
                recordVirtualMount(newVirtualInstance, reconcilingParent, secondaryEnv);
                insertChild(newVirtualInstance);
                previousVirtualInstance = newVirtualInstance;
                previousVirtualInstanceWasMount = true;
                updateFlags |= ShouldResetChildren;
              }
              previousVirtualInstanceNextFirstFiber = nextChild;
              previousVirtualInstancePrevFirstFiber = prevChildAtSameIndex;
            }
            level++;
            break;
          } else {
            level++;
          }
        }
      }
      if (level === virtualLevel) {
        if (previousVirtualInstance !== null) {
          if (previousVirtualInstanceWasMount) {
            mountVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceNextFirstFiber, nextChild, traceNearestHostComponentUpdate, virtualLevel);
            updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
          } else {
            updateFlags |= updateVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceNextFirstFiber, nextChild, previousVirtualInstancePrevFirstFiber, traceNearestHostComponentUpdate, virtualLevel);
          }
          previousVirtualInstance = null;
        }
        let prevChild;
        if (prevChildAtSameIndex === nextChild) {
          prevChild = nextChild;
        } else {
          prevChild = nextChild.alternate;
        }
        let previousSiblingOfExistingInstance = null;
        let existingInstance = null;
        if (prevChild !== null) {
          existingInstance = remainingReconcilingChildren;
          while (existingInstance !== null) {
            if (existingInstance.data === prevChild) {
              break;
            }
            previousSiblingOfExistingInstance = existingInstance;
            existingInstance = existingInstance.nextSibling;
          }
        }
        if (existingInstance !== null) {
          const fiberInstance = existingInstance;
          if (prevChild !== prevChildAtSameIndex) {
            updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
          }
          moveChild(fiberInstance, previousSiblingOfExistingInstance);
          updateFlags |= updateFiberRecursively(fiberInstance, nextChild, prevChild, traceNearestHostComponentUpdate);
        } else if (prevChild !== null && shouldFilterFiber(nextChild)) {
          if (prevChild !== prevChildAtSameIndex) {
            updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
          }
          updateFlags |= updateFiberRecursively(null, nextChild, prevChild, traceNearestHostComponentUpdate);
        } else {
          mountFiberRecursively(nextChild, traceNearestHostComponentUpdate);
          updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
        }
      }
      nextChild = nextChild.sibling;
      if ((updateFlags & ShouldResetChildren) === NoUpdate && prevChildAtSameIndex !== null) {
        prevChildAtSameIndex = prevChildAtSameIndex.sibling;
      }
    }
    if (previousVirtualInstance !== null) {
      if (previousVirtualInstanceWasMount) {
        mountVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceNextFirstFiber, null, traceNearestHostComponentUpdate, virtualLevel);
        updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
      } else {
        updateFlags |= updateVirtualInstanceRecursively(previousVirtualInstance, previousVirtualInstanceNextFirstFiber, null, previousVirtualInstancePrevFirstFiber, traceNearestHostComponentUpdate, virtualLevel);
      }
    }
    if (prevChildAtSameIndex !== null && prevChildAtSameIndex !== prevLastChild) {
      updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
    }
    return updateFlags;
  }
  function updateChildrenRecursively(nextFirstChild, prevFirstChild, traceNearestHostComponentUpdate) {
    if (nextFirstChild === null) {
      return prevFirstChild !== null ? ShouldResetChildren : NoUpdate;
    }
    return updateVirtualChildrenRecursively(nextFirstChild, null, prevFirstChild, null, traceNearestHostComponentUpdate, 0);
  }
  function updateSuspenseChildrenRecursively(nextContentFiber, prevContentFiber, traceNearestHostComponentUpdate, stashedSuspenseParent, stashedSuspensePrevious, stashedSuspenseRemaining) {
    let updateFlags = NoUpdate;
    const prevFallbackFiber = prevContentFiber.sibling;
    const nextFallbackFiber = nextContentFiber.sibling;
    updateFlags |= updateVirtualChildrenRecursively(nextContentFiber, nextFallbackFiber, prevContentFiber, prevFallbackFiber, traceNearestHostComponentUpdate, 0);
    reconcilingParentSuspenseNode = stashedSuspenseParent;
    previouslyReconciledSiblingSuspenseNode = stashedSuspensePrevious;
    remainingReconcilingChildrenSuspenseNodes = stashedSuspenseRemaining;
    if (prevFallbackFiber !== null || nextFallbackFiber !== null) {
      if (nextFallbackFiber === null) {
        unmountRemainingChildren();
      } else {
        updateFlags |= updateVirtualChildrenRecursively(nextFallbackFiber, null, prevFallbackFiber, null, traceNearestHostComponentUpdate, 0);
        if ((updateFlags & ShouldResetSuspenseChildren) !== NoUpdate) {
          updateFlags |= ShouldResetParentSuspenseChildren;
          updateFlags &= ~ShouldResetSuspenseChildren;
        }
      }
    }
    return updateFlags;
  }
  function updateFiberRecursively(fiberInstance, nextFiber, prevFiber, traceNearestHostComponentUpdate) {
    if (_constants__WEBPACK_IMPORTED_MODULE_4__.__DEBUG__) {
      if (fiberInstance !== null) {
        debug('updateFiberRecursively()', fiberInstance, reconcilingParent);
      }
    }
    if (traceUpdatesEnabled) {
      const elementType = getElementTypeForFiber(nextFiber);
      if (traceNearestHostComponentUpdate) {
        if (elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeHostComponent) {
          traceUpdatesForNodes.add(nextFiber.stateNode);
          traceNearestHostComponentUpdate = false;
        }
      } else {
        if (elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeFunction || elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeClass || elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeContext || elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeMemo || elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeForwardRef) {
          if (prevFiber !== nextFiber) {
            traceNearestHostComponentUpdate = (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.didFiberRender)(ReactTypeOfWork, prevFiber, nextFiber);
          }
        }
      }
    }
    const stashedParent = reconcilingParent;
    const stashedPrevious = previouslyReconciledSibling;
    const stashedRemaining = remainingReconcilingChildren;
    const stashedSuspenseParent = reconcilingParentSuspenseNode;
    const stashedSuspensePrevious = previouslyReconciledSiblingSuspenseNode;
    const stashedSuspenseRemaining = remainingReconcilingChildrenSuspenseNodes;
    const stashedIsInActivitySlice = isInFocusedActivity;
    let updateFlags = NoUpdate;
    let shouldMeasureSuspenseNode = false;
    let shouldPopSuspenseNode = false;
    let previousSuspendedBy = null;
    if (fiberInstance !== null) {
      previousSuspendedBy = fiberInstance.suspendedBy;
      fiberInstance.data = nextFiber;
      if (prevFiber !== nextFiber) {
        if (mostRecentlyInspectedElement !== null && (mostRecentlyInspectedElement.id === fiberInstance.id || mostRecentlyInspectedElement.type === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeRoot && nextFiber.tag === HostRoot) && (0,_shared_DevToolsFiberChangeDetection__WEBPACK_IMPORTED_MODULE_12__.didFiberRender)(ReactTypeOfWork, prevFiber, nextFiber)) {
          hasElementUpdatedSinceLastInspected = true;
        }
      }
      reconcilingParent = fiberInstance;
      previouslyReconciledSibling = null;
      remainingReconcilingChildren = fiberInstance.firstChild;
      fiberInstance.firstChild = null;
      fiberInstance.suspendedBy = null;
      const suspenseNode = fiberInstance.suspenseNode;
      if (suspenseNode !== null) {
        reconcilingParentSuspenseNode = suspenseNode;
        previouslyReconciledSiblingSuspenseNode = null;
        remainingReconcilingChildrenSuspenseNodes = suspenseNode.firstChild;
        suspenseNode.firstChild = null;
        shouldMeasureSuspenseNode = true;
        shouldPopSuspenseNode = true;
      }
      if (focusedActivity !== null) {
        if (fiberInstance.id === focusedActivityID) {
          isInFocusedActivity = true;
        } else if (nextFiber.tag === ActivityComponent) {}
      }
    }
    try {
      trackDebugInfoFromLazyType(nextFiber);
      trackDebugInfoFromUsedThenables(nextFiber);
      if (nextFiber.tag === HostHoistable) {
        const nearestInstance = reconcilingParent;
        if (nearestInstance === null) {
          throw new Error('Did not expect a host hoistable to be the root');
        }
        if (prevFiber.memoizedState !== nextFiber.memoizedState) {
          releaseHostResource(nearestInstance, prevFiber.memoizedState);
          aquireHostResource(nearestInstance, nextFiber.memoizedState);
        }
        trackDebugInfoFromHostResource(nearestInstance, nextFiber);
      } else if (nextFiber.tag === HostComponent || nextFiber.tag === HostText || nextFiber.tag === HostSingleton) {
        const nearestInstance = reconcilingParent;
        if (nearestInstance === null) {
          throw new Error('Did not expect a host hoistable to be the root');
        }
        if (prevFiber.stateNode !== nextFiber.stateNode) {
          releaseHostInstance(nearestInstance, prevFiber.stateNode);
          aquireHostInstance(nearestInstance, nextFiber.stateNode);
        }
        trackDebugInfoFromHostComponent(nearestInstance, nextFiber);
      }
      const isLegacySuspense = nextFiber.tag === SuspenseComponent && OffscreenComponent === -1;
      const prevDidTimeout = isLegacySuspense && prevFiber.memoizedState !== null;
      const nextDidTimeOut = isLegacySuspense && nextFiber.memoizedState !== null;
      const prevWasHidden = isHiddenOffscreen(prevFiber);
      const nextIsHidden = isHiddenOffscreen(nextFiber);
      const prevWasSuspended = isSuspendedOffscreen(prevFiber);
      const nextIsSuspended = isSuspendedOffscreen(nextFiber);
      if (isLegacySuspense) {
        if (fiberInstance !== null && fiberInstance.suspenseNode !== null) {
          const suspenseNode = fiberInstance.suspenseNode;
          if (prevFiber.stateNode === null !== (nextFiber.stateNode === null)) {
            trackThrownPromisesFromRetryCache(suspenseNode, nextFiber.stateNode);
          }
          if (prevFiber.memoizedState === null !== (nextFiber.memoizedState === null)) {
            recordSuspenseSuspenders(suspenseNode);
          }
        }
      }
      if (prevDidTimeout && nextDidTimeOut) {
        const nextFiberChild = nextFiber.child;
        const nextFallbackChildSet = nextFiberChild ? nextFiberChild.sibling : null;
        const prevFiberChild = prevFiber.child;
        const prevFallbackChildSet = prevFiberChild ? prevFiberChild.sibling : null;
        if (prevFallbackChildSet == null && nextFallbackChildSet != null) {
          mountChildrenRecursively(nextFallbackChildSet, traceNearestHostComponentUpdate);
          updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
        }
        const childrenUpdateFlags = nextFallbackChildSet != null && prevFallbackChildSet != null ? updateChildrenRecursively(nextFallbackChildSet, prevFallbackChildSet, traceNearestHostComponentUpdate) : NoUpdate;
        updateFlags |= childrenUpdateFlags;
      } else if (prevDidTimeout && !nextDidTimeOut) {
        const nextPrimaryChildSet = nextFiber.child;
        if (nextPrimaryChildSet !== null) {
          mountChildrenRecursively(nextPrimaryChildSet, traceNearestHostComponentUpdate);
          updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
        }
      } else if (!prevDidTimeout && nextDidTimeOut) {
        const nextFiberChild = nextFiber.child;
        const nextFallbackChildSet = nextFiberChild ? nextFiberChild.sibling : null;
        if (nextFallbackChildSet != null) {
          mountChildrenRecursively(nextFallbackChildSet, traceNearestHostComponentUpdate);
          updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
        }
      } else if (nextIsSuspended) {
        if (!prevWasSuspended) {
          if (fiberInstance !== null && !isInDisconnectedSubtree) {
            disconnectChildrenRecursively(remainingReconcilingChildren);
          }
        }
        const stashedDisconnected = isInDisconnectedSubtree;
        isInDisconnectedSubtree = true;
        try {
          updateFlags |= updateChildrenRecursively(nextFiber.child, prevFiber.child, false);
        } finally {
          isInDisconnectedSubtree = stashedDisconnected;
        }
      } else if (prevWasSuspended && !nextIsSuspended) {
        const stashedDisconnected = isInDisconnectedSubtree;
        isInDisconnectedSubtree = true;
        try {
          if (nextFiber.child !== null) {
            updateFlags |= updateChildrenRecursively(nextFiber.child, prevFiber.child, false);
          }
          unmountRemainingChildren();
          remainingReconcilingChildren = null;
        } finally {
          isInDisconnectedSubtree = stashedDisconnected;
        }
        if (fiberInstance !== null && !isInDisconnectedSubtree) {
          reconnectChildrenRecursively(fiberInstance);
          updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
        }
      } else if (nextIsHidden) {
        if (isActivityHiddenOffscreen(nextFiber)) {
          updateFlags |= updateChildrenRecursively(nextFiber.child, prevFiber.child, traceNearestHostComponentUpdate);
        } else if (prevWasHidden) {} else {
          unmountRemainingChildren();
        }
      } else if (prevWasHidden && !nextIsHidden) {
        if (nextFiber.return !== null && nextFiber.return.tag === ActivityComponent) {
          updateFlags |= updateChildrenRecursively(nextFiber.child, prevFiber.child, traceNearestHostComponentUpdate);
        } else {
          const nextChildSet = nextFiber.child;
          if (nextChildSet !== null) {
            mountChildrenRecursively(nextChildSet, traceNearestHostComponentUpdate);
            updateFlags |= ShouldResetChildren | ShouldResetSuspenseChildren;
          }
        }
      } else if (nextFiber.tag === SuspenseComponent && OffscreenComponent !== -1 && fiberInstance !== null && fiberInstance.suspenseNode !== null) {
        const suspenseNode = fiberInstance.suspenseNode;
        const prevContentFiber = prevFiber.child;
        const nextContentFiber = nextFiber.child;
        const previousHydrated = isFiberHydrated(prevFiber);
        const nextHydrated = isFiberHydrated(nextFiber);
        if (previousHydrated && nextHydrated) {
          if (nextContentFiber === null || prevContentFiber === null) {
            throw new Error('There should always be an Offscreen Fiber child in a hydrated Suspense boundary.');
          }
          if (prevFiber.stateNode === null !== (nextFiber.stateNode === null)) {
            trackThrownPromisesFromRetryCache(suspenseNode, nextFiber.stateNode);
          }
          if (prevFiber.memoizedState === null !== (nextFiber.memoizedState === null)) {
            recordSuspenseSuspenders(suspenseNode);
          }
          shouldMeasureSuspenseNode = false;
          updateFlags |= updateSuspenseChildrenRecursively(nextContentFiber, prevContentFiber, traceNearestHostComponentUpdate, stashedSuspenseParent, stashedSuspensePrevious, stashedSuspenseRemaining);
          shouldPopSuspenseNode = false;
          if (nextFiber.memoizedState === null) {
            shouldMeasureSuspenseNode = !isInDisconnectedSubtree;
          }
        } else if (!previousHydrated && nextHydrated) {
          if (nextContentFiber === null) {
            throw new Error('There should always be an Offscreen Fiber child in a hydrated Suspense boundary.');
          }
          trackThrownPromisesFromRetryCache(suspenseNode, nextFiber.stateNode);
          recordSuspenseSuspenders(suspenseNode);
          mountSuspenseChildrenRecursively(nextContentFiber, traceNearestHostComponentUpdate, stashedSuspenseParent, stashedSuspensePrevious, stashedSuspenseRemaining);
          shouldPopSuspenseNode = false;
        } else if (previousHydrated && !nextHydrated) {
          throw new Error('Encountered a dehydrated Suspense boundary that was previously hydrated.');
        } else {}
      } else {
        if (nextFiber.child !== prevFiber.child) {
          updateFlags |= updateChildrenRecursively(nextFiber.child, prevFiber.child, traceNearestHostComponentUpdate);
        } else {
          if (fiberInstance !== null) {
            fiberInstance.firstChild = remainingReconcilingChildren;
            remainingReconcilingChildren = null;
            consumeSuspenseNodesOfExistingInstance(fiberInstance);
            if (traceUpdatesEnabled) {
              if (traceNearestHostComponentUpdate) {
                const hostInstances = findAllCurrentHostInstances(fiberInstance);
                hostInstances.forEach(hostInstance => {
                  traceUpdatesForNodes.add(hostInstance);
                });
              }
            }
          } else {
            const childrenUpdateFlags = updateChildrenRecursively(nextFiber.child, prevFiber.child, false);
            if ((childrenUpdateFlags & ShouldResetChildren) !== NoUpdate) {
              throw new Error('The children should not have changed if we pass in the same set.');
            }
            updateFlags |= childrenUpdateFlags;
          }
        }
      }
      if (fiberInstance !== null) {
        if (prevFiber.tag === ActivityComponent && nextFiber.tag === ActivityComponent && fiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
          const prevOffscreen = prevFiber.child;
          const nextOffscreen = nextFiber.child;
          if (prevOffscreen !== null && nextOffscreen !== null) {
            const prevHidden = isHiddenOffscreen(prevOffscreen);
            const nextHidden = isHiddenOffscreen(nextOffscreen);
            if (prevHidden !== nextHidden) {
              pushOperation(_constants__WEBPACK_IMPORTED_MODULE_4__.TREE_OPERATION_SET_SUBTREE_MODE);
              pushOperation(fiberInstance.id);
              pushOperation(nextHidden ? react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ActivityHiddenMode : react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ActivityVisibleMode);
            }
          }
        }
        removePreviousSuspendedBy(fiberInstance, previousSuspendedBy, shouldPopSuspenseNode ? reconcilingParentSuspenseNode : stashedSuspenseParent);
        if (fiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
          let componentLogsEntry = fiberToComponentLogsMap.get(fiberInstance.data);
          if (componentLogsEntry === undefined && fiberInstance.data.alternate) {
            componentLogsEntry = fiberToComponentLogsMap.get(fiberInstance.data.alternate);
          }
          recordConsoleLogs(fiberInstance, componentLogsEntry);
          if (!isInDisconnectedSubtree) {
            const isProfilingSupported = nextFiber.hasOwnProperty('treeBaseDuration');
            if (isProfilingSupported) {
              recordProfilingDurations(fiberInstance, prevFiber);
            }
          }
        }
      }
      if ((updateFlags & ShouldResetChildren) !== NoUpdate) {
        if (fiberInstance !== null && fiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
          if (!nextIsSuspended && !isInDisconnectedSubtree) {
            recordResetChildren(fiberInstance);
          }
          updateFlags &= ~ShouldResetChildren;
        } else {}
      } else {}
      if ((updateFlags & ShouldResetSuspenseChildren) !== NoUpdate) {
        if (fiberInstance !== null && fiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
          const suspenseNode = fiberInstance.suspenseNode;
          if (suspenseNode !== null) {
            recordResetSuspenseChildren(suspenseNode);
            updateFlags &= ~ShouldResetSuspenseChildren;
          }
        } else {}
      }
      if ((updateFlags & ShouldResetParentSuspenseChildren) !== NoUpdate) {
        if (fiberInstance !== null && fiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
          const suspenseNode = fiberInstance.suspenseNode;
          if (suspenseNode !== null) {
            updateFlags &= ~ShouldResetParentSuspenseChildren;
            updateFlags |= ShouldResetSuspenseChildren;
          }
        } else {}
      }
      return updateFlags;
    } finally {
      if (fiberInstance !== null) {
        unmountRemainingChildren();
        reconcilingParent = stashedParent;
        previouslyReconciledSibling = stashedPrevious;
        remainingReconcilingChildren = stashedRemaining;
        if (shouldMeasureSuspenseNode) {
          if (!isInDisconnectedSubtree) {
            const suspenseNode = fiberInstance.suspenseNode;
            if (suspenseNode === null) {
              throw new Error('Attempted to measure a Suspense node that does not exist.');
            }
            const prevRects = suspenseNode.rects;
            const nextRects = measureInstance(fiberInstance);
            if (!(0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.areEqualRects)(prevRects, nextRects)) {
              suspenseNode.rects = nextRects;
              recordSuspenseResize(suspenseNode);
            }
          }
        }
        if (shouldPopSuspenseNode) {
          reconcilingParentSuspenseNode = stashedSuspenseParent;
          previouslyReconciledSiblingSuspenseNode = stashedSuspensePrevious;
          remainingReconcilingChildrenSuspenseNodes = stashedSuspenseRemaining;
        }
        isInFocusedActivity = stashedIsInActivitySlice;
      }
    }
  }
  function disconnectChildrenRecursively(firstChild) {
    for (let child = firstChild; child !== null; child = child.nextSibling) {
      if ((child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) && isSuspendedOffscreen(child.data)) {} else {
        disconnectChildrenRecursively(child.firstChild);
      }
      if (child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
        recordDisconnect(child);
      } else if (child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
        recordVirtualDisconnect(child);
      }
    }
  }
  function reconnectChildrenRecursively(parentInstance) {
    for (let child = parentInstance.firstChild; child !== null; child = child.nextSibling) {
      if (child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
        recordReconnect(child, parentInstance);
      } else if (child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
        const secondaryEnv = null;
        recordVirtualReconnect(child, parentInstance, secondaryEnv);
      }
      if ((child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || child.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) && isHiddenOffscreen(child.data) && !isActivityHiddenOffscreen(child.data)) {} else {
        reconnectChildrenRecursively(child);
      }
    }
  }
  function cleanup() {
    isProfiling = false;
  }
  function flushInitialOperations() {
    const localPendingOperationsQueue = pendingOperationsQueue;
    pendingOperationsQueue = null;
    if (localPendingOperationsQueue !== null && localPendingOperationsQueue.length > 0) {
      localPendingOperationsQueue.forEach(operations => {
        hook.emit('operations', operations);
      });
    } else {
      if (trackedPath !== null) {
        mightBeOnTrackedPath = true;
      }
      hook.getFiberRoots(rendererID).forEach(root => {
        const current = root.current;
        const newRoot = createFiberInstance(current);
        rootToFiberInstanceMap.set(root, newRoot);
        idToDevToolsInstanceMap.set(newRoot.id, newRoot);
        currentRoot = newRoot;
        setRootPseudoKey(currentRoot.id, root.current);
        if (isProfiling && (0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.rootSupportsProfiling)(root)) {
          currentCommitProfilingMetadata = {
            changeDescriptions: recordChangeDescriptions ? new Map() : null,
            durations: [],
            commitTime: (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getCurrentTime)() - profilingStartTime,
            maxActualDuration: 0,
            priorityLevel: null,
            updaters: null,
            effectDuration: null,
            passiveEffectDuration: null
          };
        }
        mountFiberRecursively(root.current, false);
        flushPendingEvents(currentRoot);
        currentRoot = null;
      });
      needsToFlushComponentLogs = false;
    }
  }
  function handleCommitFiberUnmount(fiber) {}
  function handlePostCommitFiberRoot(root) {
    if (isProfiling && (0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.rootSupportsProfiling)(root)) {
      if (currentCommitProfilingMetadata !== null) {
        const {
          effectDuration,
          passiveEffectDuration
        } = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.getEffectDurations)(root);
        currentCommitProfilingMetadata.effectDuration = effectDuration;
        currentCommitProfilingMetadata.passiveEffectDuration = passiveEffectDuration;
      }
    }
    if (needsToFlushComponentLogs) {
      const rootInstance = rootToFiberInstanceMap.get(root);
      if (rootInstance === undefined) {
        throw new Error('Should have a root instance for a committed root. This is a bug in React DevTools.');
      }
      bruteForceFlushErrorsAndWarnings(rootInstance);
    }
  }
  function handleCommitFiberRoot(root, priorityLevel) {
    const nextFiber = root.current;
    let prevFiber = null;
    let rootInstance = rootToFiberInstanceMap.get(root);
    if (!rootInstance) {
      rootInstance = createFiberInstance(nextFiber);
      rootToFiberInstanceMap.set(root, rootInstance);
      idToDevToolsInstanceMap.set(rootInstance.id, rootInstance);
    } else {
      prevFiber = rootInstance.data;
    }
    currentRoot = rootInstance;
    if (trackedPath !== null) {
      mightBeOnTrackedPath = true;
    }
    if (traceUpdatesEnabled) {
      traceUpdatesForNodes.clear();
    }
    const isProfilingSupported = (0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.rootSupportsProfiling)(root);
    if (isProfiling && isProfilingSupported) {
      currentCommitProfilingMetadata = {
        changeDescriptions: recordChangeDescriptions ? new Map() : null,
        durations: [],
        commitTime: (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getCurrentTime)() - profilingStartTime,
        maxActualDuration: 0,
        priorityLevel: priorityLevel == null ? null : formatPriorityLevel(priorityLevel),
        updaters: null,
        effectDuration: null,
        passiveEffectDuration: null
      };
    }
    const nextIsMounted = nextFiber.child !== null;
    const prevWasMounted = prevFiber !== null && prevFiber.child !== null;
    if (!prevWasMounted && nextIsMounted) {
      setRootPseudoKey(currentRoot.id, nextFiber);
      mountFiberRecursively(nextFiber, false);
    } else if (prevWasMounted && nextIsMounted) {
      if (prevFiber === null) {
        throw new Error('Expected a previous Fiber when updating an existing root.');
      }
      updateFiberRecursively(rootInstance, nextFiber, prevFiber, false);
    } else if (prevWasMounted && !nextIsMounted) {
      unmountInstanceRecursively(rootInstance);
      removeRootPseudoKey(currentRoot.id);
      rootToFiberInstanceMap.delete(root);
    } else if (!prevWasMounted && !nextIsMounted) {
      rootToFiberInstanceMap.delete(root);
    }
    if (isProfiling && isProfilingSupported) {
      if (!shouldBailoutWithPendingOperations()) {
        const commitProfilingMetadata = rootToCommitProfilingMetadataMap.get(currentRoot.id);
        if (commitProfilingMetadata != null) {
          commitProfilingMetadata.push(currentCommitProfilingMetadata);
        } else {
          rootToCommitProfilingMetadataMap.set(currentRoot.id, [currentCommitProfilingMetadata]);
        }
      }
    }
    flushPendingEvents(currentRoot);
    needsToFlushComponentLogs = false;
    if (traceUpdatesEnabled) {
      hook.emit('traceUpdates', traceUpdatesForNodes);
    }
    currentRoot = null;
  }
  function getResourceInstance(fiber) {
    if (fiber.tag === HostHoistable) {
      const resource = fiber.memoizedState;
      if (typeof resource === 'object' && resource !== null && resource.instance != null) {
        return resource.instance;
      }
    }
    return null;
  }
  function appendHostInstancesByDevToolsInstance(devtoolsInstance, hostInstances) {
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
      const fiber = devtoolsInstance.data;
      appendHostInstancesByFiber(fiber, hostInstances);
      return;
    }
    for (let child = devtoolsInstance.firstChild; child !== null; child = child.nextSibling) {
      appendHostInstancesByDevToolsInstance(child, hostInstances);
    }
  }
  function appendHostInstancesByFiber(fiber, hostInstances) {
    let node = fiber;
    while (true) {
      if (node.tag === HostComponent || node.tag === HostText || node.tag === HostSingleton || node.tag === HostHoistable) {
        const hostInstance = node.stateNode || getResourceInstance(node);
        if (hostInstance) {
          hostInstances.push(hostInstance);
        }
      } else if (node.child) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      if (node === fiber) {
        return;
      }
      while (!node.sibling) {
        if (!node.return || node.return === fiber) {
          return;
        }
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
  function findAllCurrentHostInstances(devtoolsInstance) {
    const hostInstances = [];
    appendHostInstancesByDevToolsInstance(devtoolsInstance, hostInstances);
    return hostInstances;
  }
  function findHostInstancesForElementID(id) {
    try {
      const devtoolsInstance = idToDevToolsInstanceMap.get(id);
      if (devtoolsInstance === undefined) {
        console.warn(`Could not find DevToolsInstance with id "${id}"`);
        return null;
      }
      return findAllCurrentHostInstances(devtoolsInstance);
    } catch (err) {
      return null;
    }
  }
  function findLastKnownRectsForID(id) {
    try {
      const devtoolsInstance = idToDevToolsInstanceMap.get(id);
      if (devtoolsInstance === undefined) {
        console.warn(`Could not find DevToolsInstance with id "${id}"`);
        return null;
      }
      if (devtoolsInstance.suspenseNode === null) {
        return null;
      }
      return devtoolsInstance.suspenseNode.rects;
    } catch (err) {
      return null;
    }
  }
  function getDisplayNameForElementID(id) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      return null;
    }
    if (devtoolsInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      const fiber = devtoolsInstance.data;
      if (fiber.tag === HostRoot) {
        return 'Initial Paint';
      }
      if (fiber.tag === SuspenseComponent || fiber.tag === ActivityComponent) {
        const props = fiber.memoizedProps;
        if (props.name != null) {
          return props.name;
        }
        const owner = getUnfilteredOwner(fiber);
        if (owner != null) {
          if (typeof owner.tag === 'number') {
            return getDisplayNameForFiber(owner);
          } else {
            return owner.name || '';
          }
        }
      }
      return getDisplayNameForFiber(fiber);
    } else {
      return devtoolsInstance.data.name || '';
    }
  }
  function getNearestSuspenseNode(instance) {
    while (instance.suspenseNode === null) {
      if (instance.parent === null) {
        throw new Error('There should always be a SuspenseNode parent on a mounted instance.');
      }
      instance = instance.parent;
    }
    return instance.suspenseNode;
  }
  function getNearestMountedDOMNode(publicInstance) {
    let domNode = publicInstance;
    while (domNode && !publicInstanceToDevToolsInstanceMap.has(domNode)) {
      domNode = domNode.parentNode;
    }
    return domNode;
  }
  function getElementIDForHostInstance(publicInstance) {
    const instance = publicInstanceToDevToolsInstanceMap.get(publicInstance);
    if (instance !== undefined) {
      if (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
        return instance.parent.id;
      }
      return instance.id;
    }
    return null;
  }
  function getSuspenseNodeIDForHostInstance(publicInstance) {
    const instance = publicInstanceToDevToolsInstanceMap.get(publicInstance);
    if (instance !== undefined) {
      let suspenseInstance = instance;
      while (suspenseInstance.suspenseNode === null || suspenseInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
        if (suspenseInstance.parent === null) {
          return null;
        }
        suspenseInstance = suspenseInstance.parent;
      }
      return suspenseInstance.id;
    }
    return null;
  }
  function getElementAttributeByPath(id, path) {
    if (isMostRecentlyInspectedElement(id)) {
      return (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getInObject)(mostRecentlyInspectedElement, path);
    }
    return undefined;
  }
  function getElementSourceFunctionById(id) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return null;
    }
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return null;
    }
    const fiber = devtoolsInstance.data;
    const {
      elementType,
      tag,
      type
    } = fiber;
    switch (tag) {
      case ClassComponent:
      case IncompleteClassComponent:
      case IncompleteFunctionComponent:
      case IndeterminateComponent:
      case FunctionComponent:
        return type;
      case ForwardRef:
        return type.render;
      case MemoComponent:
      case SimpleMemoComponent:
        return elementType != null && elementType.type != null ? elementType.type : type;
      default:
        return null;
    }
  }
  function instanceToSerializedElement(instance) {
    if (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      const fiber = instance.data;
      return {
        displayName: getDisplayNameForFiber(fiber) || 'Anonymous',
        id: instance.id,
        key: fiber.key === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.REACT_OPTIMISTIC_KEY ? 'React.optimisticKey' : fiber.key,
        env: null,
        stack: fiber._debugOwner == null || fiber._debugStack == null ? null : (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.parseStackTrace)(fiber._debugStack, 1),
        type: getElementTypeForFiber(fiber)
      };
    } else {
      const componentInfo = instance.data;
      return {
        displayName: componentInfo.name || 'Anonymous',
        id: instance.id,
        key: componentInfo.key == null || componentInfo.key === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.REACT_OPTIMISTIC_KEY ? 'React.optimisticKey' : componentInfo.key,
        env: componentInfo.env == null ? null : componentInfo.env,
        stack: componentInfo.owner == null || componentInfo.debugStack == null ? null : (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.parseStackTrace)(componentInfo.debugStack, 1),
        type: react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeVirtual
      };
    }
  }
  function getOwnersList(id) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return null;
    }
    const self = instanceToSerializedElement(devtoolsInstance);
    const owners = getOwnersListFromInstance(devtoolsInstance);
    if (owners === null) {
      return [self];
    }
    owners.unshift(self);
    owners.reverse();
    return owners;
  }
  function getOwnersListFromInstance(instance) {
    let owner = getUnfilteredOwner(instance.data);
    if (owner === null) {
      return null;
    }
    const owners = [];
    let parentInstance = instance.parent;
    while (parentInstance !== null && owner !== null) {
      const ownerInstance = findNearestOwnerInstance(parentInstance, owner);
      if (ownerInstance !== null) {
        owners.push(instanceToSerializedElement(ownerInstance));
        owner = getUnfilteredOwner(owner);
        parentInstance = ownerInstance.parent;
      } else {
        break;
      }
    }
    return owners;
  }
  function getUnfilteredOwner(owner) {
    if (owner == null) {
      return null;
    }
    if (typeof owner.tag === 'number') {
      const ownerFiber = owner;
      owner = ownerFiber._debugOwner;
    } else {
      const ownerInfo = owner;
      owner = ownerInfo.owner;
    }
    while (owner) {
      if (typeof owner.tag === 'number') {
        const ownerFiber = owner;
        if (!shouldFilterFiber(ownerFiber)) {
          return ownerFiber;
        }
        owner = ownerFiber._debugOwner;
      } else {
        const ownerInfo = owner;
        if (!shouldFilterVirtual(ownerInfo, null)) {
          return ownerInfo;
        }
        owner = ownerInfo.owner;
      }
    }
    return null;
  }
  function findNearestOwnerInstance(parentInstance, owner) {
    if (owner == null) {
      return null;
    }
    while (parentInstance !== null) {
      if (parentInstance.data === owner || parentInstance.data === owner.alternate) {
        if (parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
          return null;
        }
        return parentInstance;
      }
      parentInstance = parentInstance.parent;
    }
    return null;
  }
  function inspectHooks(fiber) {
    const originalConsoleMethods = {};
    for (const method in console) {
      try {
        originalConsoleMethods[method] = console[method];
        console[method] = () => {};
      } catch (error) {}
    }
    try {
      return (0,react_debug_tools__WEBPACK_IMPORTED_MODULE_5__.inspectHooksOfFiber)(fiber, (0,_shared_DevToolsReactDispatcher__WEBPACK_IMPORTED_MODULE_18__.getDispatcherRef)(renderer));
    } finally {
      for (const method in originalConsoleMethods) {
        try {
          console[method] = originalConsoleMethods[method];
        } catch (error) {}
      }
    }
  }
  function getSuspendedByOfSuspenseNode(suspenseNode, filterByChildInstance) {
    const result = [];
    if (!suspenseNode.hasUniqueSuspenders) {
      return result;
    }
    let hooksCacheKey = null;
    let hooksCache = null;
    const streamEntries = new Map();
    suspenseNode.suspendedBy.forEach((set, ioInfo) => {
      let parentNode = suspenseNode.parent;
      while (parentNode !== null) {
        if (parentNode.suspendedBy.has(ioInfo)) {
          return;
        }
        parentNode = parentNode.parent;
      }
      if (set.size === 0) {
        return;
      }
      let firstInstance = null;
      if (filterByChildInstance === null) {
        firstInstance = set.values().next().value;
      } else {
        for (const childInstance of set.values()) {
          if (firstInstance === null) {
            firstInstance = childInstance;
          }
          if (childInstance !== filterByChildInstance && !isChildOf(filterByChildInstance, childInstance, suspenseNode.instance)) {
            return;
          }
        }
      }
      if (firstInstance !== null && firstInstance.suspendedBy !== null) {
        const asyncInfo = (0,_shared_DevToolsFiberSuspense__WEBPACK_IMPORTED_MODULE_14__.getAwaitInSuspendedByFromIO)(firstInstance.suspendedBy, ioInfo);
        if (asyncInfo !== null) {
          let hooks = null;
          if (asyncInfo.stack == null && asyncInfo.owner == null) {
            if (hooksCacheKey === firstInstance) {
              hooks = hooksCache;
            } else if (firstInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
              const fiber = firstInstance.data;
              if (fiber.dependencies && fiber.dependencies._debugThenableState) {
                hooksCacheKey = firstInstance;
                hooksCache = hooks = inspectHooks(fiber);
              }
            }
          }
          const newIO = asyncInfo.awaited;
          if ((newIO.name === 'RSC stream' || newIO.name === 'rsc stream') && newIO.value != null) {
            const streamPromise = newIO.value;
            const existingEntry = streamEntries.get(streamPromise);
            if (existingEntry === undefined) {
              streamEntries.set(streamPromise, {
                asyncInfo,
                instance: firstInstance,
                hooks
              });
            } else {
              const existingIO = existingEntry.asyncInfo.awaited;
              if (newIO !== existingIO && (newIO.byteSize !== undefined && existingIO.byteSize !== undefined && newIO.byteSize > existingIO.byteSize || newIO.end > existingIO.end)) {
                existingEntry.asyncInfo = asyncInfo;
                existingEntry.instance = firstInstance;
                existingEntry.hooks = hooks;
              }
            }
          } else {
            result.push(serializeAsyncInfo(asyncInfo, firstInstance, hooks));
          }
        }
      }
    });
    streamEntries.forEach(({
      asyncInfo,
      instance,
      hooks
    }) => {
      result.push(serializeAsyncInfo(asyncInfo, instance, hooks));
    });
    return result;
  }
  function getSuspendedByOfInstance(devtoolsInstance, hooks) {
    const suspendedBy = devtoolsInstance.suspendedBy;
    if (suspendedBy === null) {
      return [];
    }
    const foundIOEntries = new Set();
    const streamEntries = new Map();
    const result = [];
    for (let i = 0; i < suspendedBy.length; i++) {
      const asyncInfo = suspendedBy[i];
      const ioInfo = asyncInfo.awaited;
      if (foundIOEntries.has(ioInfo)) {
        continue;
      }
      foundIOEntries.add(ioInfo);
      if ((ioInfo.name === 'RSC stream' || ioInfo.name === 'rsc stream') && ioInfo.value != null) {
        const streamPromise = ioInfo.value;
        const existingEntry = streamEntries.get(streamPromise);
        if (existingEntry === undefined) {
          streamEntries.set(streamPromise, asyncInfo);
        } else {
          const existingIO = existingEntry.awaited;
          if (ioInfo !== existingIO && (ioInfo.byteSize !== undefined && existingIO.byteSize !== undefined && ioInfo.byteSize > existingIO.byteSize || ioInfo.end > existingIO.end)) {
            streamEntries.set(streamPromise, asyncInfo);
          }
        }
      } else {
        result.push(serializeAsyncInfo(asyncInfo, devtoolsInstance, hooks));
      }
    }
    streamEntries.forEach(asyncInfo => {
      result.push(serializeAsyncInfo(asyncInfo, devtoolsInstance, hooks));
    });
    return result;
  }
  function getSuspendedByOfInstanceSubtree(devtoolsInstance) {
    let suspenseParentInstance = devtoolsInstance;
    while (suspenseParentInstance.suspenseNode === null) {
      if (suspenseParentInstance.parent === null) {
        return [];
      }
      suspenseParentInstance = suspenseParentInstance.parent;
    }
    const suspenseNode = suspenseParentInstance.suspenseNode;
    return getSuspendedByOfSuspenseNode(suspenseNode, devtoolsInstance);
  }
  const FALLBACK_THROTTLE_MS = 300;
  function getSuspendedByRange(suspenseNode) {
    let min = Infinity;
    let max = -Infinity;
    suspenseNode.suspendedBy.forEach((_, ioInfo) => {
      if (ioInfo.end > max) {
        max = ioInfo.end;
      }
      if (ioInfo.start < min) {
        min = ioInfo.start;
      }
    });
    const parentSuspenseNode = suspenseNode.parent;
    if (parentSuspenseNode !== null) {
      let parentMax = -Infinity;
      parentSuspenseNode.suspendedBy.forEach((_, ioInfo) => {
        if (ioInfo.end > parentMax) {
          parentMax = ioInfo.end;
        }
      });
      const throttleTime = parentMax + FALLBACK_THROTTLE_MS;
      if (throttleTime > max) {
        max = throttleTime;
      }
      let startTime = max - FALLBACK_THROTTLE_MS;
      if (parentMax > startTime) {
        startTime = parentMax;
      }
      if (startTime < min) {
        min = startTime;
      }
    }
    if (min < Infinity && max > -Infinity) {
      return [min, max];
    }
    return null;
  }
  function getAwaitStackFromHooks(hooks, asyncInfo) {
    for (let i = 0; i < hooks.length; i++) {
      const node = hooks[i];
      const debugInfo = node.debugInfo;
      if (debugInfo != null && debugInfo.indexOf(asyncInfo) !== -1) {
        const source = node.hookSource;
        if (source != null && source.functionName !== null && source.fileName !== null && source.lineNumber !== null && source.columnNumber !== null) {
          const callSite = [source.functionName, source.fileName, source.lineNumber, source.columnNumber, 0, 0, false];
          return [callSite];
        } else {
          return [];
        }
      }
      const matchedStack = getAwaitStackFromHooks(node.subHooks, asyncInfo);
      if (matchedStack !== null) {
        const source = node.hookSource;
        if (source != null && source.functionName !== null && source.fileName !== null && source.lineNumber !== null && source.columnNumber !== null) {
          const callSite = [source.functionName, source.fileName, source.lineNumber, source.columnNumber, 0, 0, false];
          matchedStack.push(callSite);
        }
        return matchedStack;
      }
    }
    return null;
  }
  function serializeAsyncInfo(asyncInfo, parentInstance, hooks) {
    const ioInfo = asyncInfo.awaited;
    const ioOwnerInstance = findNearestOwnerInstance(parentInstance, ioInfo.owner);
    let awaitStack = asyncInfo.debugStack == null ? null : (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.parseStackTrace)(asyncInfo.debugStack, 1);
    let awaitOwnerInstance;
    if (asyncInfo.owner == null && (awaitStack === null || awaitStack.length === 0)) {
      awaitStack = null;
      awaitOwnerInstance = parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE ? null : parentInstance;
      if (parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE || parentInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
        const fiber = parentInstance.data;
        switch (fiber.tag) {
          case ClassComponent:
          case FunctionComponent:
          case IncompleteClassComponent:
          case IncompleteFunctionComponent:
          case IndeterminateComponent:
          case MemoComponent:
          case SimpleMemoComponent:
            if (hooks !== null) {
              awaitStack = getAwaitStackFromHooks(hooks, asyncInfo);
            }
            break;
          default:
            if (fiber._debugOwner != null && fiber._debugStack != null && typeof fiber._debugStack !== 'string') {
              awaitStack = (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.parseStackTrace)(fiber._debugStack, 1);
              awaitOwnerInstance = findNearestOwnerInstance(parentInstance, fiber._debugOwner);
            }
        }
      }
    } else {
      awaitOwnerInstance = findNearestOwnerInstance(parentInstance, asyncInfo.owner);
    }
    const value = ioInfo.value;
    let resolvedValue = undefined;
    if (typeof value === 'object' && value !== null && typeof value.then === 'function') {
      switch (value.status) {
        case 'fulfilled':
          resolvedValue = value.value;
          break;
        case 'rejected':
          resolvedValue = value.reason;
          break;
      }
    }
    return {
      awaited: {
        name: ioInfo.name,
        description: (0,shared_ReactIODescription__WEBPACK_IMPORTED_MODULE_9__.getIODescription)(resolvedValue),
        start: ioInfo.start,
        end: ioInfo.end,
        byteSize: ioInfo.byteSize == null ? null : ioInfo.byteSize,
        value: ioInfo.value == null ? null : ioInfo.value,
        env: ioInfo.env == null ? null : ioInfo.env,
        owner: ioOwnerInstance === null ? null : instanceToSerializedElement(ioOwnerInstance),
        stack: ioInfo.debugStack == null ? null : (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.parseStackTrace)(ioInfo.debugStack, 1)
      },
      env: asyncInfo.env == null ? null : asyncInfo.env,
      owner: awaitOwnerInstance === null ? null : instanceToSerializedElement(awaitOwnerInstance),
      stack: awaitStack
    };
  }
  function getInstanceAndStyle(id) {
    let instance = null;
    let style = null;
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return {
        instance,
        style
      };
    }
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return {
        instance,
        style
      };
    }
    const fiber = devtoolsInstance.data;
    if (fiber !== null) {
      instance = fiber.stateNode;
      if (fiber.memoizedProps !== null) {
        style = fiber.memoizedProps.style;
      }
    }
    return {
      instance,
      style
    };
  }
  function inspectElementRaw(id) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return null;
    }
    if (devtoolsInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
      return inspectVirtualInstanceRaw(devtoolsInstance);
    }
    if (devtoolsInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      const isRoot = devtoolsInstance.parent === null;
      return isRoot ? inspectRootsRaw(devtoolsInstance.id) : inspectFiberInstanceRaw(devtoolsInstance);
    }
    devtoolsInstance;
    throw new Error('Unsupported instance kind');
  }
  function inspectFiberInstanceRaw(fiberInstance) {
    const fiber = fiberInstance.data;
    if (fiber == null) {
      return null;
    }
    const {
      stateNode,
      key,
      memoizedProps,
      memoizedState,
      dependencies,
      tag,
      type
    } = fiber;
    const elementType = getElementTypeForFiber(fiber);
    const usesHooks = (tag === FunctionComponent || tag === SimpleMemoComponent || tag === ForwardRef) && (!!memoizedState || !!dependencies);
    const showState = tag === ClassComponent || tag === IncompleteClassComponent;
    const typeSymbol = getTypeSymbol(type);
    let canViewSource = false;
    let context = null;
    if (tag === ClassComponent || tag === FunctionComponent || tag === IncompleteClassComponent || tag === IncompleteFunctionComponent || tag === IndeterminateComponent || tag === MemoComponent || tag === ForwardRef || tag === SimpleMemoComponent) {
      canViewSource = true;
      if (stateNode && stateNode.context != null) {
        const shouldHideContext = elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeClass && !(type.contextTypes || type.contextType);
        if (!shouldHideContext) {
          context = stateNode.context;
        }
      }
    } else if ((typeSymbol === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONTEXT_NUMBER || typeSymbol === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONTEXT_SYMBOL_STRING) && !(type._context === undefined && type.Provider === type)) {
      const consumerResolvedContext = type._context || type;
      context = consumerResolvedContext._currentValue || null;
      let current = fiber.return;
      while (current !== null) {
        const currentType = current.type;
        const currentTypeSymbol = getTypeSymbol(currentType);
        if (currentTypeSymbol === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.PROVIDER_NUMBER || currentTypeSymbol === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.PROVIDER_SYMBOL_STRING) {
          const providerResolvedContext = currentType._context || currentType.context;
          if (providerResolvedContext === consumerResolvedContext) {
            context = current.memoizedProps.value;
            break;
          }
        }
        current = current.return;
      }
    } else if (typeSymbol === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONSUMER_SYMBOL_STRING) {
      const consumerResolvedContext = type._context;
      context = consumerResolvedContext._currentValue || null;
      let current = fiber.return;
      while (current !== null) {
        const currentType = current.type;
        const currentTypeSymbol = getTypeSymbol(currentType);
        if (currentTypeSymbol === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.CONTEXT_SYMBOL_STRING) {
          const providerResolvedContext = currentType;
          if (providerResolvedContext === consumerResolvedContext) {
            context = current.memoizedProps.value;
            break;
          }
        }
        current = current.return;
      }
    }
    let hasLegacyContext = false;
    if (context !== null) {
      hasLegacyContext = !!type.contextTypes;
      context = {
        value: context
      };
    }
    const owners = getOwnersListFromInstance(fiberInstance);
    let hooks = null;
    if (usesHooks) {
      hooks = inspectHooks(fiber);
    }
    let rootType = null;
    let current = fiber;
    let hasErrorBoundary = false;
    let hasSuspenseBoundary = false;
    while (current.return !== null) {
      const temp = current;
      current = current.return;
      if (temp.tag === SuspenseComponent) {
        hasSuspenseBoundary = true;
      } else if ((0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.isErrorBoundary)(ReactTypeOfWork, temp)) {
        hasErrorBoundary = true;
      }
    }
    const fiberRoot = current.stateNode;
    if (fiberRoot != null && fiberRoot._debugRootType !== null) {
      rootType = fiberRoot._debugRootType;
    }
    let isErrored = false;
    if ((0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.isErrorBoundary)(ReactTypeOfWork, fiber)) {
      const DidCapture = 0b000000000000000000010000000;
      isErrored = (fiber.flags & DidCapture) !== 0 || forceErrorForFibers.get(fiber) === true || fiber.alternate !== null && forceErrorForFibers.get(fiber.alternate) === true;
    }
    const plugins = {
      stylex: null
    };
    if (react_devtools_feature_flags__WEBPACK_IMPORTED_MODULE_7__.enableStyleXFeatures) {
      if (memoizedProps != null && memoizedProps.hasOwnProperty('xstyle')) {
        plugins.stylex = (0,_StyleX_utils__WEBPACK_IMPORTED_MODULE_16__.getStyleXData)(memoizedProps.xstyle);
      }
    }
    let source = null;
    if (canViewSource) {
      source = getSourceForFiberInstance(fiberInstance);
    }
    let componentLogsEntry = fiberToComponentLogsMap.get(fiber);
    if (componentLogsEntry === undefined && fiber.alternate !== null) {
      componentLogsEntry = fiberToComponentLogsMap.get(fiber.alternate);
    }
    let nativeTag = null;
    if (elementType === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeHostComponent) {
      nativeTag = (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getNativeTag)(fiber.stateNode);
    }
    let isSuspended = null;
    if (tag === SuspenseComponent) {
      isSuspended = memoizedState !== null;
    }
    const suspendedBy = fiberInstance.suspenseNode !== null ? getSuspendedByOfSuspenseNode(fiberInstance.suspenseNode, null) : tag === ActivityComponent ? getSuspendedByOfInstanceSubtree(fiberInstance) : getSuspendedByOfInstance(fiberInstance, hooks);
    const suspendedByRange = getSuspendedByRange(getNearestSuspenseNode(fiberInstance));
    let unknownSuspenders = _constants__WEBPACK_IMPORTED_MODULE_4__.UNKNOWN_SUSPENDERS_NONE;
    if (fiberInstance.suspenseNode !== null && fiberInstance.suspenseNode.hasUnknownSuspenders && !isSuspended) {
      if (renderer.bundleType === 0) {
        unknownSuspenders = _constants__WEBPACK_IMPORTED_MODULE_4__.UNKNOWN_SUSPENDERS_REASON_PRODUCTION;
      } else if (!('_debugInfo' in fiber)) {
        unknownSuspenders = _constants__WEBPACK_IMPORTED_MODULE_4__.UNKNOWN_SUSPENDERS_REASON_OLD_VERSION;
      } else {
        unknownSuspenders = _constants__WEBPACK_IMPORTED_MODULE_4__.UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE;
      }
    }
    return {
      id: fiberInstance.id,
      canEditHooks: typeof overrideHookState === 'function',
      canEditFunctionProps: typeof overrideProps === 'function',
      canEditHooksAndDeletePaths: typeof overrideHookStateDeletePath === 'function',
      canEditHooksAndRenamePaths: typeof overrideHookStateRenamePath === 'function',
      canEditFunctionPropsDeletePaths: typeof overridePropsDeletePath === 'function',
      canEditFunctionPropsRenamePaths: typeof overridePropsRenamePath === 'function',
      canToggleError: supportsTogglingError && hasErrorBoundary,
      isErrored,
      canToggleSuspense: supportsTogglingSuspense && hasSuspenseBoundary && (!isSuspended || forceFallbackForFibers.has(fiber) || fiber.alternate !== null && forceFallbackForFibers.has(fiber.alternate)),
      isSuspended: isSuspended,
      source,
      stack: fiber._debugOwner == null || fiber._debugStack == null ? null : (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.parseStackTrace)(fiber._debugStack, 1),
      hasLegacyContext,
      key: key != null ? key === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.REACT_OPTIMISTIC_KEY ? 'React.optimisticKey' : key : null,
      type: elementType,
      context,
      hooks,
      props: memoizedProps,
      state: showState ? memoizedState : null,
      errors: componentLogsEntry === undefined ? [] : Array.from(componentLogsEntry.errors.entries()),
      warnings: componentLogsEntry === undefined ? [] : Array.from(componentLogsEntry.warnings.entries()),
      suspendedBy: suspendedBy,
      suspendedByRange: suspendedByRange,
      unknownSuspenders: unknownSuspenders,
      owners,
      env: null,
      rootType,
      rendererPackageName: renderer.rendererPackageName,
      rendererVersion: renderer.version,
      plugins,
      nativeTag
    };
  }
  function inspectVirtualInstanceRaw(virtualInstance) {
    const source = getSourceForInstance(virtualInstance);
    const componentInfo = virtualInstance.data;
    const key = typeof componentInfo.key === 'string' ? componentInfo.key : null;
    const props = componentInfo.props == null ? null : componentInfo.props;
    const owners = getOwnersListFromInstance(virtualInstance);
    let rootType = null;
    let hasErrorBoundary = false;
    let hasSuspenseBoundary = false;
    const nearestFiber = getNearestFiber(virtualInstance);
    if (nearestFiber !== null) {
      let current = nearestFiber;
      while (current.return !== null) {
        const temp = current;
        current = current.return;
        if (temp.tag === SuspenseComponent) {
          hasSuspenseBoundary = true;
        } else if ((0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.isErrorBoundary)(ReactTypeOfWork, temp)) {
          hasErrorBoundary = true;
        }
      }
      const fiberRoot = current.stateNode;
      if (fiberRoot != null && fiberRoot._debugRootType !== null) {
        rootType = fiberRoot._debugRootType;
      }
    }
    const plugins = {
      stylex: null
    };
    const componentLogsEntry = _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_8__.componentInfoToComponentLogsMap.get(componentInfo);
    const isSuspended = null;
    const suspendedBy = getSuspendedByOfInstance(virtualInstance, null);
    const suspendedByRange = getSuspendedByRange(getNearestSuspenseNode(virtualInstance));
    return {
      id: virtualInstance.id,
      canEditHooks: false,
      canEditFunctionProps: false,
      canEditHooksAndDeletePaths: false,
      canEditHooksAndRenamePaths: false,
      canEditFunctionPropsDeletePaths: false,
      canEditFunctionPropsRenamePaths: false,
      canToggleError: supportsTogglingError && hasErrorBoundary,
      isErrored: false,
      canToggleSuspense: supportsTogglingSuspense && hasSuspenseBoundary,
      isSuspended: isSuspended,
      source,
      stack: componentInfo.owner == null || componentInfo.debugStack == null ? null : (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.parseStackTrace)(componentInfo.debugStack, 1),
      hasLegacyContext: false,
      key: key,
      type: react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeVirtual,
      context: null,
      hooks: null,
      props: props,
      state: null,
      errors: componentLogsEntry === undefined ? [] : Array.from(componentLogsEntry.errors.entries()),
      warnings: componentLogsEntry === undefined ? [] : Array.from(componentLogsEntry.warnings.entries()),
      suspendedBy: suspendedBy,
      suspendedByRange: suspendedByRange,
      unknownSuspenders: _constants__WEBPACK_IMPORTED_MODULE_4__.UNKNOWN_SUSPENDERS_NONE,
      owners,
      env: componentInfo.env == null ? null : componentInfo.env,
      rootType,
      rendererPackageName: renderer.rendererPackageName,
      rendererVersion: renderer.version,
      plugins,
      nativeTag: null
    };
  }
  let mostRecentlyInspectedElement = null;
  let hasElementUpdatedSinceLastInspected = false;
  let currentlyInspectedPaths = {};
  function isMostRecentlyInspectedElement(id) {
    if (mostRecentlyInspectedElement === null) {
      return false;
    }
    if (mostRecentlyInspectedElement.id === id) {
      return true;
    }
    if (mostRecentlyInspectedElement.type === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeRoot) {
      const instance = idToDevToolsInstanceMap.get(id);
      return instance !== undefined && instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE && instance.parent === null;
    }
    return false;
  }
  function isMostRecentlyInspectedElementCurrent(id) {
    return isMostRecentlyInspectedElement(id) && !hasElementUpdatedSinceLastInspected;
  }
  function mergeInspectedPaths(path) {
    let current = currentlyInspectedPaths;
    path.forEach(key => {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    });
  }
  function createIsPathAllowed(key, secondaryCategory) {
    return function isPathAllowed(path) {
      switch (secondaryCategory) {
        case 'hooks':
          if (path.length === 1) {
            return true;
          }
          if (path[path.length - 2] === 'hookSource' && path[path.length - 1] === 'fileName') {
            return true;
          }
          if (path[path.length - 1] === 'subHooks' || path[path.length - 2] === 'subHooks') {
            return true;
          }
          break;
        case 'suspendedBy':
          if (path.length < 5) {
            return true;
          }
          break;
        default:
          break;
      }
      let current = key === null ? currentlyInspectedPaths : currentlyInspectedPaths[key];
      if (!current) {
        return false;
      }
      for (let i = 0; i < path.length; i++) {
        current = current[path[i]];
        if (!current) {
          return false;
        }
      }
      return true;
    };
  }
  function updateSelectedElement(inspectedElement) {
    const {
      hooks,
      id,
      props
    } = inspectedElement;
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return;
    }
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return;
    }
    const fiber = devtoolsInstance.data;
    const {
      elementType,
      stateNode,
      tag,
      type
    } = fiber;
    switch (tag) {
      case ClassComponent:
      case IncompleteClassComponent:
      case IndeterminateComponent:
        global.$r = stateNode;
        break;
      case IncompleteFunctionComponent:
      case FunctionComponent:
        global.$r = {
          hooks,
          props,
          type
        };
        break;
      case ForwardRef:
        global.$r = {
          hooks,
          props,
          type: type.render
        };
        break;
      case MemoComponent:
      case SimpleMemoComponent:
        global.$r = {
          hooks,
          props,
          type: elementType != null && elementType.type != null ? elementType.type : type
        };
        break;
      default:
        global.$r = null;
        break;
    }
  }
  function storeAsGlobal(id, path, count) {
    if (isMostRecentlyInspectedElement(id)) {
      const value = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getInObject)(mostRecentlyInspectedElement, path);
      const key = `$reactTemp${count}`;
      window[key] = value;
      console.log(key);
      console.log(value);
    }
  }
  function getSerializedElementValueByPath(id, path) {
    if (isMostRecentlyInspectedElement(id)) {
      const valueToCopy = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getInObject)(mostRecentlyInspectedElement, path);
      return (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.serializeToString)(valueToCopy);
    }
  }
  function inspectElement(requestID, id, path, forceFullData) {
    if (path !== null) {
      mergeInspectedPaths(path);
    }
    if (isMostRecentlyInspectedElement(id) && !forceFullData) {
      if (!hasElementUpdatedSinceLastInspected) {
        if (path !== null) {
          let secondaryCategory = null;
          if (path[0] === 'hooks' || path[0] === 'suspendedBy') {
            secondaryCategory = path[0];
          }
          return {
            id,
            responseID: requestID,
            type: 'hydrated-path',
            path,
            value: (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)((0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getInObject)(mostRecentlyInspectedElement, path), createIsPathAllowed(null, secondaryCategory), path)
          };
        } else {
          return {
            id,
            responseID: requestID,
            type: 'no-change'
          };
        }
      }
    } else {
      currentlyInspectedPaths = {};
    }
    hasElementUpdatedSinceLastInspected = false;
    try {
      mostRecentlyInspectedElement = inspectElementRaw(id);
    } catch (error) {
      if (error.name === 'ReactDebugToolsRenderError') {
        let message = 'Error rendering inspected element.';
        let stack;
        console.error(message + '\n\n', error);
        if (error.cause != null) {
          const componentName = getDisplayNameForElementID(id);
          console.error('React DevTools encountered an error while trying to inspect hooks. ' + 'This is most likely caused by an error in current inspected component' + (componentName != null ? `: "${componentName}".` : '.') + '\nThe error thrown in the component is: \n\n', error.cause);
          if (error.cause instanceof Error) {
            message = error.cause.message || message;
            stack = error.cause.stack;
          }
        }
        return {
          type: 'error',
          errorType: 'user',
          id,
          responseID: requestID,
          message,
          stack
        };
      }
      if (error.name === 'ReactDebugToolsUnsupportedHookError') {
        return {
          type: 'error',
          errorType: 'unknown-hook',
          id,
          responseID: requestID,
          message: 'Unsupported hook in the react-debug-tools package: ' + error.message
        };
      }
      console.error('Error inspecting element.\n\n', error);
      return {
        type: 'error',
        errorType: 'uncaught',
        id,
        responseID: requestID,
        message: error.message,
        stack: error.stack
      };
    }
    if (mostRecentlyInspectedElement === null) {
      return {
        id,
        responseID: requestID,
        type: 'not-found'
      };
    }
    const inspectedElement = mostRecentlyInspectedElement;
    updateSelectedElement(inspectedElement);
    const cleanedInspectedElement = {
      ...inspectedElement
    };
    cleanedInspectedElement.context = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.context, createIsPathAllowed('context', null));
    cleanedInspectedElement.hooks = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.hooks, createIsPathAllowed('hooks', 'hooks'));
    cleanedInspectedElement.props = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.props, createIsPathAllowed('props', null));
    cleanedInspectedElement.state = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.state, createIsPathAllowed('state', null));
    cleanedInspectedElement.suspendedBy = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.suspendedBy, createIsPathAllowed('suspendedBy', 'suspendedBy'));
    return {
      id,
      responseID: requestID,
      type: 'full-data',
      value: cleanedInspectedElement
    };
  }
  function inspectRootsRaw(arbitraryRootID) {
    const roots = hook.getFiberRoots(rendererID);
    if (roots.size === 0) {
      return null;
    }
    const inspectedRoots = {
      id: arbitraryRootID,
      type: react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeRoot,
      isErrored: false,
      errors: [],
      warnings: [],
      suspendedBy: [],
      suspendedByRange: null,
      unknownSuspenders: _constants__WEBPACK_IMPORTED_MODULE_4__.UNKNOWN_SUSPENDERS_NONE,
      rootType: null,
      plugins: {
        stylex: null
      },
      nativeTag: null,
      env: null,
      source: null,
      stack: null,
      rendererPackageName: null,
      rendererVersion: null,
      key: null,
      canEditFunctionProps: false,
      canEditHooks: false,
      canEditFunctionPropsDeletePaths: false,
      canEditFunctionPropsRenamePaths: false,
      canEditHooksAndDeletePaths: false,
      canEditHooksAndRenamePaths: false,
      canToggleError: false,
      canToggleSuspense: false,
      isSuspended: false,
      hasLegacyContext: false,
      context: null,
      hooks: null,
      props: null,
      state: null,
      owners: null
    };
    let minSuspendedByRange = Infinity;
    let maxSuspendedByRange = -Infinity;
    roots.forEach(root => {
      const rootInstance = rootToFiberInstanceMap.get(root);
      if (rootInstance === undefined) {
        throw new Error('Expected a root instance to exist for this Fiber root');
      }
      const inspectedRoot = inspectFiberInstanceRaw(rootInstance);
      if (inspectedRoot === null) {
        return;
      }
      if (inspectedRoot.isErrored) {
        inspectedRoots.isErrored = true;
      }
      for (let i = 0; i < inspectedRoot.errors.length; i++) {
        inspectedRoots.errors.push(inspectedRoot.errors[i]);
      }
      for (let i = 0; i < inspectedRoot.warnings.length; i++) {
        inspectedRoots.warnings.push(inspectedRoot.warnings[i]);
      }
      for (let i = 0; i < inspectedRoot.suspendedBy.length; i++) {
        inspectedRoots.suspendedBy.push(inspectedRoot.suspendedBy[i]);
      }
      const suspendedByRange = inspectedRoot.suspendedByRange;
      if (suspendedByRange !== null) {
        if (suspendedByRange[0] < minSuspendedByRange) {
          minSuspendedByRange = suspendedByRange[0];
        }
        if (suspendedByRange[1] > maxSuspendedByRange) {
          maxSuspendedByRange = suspendedByRange[1];
        }
      }
    });
    if (minSuspendedByRange !== Infinity || maxSuspendedByRange !== -Infinity) {
      inspectedRoots.suspendedByRange = [minSuspendedByRange, maxSuspendedByRange];
    }
    return inspectedRoots;
  }
  function logElementToConsole(id) {
    const result = isMostRecentlyInspectedElementCurrent(id) ? mostRecentlyInspectedElement : inspectElementRaw(id);
    if (result === null) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return;
    }
    const displayName = getDisplayNameForElementID(id);
    const supportsGroup = typeof console.groupCollapsed === 'function';
    if (supportsGroup) {
      console.groupCollapsed(`[Click to expand] %c<${displayName || 'Component'} />`, 'color: var(--dom-tag-name-color); font-weight: normal;');
    }
    if (result.props !== null) {
      console.log('Props:', result.props);
    }
    if (result.state !== null) {
      console.log('State:', result.state);
    }
    if (result.hooks !== null) {
      console.log('Hooks:', result.hooks);
    }
    const hostInstances = findHostInstancesForElementID(id);
    if (hostInstances !== null) {
      console.log('Nodes:', hostInstances);
    }
    if (window.chrome || /firefox/i.test(navigator.userAgent)) {
      console.log('Right-click any value to save it as a global variable for further inspection.');
    }
    if (supportsGroup) {
      console.groupEnd();
    }
  }
  function deletePath(type, id, hookID, path) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return;
    }
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return;
    }
    const fiber = devtoolsInstance.data;
    if (fiber !== null) {
      const instance = fiber.stateNode;
      switch (type) {
        case 'context':
          path = path.slice(1);
          switch (fiber.tag) {
            case ClassComponent:
              if (path.length === 0) {} else {
                (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.deletePathInObject)(instance.context, path);
              }
              instance.forceUpdate();
              break;
            case FunctionComponent:
              break;
          }
          break;
        case 'hooks':
          if (typeof overrideHookStateDeletePath === 'function') {
            overrideHookStateDeletePath(fiber, hookID, path);
          }
          break;
        case 'props':
          if (instance === null) {
            if (typeof overridePropsDeletePath === 'function') {
              overridePropsDeletePath(fiber, path);
            }
          } else {
            fiber.pendingProps = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.copyWithDelete)(instance.props, path);
            instance.forceUpdate();
          }
          break;
        case 'state':
          switch (fiber.tag) {
            case ClassComponent:
            case IncompleteClassComponent:
              (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.deletePathInObject)(instance.state, path);
              instance.forceUpdate();
              break;
          }
          break;
      }
    }
  }
  function renamePath(type, id, hookID, oldPath, newPath) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return;
    }
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return;
    }
    const fiber = devtoolsInstance.data;
    if (fiber !== null) {
      const instance = fiber.stateNode;
      switch (type) {
        case 'context':
          oldPath = oldPath.slice(1);
          newPath = newPath.slice(1);
          switch (fiber.tag) {
            case ClassComponent:
              if (oldPath.length === 0) {} else {
                (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.renamePathInObject)(instance.context, oldPath, newPath);
              }
              instance.forceUpdate();
              break;
            case FunctionComponent:
              break;
          }
          break;
        case 'hooks':
          if (typeof overrideHookStateRenamePath === 'function') {
            overrideHookStateRenamePath(fiber, hookID, oldPath, newPath);
          }
          break;
        case 'props':
          switch (fiber.tag) {
            case ClassComponent:
              fiber.pendingProps = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.copyWithRename)(instance.props, oldPath, newPath);
              instance.forceUpdate();
              break;
            default:
              if (typeof overridePropsRenamePath === 'function') {
                overridePropsRenamePath(fiber, oldPath, newPath);
              }
              break;
          }
          break;
        case 'state':
          switch (fiber.tag) {
            case ClassComponent:
            case IncompleteClassComponent:
              (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.renamePathInObject)(instance.state, oldPath, newPath);
              instance.forceUpdate();
              break;
          }
          break;
      }
    }
  }
  function overrideValueAtPath(type, id, hookID, path, value) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      console.warn(`Could not find DevToolsInstance with id "${id}"`);
      return;
    }
    if (devtoolsInstance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
      return;
    }
    const fiber = devtoolsInstance.data;
    if (fiber !== null) {
      const instance = fiber.stateNode;
      switch (type) {
        case 'context':
          path = path.slice(1);
          switch (fiber.tag) {
            case ClassComponent:
              if (path.length === 0) {
                instance.context = value;
              } else {
                (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.setInObject)(instance.context, path, value);
              }
              instance.forceUpdate();
              break;
            case FunctionComponent:
              break;
          }
          break;
        case 'hooks':
          if (typeof overrideHookState === 'function') {
            overrideHookState(fiber, hookID, path, value);
          }
          break;
        case 'props':
          switch (fiber.tag) {
            case ClassComponent:
              fiber.pendingProps = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.copyWithSet)(instance.props, path, value);
              instance.forceUpdate();
              break;
            default:
              if (typeof overrideProps === 'function') {
                overrideProps(fiber, path, value);
              }
              break;
          }
          break;
        case 'state':
          switch (fiber.tag) {
            case ClassComponent:
            case IncompleteClassComponent:
              (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.setInObject)(instance.state, path, value);
              instance.forceUpdate();
              break;
          }
          break;
      }
    }
  }
  let currentCommitProfilingMetadata = null;
  let displayNamesByRootID = null;
  let initialTreeBaseDurationsMap = null;
  let isProfiling = false;
  let profilingStartTime = 0;
  let recordChangeDescriptions = false;
  let rootToCommitProfilingMetadataMap = null;
  function getProfilingData() {
    const dataForRoots = [];
    if (rootToCommitProfilingMetadataMap === null) {
      throw Error('getProfilingData() called before any profiling data was recorded');
    }
    rootToCommitProfilingMetadataMap.forEach((commitProfilingMetadata, rootID) => {
      const commitData = [];
      const displayName = displayNamesByRootID !== null && displayNamesByRootID.get(rootID) || 'Unknown';
      const initialTreeBaseDurations = initialTreeBaseDurationsMap !== null && initialTreeBaseDurationsMap.get(rootID) || [];
      commitProfilingMetadata.forEach((commitProfilingData, commitIndex) => {
        const {
          changeDescriptions,
          durations,
          effectDuration,
          maxActualDuration,
          passiveEffectDuration,
          priorityLevel,
          commitTime,
          updaters
        } = commitProfilingData;
        const fiberActualDurations = [];
        const fiberSelfDurations = [];
        for (let i = 0; i < durations.length; i += 3) {
          const fiberID = durations[i];
          fiberActualDurations.push([fiberID, (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.formatDurationToMicrosecondsGranularity)(durations[i + 1])]);
          fiberSelfDurations.push([fiberID, (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.formatDurationToMicrosecondsGranularity)(durations[i + 2])]);
        }
        commitData.push({
          changeDescriptions: changeDescriptions !== null ? Array.from(changeDescriptions.entries()) : null,
          duration: (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.formatDurationToMicrosecondsGranularity)(maxActualDuration),
          effectDuration: effectDuration !== null ? (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.formatDurationToMicrosecondsGranularity)(effectDuration) : null,
          fiberActualDurations,
          fiberSelfDurations,
          passiveEffectDuration: passiveEffectDuration !== null ? (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.formatDurationToMicrosecondsGranularity)(passiveEffectDuration) : null,
          priorityLevel,
          timestamp: commitTime,
          updaters
        });
      });
      dataForRoots.push({
        commitData,
        displayName,
        initialTreeBaseDurations,
        rootID
      });
    });
    return {
      dataForRoots,
      rendererID
    };
  }
  function snapshotTreeBaseDurations(instance, target) {
    if (instance.kind !== _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FILTERED_FIBER_INSTANCE) {
      target.push([instance.id, instance.treeBaseDuration]);
    }
    for (let child = instance.firstChild; child !== null; child = child.nextSibling) {
      snapshotTreeBaseDurations(child, target);
    }
  }
  function startProfiling(shouldRecordChangeDescriptions) {
    if (isProfiling) {
      return;
    }
    recordChangeDescriptions = shouldRecordChangeDescriptions;
    displayNamesByRootID = new Map();
    initialTreeBaseDurationsMap = new Map();
    hook.getFiberRoots(rendererID).forEach(root => {
      const rootInstance = rootToFiberInstanceMap.get(root);
      if (rootInstance === undefined) {
        throw new Error('Expected the root instance to already exist when starting profiling');
      }
      const rootID = rootInstance.id;
      displayNamesByRootID.set(rootID, getDisplayNameForRoot(root.current));
      const initialTreeBaseDurations = [];
      snapshotTreeBaseDurations(rootInstance, initialTreeBaseDurations);
      initialTreeBaseDurationsMap.set(rootID, initialTreeBaseDurations);
    });
    isProfiling = true;
    profilingStartTime = (0,react_devtools_shared_src_backend_DevToolsNativeHost__WEBPACK_IMPORTED_MODULE_10__.getCurrentTime)();
    rootToCommitProfilingMetadataMap = new Map();
  }
  function stopProfiling() {
    isProfiling = false;
    recordChangeDescriptions = false;
  }
  if (shouldStartProfilingNow) {
    startProfiling(profilingSettings.recordChangeDescriptions);
  }
  function getNearestFiber(devtoolsInstance) {
    if (devtoolsInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
      let inst = devtoolsInstance;
      while (inst.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
        if (inst.firstChild === null) {
          return null;
        }
        inst = inst.firstChild;
      }
      return inst.data.return;
    } else {
      return devtoolsInstance.data;
    }
  }
  function shouldErrorFiberAlwaysNull() {
    return null;
  }
  const forceErrorForFibers = new Map();
  function shouldErrorFiberAccordingToMap(fiber) {
    if (typeof setErrorHandler !== 'function') {
      throw new Error('Expected overrideError() to not get called for earlier React versions.');
    }
    let status = forceErrorForFibers.get(fiber);
    if (status === false) {
      forceErrorForFibers.delete(fiber);
      if (forceErrorForFibers.size === 0) {
        setErrorHandler(shouldErrorFiberAlwaysNull);
      }
      return false;
    }
    if (status === undefined && fiber.alternate !== null) {
      status = forceErrorForFibers.get(fiber.alternate);
      if (status === false) {
        forceErrorForFibers.delete(fiber.alternate);
        if (forceErrorForFibers.size === 0) {
          setErrorHandler(shouldErrorFiberAlwaysNull);
        }
      }
    }
    if (status === undefined) {
      return null;
    }
    return status;
  }
  function overrideError(id, forceError) {
    if (typeof setErrorHandler !== 'function' || typeof scheduleUpdate !== 'function') {
      throw new Error('Expected overrideError() to not get called for earlier React versions.');
    }
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      return;
    }
    const nearestFiber = getNearestFiber(devtoolsInstance);
    if (nearestFiber === null) {
      return;
    }
    let fiber = nearestFiber;
    while (!(0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.isErrorBoundary)(ReactTypeOfWork, fiber)) {
      if (fiber.return === null) {
        return;
      }
      fiber = fiber.return;
    }
    forceErrorForFibers.set(fiber, forceError);
    if (fiber.alternate !== null) {
      forceErrorForFibers.delete(fiber.alternate);
    }
    if (forceErrorForFibers.size === 1) {
      setErrorHandler(shouldErrorFiberAccordingToMap);
    }
    if (!forceError && typeof scheduleRetry === 'function') {
      scheduleRetry(fiber);
    } else {
      scheduleUpdate(fiber);
    }
  }
  function shouldSuspendFiberAlwaysFalse() {
    return false;
  }
  const forceFallbackForFibers = new Set();
  function shouldSuspendFiberAccordingToSet(fiber) {
    return forceFallbackForFibers.has(fiber) || fiber.alternate !== null && forceFallbackForFibers.has(fiber.alternate);
  }
  function overrideSuspense(id, forceFallback) {
    if (typeof setSuspenseHandler !== 'function' || typeof scheduleUpdate !== 'function') {
      throw new Error('Expected overrideSuspense() to not get called for earlier React versions.');
    }
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      return;
    }
    const nearestFiber = getNearestFiber(devtoolsInstance);
    if (nearestFiber === null) {
      return;
    }
    let fiber = nearestFiber;
    while (fiber.tag !== SuspenseComponent) {
      if (fiber.return === null) {
        return;
      }
      fiber = fiber.return;
    }
    if (fiber.alternate !== null) {
      forceFallbackForFibers.delete(fiber.alternate);
    }
    if (forceFallback) {
      forceFallbackForFibers.add(fiber);
      if (forceFallbackForFibers.size === 1) {
        setSuspenseHandler(shouldSuspendFiberAccordingToSet);
      }
    } else {
      forceFallbackForFibers.delete(fiber);
      if (forceFallbackForFibers.size === 0) {
        setSuspenseHandler(shouldSuspendFiberAlwaysFalse);
      }
    }
    if (!forceFallback && typeof scheduleRetry === 'function') {
      scheduleRetry(fiber);
    } else {
      scheduleUpdate(fiber);
    }
  }
  function overrideSuspenseMilestone(suspendedSet) {
    if (typeof setSuspenseHandler !== 'function' || typeof scheduleUpdate !== 'function') {
      throw new Error('Expected overrideSuspenseMilestone() to not get called for earlier React versions.');
    }
    const unsuspendedSet = new Set(forceFallbackForFibers);
    let resuspended = false;
    for (let i = 0; i < suspendedSet.length; ++i) {
      const instance = idToDevToolsInstanceMap.get(suspendedSet[i]);
      if (instance === undefined) {
        console.warn(`Could not suspend ID '${suspendedSet[i]}' since the instance can't be found.`);
        continue;
      }
      if (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
        const fiber = instance.data;
        if (forceFallbackForFibers.has(fiber) || fiber.alternate !== null && forceFallbackForFibers.has(fiber.alternate)) {
          unsuspendedSet.delete(fiber);
          if (fiber.alternate !== null) {
            unsuspendedSet.delete(fiber.alternate);
          }
        } else {
          forceFallbackForFibers.add(fiber);
          scheduleUpdate(fiber);
          resuspended = true;
        }
      } else {
        console.warn(`Cannot not suspend ID '${suspendedSet[i]}'.`);
      }
    }
    unsuspendedSet.forEach(fiber => {
      forceFallbackForFibers.delete(fiber);
      if (!resuspended && typeof scheduleRetry === 'function') {
        scheduleRetry(fiber);
      } else {
        scheduleUpdate(fiber);
      }
    });
    if (forceFallbackForFibers.size > 0) {
      setSuspenseHandler(shouldSuspendFiberAccordingToSet);
    } else {
      setSuspenseHandler(shouldSuspendFiberAlwaysFalse);
    }
  }
  let trackedPath = null;
  let trackedPathMatchFiber = null;
  let trackedPathMatchInstance = null;
  let trackedPathMatchDepth = -1;
  let mightBeOnTrackedPath = false;
  function setTrackedPath(path) {
    if (path === null) {
      trackedPathMatchFiber = null;
      trackedPathMatchInstance = null;
      trackedPathMatchDepth = -1;
      mightBeOnTrackedPath = false;
    }
    trackedPath = path;
  }
  function updateTrackedPathStateBeforeMount(fiber, fiberInstance) {
    if (trackedPath === null || !mightBeOnTrackedPath) {
      return false;
    }
    const returnFiber = fiber.return;
    const returnAlternate = returnFiber !== null ? returnFiber.alternate : null;
    if (trackedPathMatchFiber === returnFiber || trackedPathMatchFiber === returnAlternate && returnAlternate !== null) {
      const actualFrame = getPathFrame(fiber);
      const expectedFrame = trackedPath[trackedPathMatchDepth + 1];
      if (expectedFrame === undefined) {
        throw new Error('Expected to see a frame at the next depth.');
      }
      if (actualFrame.index === expectedFrame.index && actualFrame.key === expectedFrame.key && actualFrame.displayName === expectedFrame.displayName) {
        trackedPathMatchFiber = fiber;
        if (fiberInstance !== null && fiberInstance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.FIBER_INSTANCE) {
          trackedPathMatchInstance = fiberInstance;
        }
        trackedPathMatchDepth++;
        if (trackedPathMatchDepth === trackedPath.length - 1) {
          mightBeOnTrackedPath = false;
        } else {
          mightBeOnTrackedPath = true;
        }
        return false;
      }
    }
    if (trackedPathMatchFiber === null && fiberInstance === null) {
      return true;
    }
    mightBeOnTrackedPath = false;
    return true;
  }
  function updateVirtualTrackedPathStateBeforeMount(virtualInstance, parentInstance) {
    if (trackedPath === null || !mightBeOnTrackedPath) {
      return false;
    }
    if (trackedPathMatchInstance === parentInstance) {
      const actualFrame = getVirtualPathFrame(virtualInstance);
      const expectedFrame = trackedPath[trackedPathMatchDepth + 1];
      if (expectedFrame === undefined) {
        throw new Error('Expected to see a frame at the next depth.');
      }
      if (actualFrame.index === expectedFrame.index && actualFrame.key === expectedFrame.key && actualFrame.displayName === expectedFrame.displayName) {
        trackedPathMatchFiber = null;
        trackedPathMatchInstance = virtualInstance;
        trackedPathMatchDepth++;
        if (trackedPathMatchDepth === trackedPath.length - 1) {
          mightBeOnTrackedPath = false;
        } else {
          mightBeOnTrackedPath = true;
        }
        return false;
      }
    }
    if (trackedPathMatchFiber !== null) {
      return true;
    }
    mightBeOnTrackedPath = false;
    return true;
  }
  function updateTrackedPathStateAfterMount(mightSiblingsBeOnTrackedPath) {
    mightBeOnTrackedPath = mightSiblingsBeOnTrackedPath;
  }
  const rootPseudoKeys = new Map();
  const rootDisplayNameCounter = new Map();
  function setRootPseudoKey(id, fiber) {
    const name = getDisplayNameForRoot(fiber);
    const counter = rootDisplayNameCounter.get(name) || 0;
    rootDisplayNameCounter.set(name, counter + 1);
    const pseudoKey = `${name}:${counter}`;
    rootPseudoKeys.set(id, pseudoKey);
  }
  function removeRootPseudoKey(id) {
    const pseudoKey = rootPseudoKeys.get(id);
    if (pseudoKey === undefined) {
      throw new Error('Expected root pseudo key to be known.');
    }
    const name = pseudoKey.slice(0, pseudoKey.lastIndexOf(':'));
    const counter = rootDisplayNameCounter.get(name);
    if (counter === undefined) {
      throw new Error('Expected counter to be known.');
    }
    if (counter > 1) {
      rootDisplayNameCounter.set(name, counter - 1);
    } else {
      rootDisplayNameCounter.delete(name);
    }
    rootPseudoKeys.delete(id);
  }
  function getDisplayNameForRoot(fiber) {
    let preferredDisplayName = null;
    let fallbackDisplayName = null;
    let child = fiber.child;
    for (let i = 0; i < 3; i++) {
      if (child === null) {
        break;
      }
      const displayName = getDisplayNameForFiber(child);
      if (displayName !== null) {
        if (typeof child.type === 'function') {
          preferredDisplayName = displayName;
        } else if (fallbackDisplayName === null) {
          fallbackDisplayName = displayName;
        }
      }
      if (preferredDisplayName !== null) {
        break;
      }
      child = child.child;
    }
    return preferredDisplayName || fallbackDisplayName || 'Anonymous';
  }
  function getPathFrame(fiber) {
    const {
      key
    } = fiber;
    let displayName = getDisplayNameForFiber(fiber);
    const index = fiber.index;
    switch (fiber.tag) {
      case HostRoot:
        const rootInstance = rootToFiberInstanceMap.get(fiber.stateNode);
        if (rootInstance === undefined) {
          throw new Error('Expected the root instance to exist when computing a path');
        }
        const pseudoKey = rootPseudoKeys.get(rootInstance.id);
        if (pseudoKey === undefined) {
          throw new Error('Expected mounted root to have known pseudo key.');
        }
        displayName = pseudoKey;
        break;
      case HostComponent:
        displayName = fiber.type;
        break;
      default:
        break;
    }
    return {
      displayName,
      key: key === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.REACT_OPTIMISTIC_KEY ? null : key,
      index
    };
  }
  function getVirtualPathFrame(virtualInstance) {
    return {
      displayName: virtualInstance.data.name || '',
      key: virtualInstance.data.key == null || virtualInstance.data.key === _shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_6__.REACT_OPTIMISTIC_KEY ? null : virtualInstance.data.key,
      index: -1
    };
  }
  function getPathForElement(id) {
    const devtoolsInstance = idToDevToolsInstanceMap.get(id);
    if (devtoolsInstance === undefined) {
      return null;
    }
    const keyPath = [];
    let inst = devtoolsInstance;
    while (inst.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
      keyPath.push(getVirtualPathFrame(inst));
      if (inst.parent === null) {
        return null;
      }
      inst = inst.parent;
    }
    let fiber = inst.data;
    while (fiber !== null) {
      keyPath.push(getPathFrame(fiber));
      fiber = fiber.return;
    }
    keyPath.reverse();
    return keyPath;
  }
  function getBestMatchForTrackedPath() {
    if (trackedPath === null) {
      return null;
    }
    if (trackedPathMatchInstance === null) {
      return null;
    }
    return {
      id: trackedPathMatchInstance.id,
      isFullMatch: trackedPathMatchDepth === trackedPath.length - 1
    };
  }
  const formatPriorityLevel = priorityLevel => {
    if (priorityLevel == null) {
      return 'Unknown';
    }
    switch (priorityLevel) {
      case ImmediatePriority:
        return 'Immediate';
      case UserBlockingPriority:
        return 'User-Blocking';
      case NormalPriority:
        return 'Normal';
      case LowPriority:
        return 'Low';
      case IdlePriority:
        return 'Idle';
      case NoPriority:
      default:
        return 'Unknown';
    }
  };
  function setTraceUpdatesEnabled(isEnabled) {
    traceUpdatesEnabled = isEnabled;
  }
  function hasElementWithId(id) {
    return idToDevToolsInstanceMap.has(id);
  }
  function getSourceForFiberInstance(fiberInstance) {
    const ownerSource = getSourceForInstance(fiberInstance);
    if (ownerSource !== null) {
      return ownerSource;
    }
    const dispatcherRef = (0,_shared_DevToolsReactDispatcher__WEBPACK_IMPORTED_MODULE_18__.getDispatcherRef)(renderer);
    const stackFrame = dispatcherRef == null ? null : (0,_DevToolsFiberComponentStack__WEBPACK_IMPORTED_MODULE_15__.getSourceLocationByFiber)(ReactTypeOfWork, fiberInstance.data, dispatcherRef);
    if (stackFrame === null) {
      return null;
    }
    const source = (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.extractLocationFromComponentStack)(stackFrame);
    fiberInstance.source = source;
    return source;
  }
  function getSourceForInstance(instance) {
    let unresolvedSource = instance.source;
    if (unresolvedSource === null) {
      return null;
    }
    if (instance.kind === _shared_DevToolsFiberTypes__WEBPACK_IMPORTED_MODULE_17__.VIRTUAL_INSTANCE) {
      const debugLocation = instance.data.debugLocation;
      if (debugLocation != null) {
        unresolvedSource = debugLocation;
      }
    }
    if ((0,_shared_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_11__.isError)(unresolvedSource)) {
      return instance.source = (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.extractLocationFromOwnerStack)(unresolvedSource);
    }
    if (typeof unresolvedSource === 'string') {
      const idx = unresolvedSource.lastIndexOf('\n');
      const lastLine = idx === -1 ? unresolvedSource : unresolvedSource.slice(idx + 1);
      return instance.source = (0,react_devtools_shared_src_backend_utils_parseStackTrace__WEBPACK_IMPORTED_MODULE_3__.extractLocationFromComponentStack)(lastLine);
    }
    return unresolvedSource;
  }
  return {
    cleanup,
    clearErrorsAndWarnings,
    clearErrorsForElementID,
    clearWarningsForElementID,
    getSerializedElementValueByPath,
    deletePath,
    findHostInstancesForElementID,
    findLastKnownRectsForID,
    flushInitialOperations,
    getBestMatchForTrackedPath,
    getDisplayNameForElementID,
    getNearestMountedDOMNode,
    getElementIDForHostInstance,
    getSuspenseNodeIDForHostInstance,
    getInstanceAndStyle,
    getOwnersList,
    getPathForElement,
    getProfilingData,
    handleCommitFiberRoot,
    handleCommitFiberUnmount,
    handlePostCommitFiberRoot,
    hasElementWithId,
    inspectElement,
    logElementToConsole,
    getComponentStack,
    getElementAttributeByPath,
    getElementSourceFunctionById,
    onErrorOrWarning,
    overrideError,
    overrideSuspense,
    overrideSuspenseMilestone,
    overrideValueAtPath,
    renamePath,
    renderer,
    setTraceUpdatesEnabled,
    setTrackedPath,
    startProfiling,
    stopProfiling,
    storeAsGlobal,
    supportsTogglingSuspense,
    updateComponentFilters,
    getEnvironmentNames
  };
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberChangeDetection.js":
/*!*****************************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberChangeDetection.js ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "didFiberRender": () => (/* binding */ didFiberRender),
/* harmony export */   "didStatefulHookChange": () => (/* binding */ didStatefulHookChange),
/* harmony export */   "getChangedHooksIndices": () => (/* binding */ getChangedHooksIndices),
/* harmony export */   "getChangedKeys": () => (/* binding */ getChangedKeys),
/* harmony export */   "getContextChanged": () => (/* binding */ getContextChanged)
/* harmony export */ });
/* harmony import */ var _DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./DevToolsFiberInspection */ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInspection.js");
/* harmony import */ var shared_objectIs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! shared/objectIs */ "../shared/objectIs.js");


function getContextChanged(prevFiber, nextFiber) {
  let prevContext = prevFiber.dependencies && prevFiber.dependencies.firstContext;
  let nextContext = nextFiber.dependencies && nextFiber.dependencies.firstContext;
  while (prevContext && nextContext) {
    if (prevContext.context !== nextContext.context) {
      return false;
    }
    if (!(0,shared_objectIs__WEBPACK_IMPORTED_MODULE_1__["default"])(prevContext.memoizedValue, nextContext.memoizedValue)) {
      return true;
    }
    prevContext = prevContext.next;
    nextContext = nextContext.next;
  }
  return false;
}
function didStatefulHookChange(prev, next) {
  const isStatefulHook = prev.isStateEditable === true || prev.name === 'SyncExternalStore' || prev.name === 'Transition' || prev.name === 'ActionState' || prev.name === 'FormState';
  if (isStatefulHook) {
    return prev.value !== next.value;
  }
  return false;
}
function getChangedHooksIndices(prevHooks, nextHooks) {
  if (prevHooks == null || nextHooks == null) {
    return null;
  }
  const indices = [];
  let index = 0;
  function traverse(prevTree, nextTree) {
    for (let i = 0; i < prevTree.length; i++) {
      const prevHook = prevTree[i];
      const nextHook = nextTree[i];
      if (prevHook.subHooks.length > 0 && nextHook.subHooks.length > 0) {
        traverse(prevHook.subHooks, nextHook.subHooks);
        continue;
      }
      if (didStatefulHookChange(prevHook, nextHook)) {
        indices.push(index);
      }
      index++;
    }
  }
  traverse(prevHooks, nextHooks);
  return indices;
}
function getChangedKeys(prev, next) {
  if (prev == null || next == null) {
    return null;
  }
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changedKeys = [];
  for (const key of keys) {
    if (prev[key] !== next[key]) {
      changedKeys.push(key);
    }
  }
  return changedKeys;
}
function didFiberRender(workTagMap, prevFiber, nextFiber) {
  switch (nextFiber.tag) {
    case workTagMap.ClassComponent:
    case workTagMap.FunctionComponent:
    case workTagMap.ContextConsumer:
    case workTagMap.MemoComponent:
    case workTagMap.SimpleMemoComponent:
    case workTagMap.ForwardRef:
      const PerformedWork = 0b000000000000000000000000001;
      return ((0,_DevToolsFiberInspection__WEBPACK_IMPORTED_MODULE_0__.getFiberFlags)(nextFiber) & PerformedWork) === PerformedWork;
    default:
      return prevFiber.memoizedProps !== nextFiber.memoizedProps || prevFiber.memoizedState !== nextFiber.memoizedState || prevFiber.ref !== nextFiber.ref;
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInspection.js":
/*!************************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInspection.js ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "areEqualRects": () => (/* binding */ areEqualRects),
/* harmony export */   "getFiberFlags": () => (/* binding */ getFiberFlags),
/* harmony export */   "getSecondaryEnvironmentName": () => (/* binding */ getSecondaryEnvironmentName),
/* harmony export */   "isError": () => (/* binding */ isError),
/* harmony export */   "isErrorBoundary": () => (/* binding */ isErrorBoundary),
/* harmony export */   "rootSupportsProfiling": () => (/* binding */ rootSupportsProfiling)
/* harmony export */ });
const toString = Object.prototype.toString;
function isError(object) {
  return toString.call(object) === '[object Error]';
}
function getFiberFlags(fiber) {
  return fiber.flags !== undefined ? fiber.flags : fiber.effectTag;
}
function rootSupportsProfiling(root) {
  if (root.memoizedInteractions != null) {
    return true;
  } else if (root.current != null && root.current.hasOwnProperty('treeBaseDuration')) {
    return true;
  } else {
    return false;
  }
}
function isErrorBoundary(workTagMap, fiber) {
  const {
    tag,
    type
  } = fiber;
  switch (tag) {
    case workTagMap.ClassComponent:
    case workTagMap.IncompleteClassComponent:
      const instance = fiber.stateNode;
      return typeof type.getDerivedStateFromError === 'function' || instance !== null && typeof instance.componentDidCatch === 'function';
    default:
      return false;
  }
}
function getSecondaryEnvironmentName(debugInfo, index) {
  if (debugInfo != null) {
    const componentInfo = debugInfo[index];
    for (let i = index + 1; i < debugInfo.length; i++) {
      const debugEntry = debugInfo[i];
      if (typeof debugEntry.env === 'string') {
        return componentInfo.env !== debugEntry.env ? debugEntry.env : null;
      }
    }
  }
  return null;
}
function areEqualRects(a, b) {
  if (a === null) {
    return b === null;
  }
  if (b === null) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const aRect = a[i];
    const bRect = b[i];
    if (aRect.x !== bRect.x || aRect.y !== bRect.y || aRect.width !== bRect.width || aRect.height !== bRect.height) {
      return false;
    }
  }
  return true;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInternalReactConstants.js":
/*!************************************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInternalReactConstants.js ***!
  \************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getInternalReactConstants": () => (/* binding */ getInternalReactConstants)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/utils */ "../react-devtools-shared/src/utils.js");
/* harmony import */ var react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");
/* harmony import */ var react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-devtools-shared/src/backend/shared/ReactSymbols */ "../react-devtools-shared/src/backend/shared/ReactSymbols.js");



function getInternalReactConstants(version) {
  let ReactPriorityLevels = {
    ImmediatePriority: 99,
    UserBlockingPriority: 98,
    NormalPriority: 97,
    LowPriority: 96,
    IdlePriority: 95,
    NoPriority: 90
  };
  if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gt)(version, '17.0.2')) {
    ReactPriorityLevels = {
      ImmediatePriority: 1,
      UserBlockingPriority: 2,
      NormalPriority: 3,
      LowPriority: 4,
      IdlePriority: 5,
      NoPriority: 0
    };
  }
  let StrictModeBits = 0;
  if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gte)(version, '18.0.0-alpha')) {
    StrictModeBits = 0b011000;
  } else if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gte)(version, '16.9.0')) {
    StrictModeBits = 0b1;
  } else if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gte)(version, '16.3.0')) {
    StrictModeBits = 0b10;
  }
  const SuspenseyImagesMode = 0b0100000;
  let ReactTypeOfWork = null;
  if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gt)(version, '17.0.1')) {
    ReactTypeOfWork = {
      CacheComponent: 24,
      ClassComponent: 1,
      ContextConsumer: 9,
      ContextProvider: 10,
      CoroutineComponent: -1,
      CoroutineHandlerPhase: -1,
      DehydratedSuspenseComponent: 18,
      ForwardRef: 11,
      Fragment: 7,
      FunctionComponent: 0,
      HostComponent: 5,
      HostPortal: 4,
      HostRoot: 3,
      HostHoistable: 26,
      HostSingleton: 27,
      HostText: 6,
      IncompleteClassComponent: 17,
      IncompleteFunctionComponent: 28,
      IndeterminateComponent: 2,
      LazyComponent: 16,
      LegacyHiddenComponent: 23,
      MemoComponent: 14,
      Mode: 8,
      OffscreenComponent: 22,
      Profiler: 12,
      ScopeComponent: 21,
      SimpleMemoComponent: 15,
      SuspenseComponent: 13,
      SuspenseListComponent: 19,
      TracingMarkerComponent: 25,
      YieldComponent: -1,
      Throw: 29,
      ViewTransitionComponent: 30,
      ActivityComponent: 31
    };
  } else if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gte)(version, '17.0.0-alpha')) {
    ReactTypeOfWork = {
      CacheComponent: -1,
      ClassComponent: 1,
      ContextConsumer: 9,
      ContextProvider: 10,
      CoroutineComponent: -1,
      CoroutineHandlerPhase: -1,
      DehydratedSuspenseComponent: 18,
      ForwardRef: 11,
      Fragment: 7,
      FunctionComponent: 0,
      HostComponent: 5,
      HostPortal: 4,
      HostRoot: 3,
      HostHoistable: -1,
      HostSingleton: -1,
      HostText: 6,
      IncompleteClassComponent: 17,
      IncompleteFunctionComponent: -1,
      IndeterminateComponent: 2,
      LazyComponent: 16,
      LegacyHiddenComponent: 24,
      MemoComponent: 14,
      Mode: 8,
      OffscreenComponent: 23,
      Profiler: 12,
      ScopeComponent: 21,
      SimpleMemoComponent: 15,
      SuspenseComponent: 13,
      SuspenseListComponent: 19,
      TracingMarkerComponent: -1,
      YieldComponent: -1,
      Throw: -1,
      ViewTransitionComponent: -1,
      ActivityComponent: -1
    };
  } else if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gte)(version, '16.6.0-beta.0')) {
    ReactTypeOfWork = {
      CacheComponent: -1,
      ClassComponent: 1,
      ContextConsumer: 9,
      ContextProvider: 10,
      CoroutineComponent: -1,
      CoroutineHandlerPhase: -1,
      DehydratedSuspenseComponent: 18,
      ForwardRef: 11,
      Fragment: 7,
      FunctionComponent: 0,
      HostComponent: 5,
      HostPortal: 4,
      HostRoot: 3,
      HostHoistable: -1,
      HostSingleton: -1,
      HostText: 6,
      IncompleteClassComponent: 17,
      IncompleteFunctionComponent: -1,
      IndeterminateComponent: 2,
      LazyComponent: 16,
      LegacyHiddenComponent: -1,
      MemoComponent: 14,
      Mode: 8,
      OffscreenComponent: -1,
      Profiler: 12,
      ScopeComponent: -1,
      SimpleMemoComponent: 15,
      SuspenseComponent: 13,
      SuspenseListComponent: 19,
      TracingMarkerComponent: -1,
      YieldComponent: -1,
      Throw: -1,
      ViewTransitionComponent: -1,
      ActivityComponent: -1
    };
  } else if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_1__.gte)(version, '16.4.3-alpha')) {
    ReactTypeOfWork = {
      CacheComponent: -1,
      ClassComponent: 2,
      ContextConsumer: 11,
      ContextProvider: 12,
      CoroutineComponent: -1,
      CoroutineHandlerPhase: -1,
      DehydratedSuspenseComponent: -1,
      ForwardRef: 13,
      Fragment: 9,
      FunctionComponent: 0,
      HostComponent: 7,
      HostPortal: 6,
      HostRoot: 5,
      HostHoistable: -1,
      HostSingleton: -1,
      HostText: 8,
      IncompleteClassComponent: -1,
      IncompleteFunctionComponent: -1,
      IndeterminateComponent: 4,
      LazyComponent: -1,
      LegacyHiddenComponent: -1,
      MemoComponent: -1,
      Mode: 10,
      OffscreenComponent: -1,
      Profiler: 15,
      ScopeComponent: -1,
      SimpleMemoComponent: -1,
      SuspenseComponent: 16,
      SuspenseListComponent: -1,
      TracingMarkerComponent: -1,
      YieldComponent: -1,
      Throw: -1,
      ViewTransitionComponent: -1,
      ActivityComponent: -1
    };
  } else {
    ReactTypeOfWork = {
      CacheComponent: -1,
      ClassComponent: 2,
      ContextConsumer: 12,
      ContextProvider: 13,
      CoroutineComponent: 7,
      CoroutineHandlerPhase: 8,
      DehydratedSuspenseComponent: -1,
      ForwardRef: 14,
      Fragment: 10,
      FunctionComponent: 1,
      HostComponent: 5,
      HostPortal: 4,
      HostRoot: 3,
      HostHoistable: -1,
      HostSingleton: -1,
      HostText: 6,
      IncompleteClassComponent: -1,
      IncompleteFunctionComponent: -1,
      IndeterminateComponent: 0,
      LazyComponent: -1,
      LegacyHiddenComponent: -1,
      MemoComponent: -1,
      Mode: 11,
      OffscreenComponent: -1,
      Profiler: 15,
      ScopeComponent: -1,
      SimpleMemoComponent: -1,
      SuspenseComponent: 16,
      SuspenseListComponent: -1,
      TracingMarkerComponent: -1,
      YieldComponent: 9,
      Throw: -1,
      ViewTransitionComponent: -1,
      ActivityComponent: -1
    };
  }
  function getTypeSymbol(type) {
    const symbolOrNumber = typeof type === 'object' && type !== null ? type.$$typeof : type;
    return typeof symbolOrNumber === 'symbol' ? symbolOrNumber.toString() : symbolOrNumber;
  }
  const {
    CacheComponent,
    ClassComponent,
    IncompleteClassComponent,
    IncompleteFunctionComponent,
    FunctionComponent,
    IndeterminateComponent,
    ForwardRef,
    HostRoot,
    HostHoistable,
    HostSingleton,
    HostComponent,
    HostPortal,
    HostText,
    Fragment,
    LazyComponent,
    LegacyHiddenComponent,
    MemoComponent,
    OffscreenComponent,
    Profiler,
    ScopeComponent,
    SimpleMemoComponent,
    SuspenseComponent,
    SuspenseListComponent,
    TracingMarkerComponent,
    Throw,
    ViewTransitionComponent,
    ActivityComponent
  } = ReactTypeOfWork;
  function resolveFiberType(type) {
    const typeSymbol = getTypeSymbol(type);
    switch (typeSymbol) {
      case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.MEMO_NUMBER:
      case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.MEMO_SYMBOL_STRING:
        return resolveFiberType(type.type);
      case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.FORWARD_REF_NUMBER:
      case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.FORWARD_REF_SYMBOL_STRING:
        return type.render;
      default:
        return type;
    }
  }
  function getDisplayNameForFiber(fiber, shouldSkipForgetCheck = false) {
    const {
      elementType,
      type,
      tag
    } = fiber;
    let resolvedType = type;
    if (typeof type === 'object' && type !== null) {
      resolvedType = resolveFiberType(type);
    }
    let resolvedContext = null;
    if (!shouldSkipForgetCheck && (fiber.updateQueue?.memoCache != null || Array.isArray(fiber.memoizedState?.memoizedState) && fiber.memoizedState.memoizedState[0]?.[react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.REACT_MEMO_CACHE_SENTINEL] || fiber.memoizedState?.memoizedState?.[react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.REACT_MEMO_CACHE_SENTINEL])) {
      const displayNameWithoutForgetWrapper = getDisplayNameForFiber(fiber, true);
      if (displayNameWithoutForgetWrapper == null) {
        return null;
      }
      return `Forget(${displayNameWithoutForgetWrapper})`;
    }
    switch (tag) {
      case ActivityComponent:
        return 'Activity';
      case CacheComponent:
        return 'Cache';
      case ClassComponent:
      case IncompleteClassComponent:
      case IncompleteFunctionComponent:
      case FunctionComponent:
      case IndeterminateComponent:
        return (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getDisplayName)(resolvedType);
      case ForwardRef:
        return (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getWrappedDisplayName)(elementType, resolvedType, 'ForwardRef', 'Anonymous');
      case HostRoot:
        const fiberRoot = fiber.stateNode;
        if (fiberRoot != null && fiberRoot._debugRootType !== null) {
          return fiberRoot._debugRootType;
        }
        return null;
      case HostComponent:
      case HostSingleton:
      case HostHoistable:
        return type;
      case HostPortal:
      case HostText:
        return null;
      case Fragment:
        return 'Fragment';
      case LazyComponent:
        return 'Lazy';
      case MemoComponent:
      case SimpleMemoComponent:
        return (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getWrappedDisplayName)(elementType, resolvedType, 'Memo', 'Anonymous');
      case SuspenseComponent:
        return 'Suspense';
      case LegacyHiddenComponent:
        return 'LegacyHidden';
      case OffscreenComponent:
        return 'Offscreen';
      case ScopeComponent:
        return 'Scope';
      case SuspenseListComponent:
        return 'SuspenseList';
      case Profiler:
        return 'Profiler';
      case TracingMarkerComponent:
        return 'TracingMarker';
      case ViewTransitionComponent:
        return 'ViewTransition';
      case Throw:
        return 'Error';
      default:
        const typeSymbol = getTypeSymbol(type);
        switch (typeSymbol) {
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.CONCURRENT_MODE_NUMBER:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.CONCURRENT_MODE_SYMBOL_STRING:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.DEPRECATED_ASYNC_MODE_SYMBOL_STRING:
            return null;
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.PROVIDER_NUMBER:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.PROVIDER_SYMBOL_STRING:
            resolvedContext = fiber.type._context || fiber.type.context;
            return `${resolvedContext.displayName || 'Context'}.Provider`;
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.CONTEXT_NUMBER:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.CONTEXT_SYMBOL_STRING:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.SERVER_CONTEXT_SYMBOL_STRING:
            if (fiber.type._context === undefined && fiber.type.Provider === fiber.type) {
              resolvedContext = fiber.type;
              return `${resolvedContext.displayName || 'Context'}.Provider`;
            }
            resolvedContext = fiber.type._context || fiber.type;
            return `${resolvedContext.displayName || 'Context'}.Consumer`;
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.CONSUMER_SYMBOL_STRING:
            resolvedContext = fiber.type._context;
            return `${resolvedContext.displayName || 'Context'}.Consumer`;
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.STRICT_MODE_NUMBER:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.STRICT_MODE_SYMBOL_STRING:
            return null;
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.PROFILER_NUMBER:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.PROFILER_SYMBOL_STRING:
            return `Profiler(${fiber.memoizedProps.id})`;
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.SCOPE_NUMBER:
          case react_devtools_shared_src_backend_shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_2__.SCOPE_SYMBOL_STRING:
            return 'Scope';
          default:
            return null;
        }
    }
  }
  return {
    getDisplayNameForFiber,
    getTypeSymbol,
    ReactPriorityLevels,
    ReactTypeOfWork,
    StrictModeBits,
    SuspenseyImagesMode
  };
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberSuspense.js":
/*!**********************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberSuspense.js ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAwaitInSuspendedByFromIO": () => (/* binding */ getAwaitInSuspendedByFromIO),
/* harmony export */   "getVirtualEndTime": () => (/* binding */ getVirtualEndTime),
/* harmony export */   "ioExistsInSuspenseAncestor": () => (/* binding */ ioExistsInSuspenseAncestor)
/* harmony export */ });
function ioExistsInSuspenseAncestor(suspenseNode, ioInfo) {
  let ancestor = suspenseNode.parent;
  while (ancestor !== null) {
    if (ancestor.suspendedBy.has(ioInfo)) {
      return true;
    }
    ancestor = ancestor.parent;
  }
  return false;
}
function getAwaitInSuspendedByFromIO(suspensedBy, ioInfo) {
  for (let i = 0; i < suspensedBy.length; i++) {
    const asyncInfo = suspensedBy[i];
    if (asyncInfo.awaited === ioInfo) {
      return asyncInfo;
    }
  }
  return null;
}
function getVirtualEndTime(ioInfo) {
  if (ioInfo.env != null) {
    return ioInfo.end + 1000000;
  }
  return ioInfo.end;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberTypes.js":
/*!*******************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberTypes.js ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FIBER_INSTANCE": () => (/* binding */ FIBER_INSTANCE),
/* harmony export */   "FILTERED_FIBER_INSTANCE": () => (/* binding */ FILTERED_FIBER_INSTANCE),
/* harmony export */   "VIRTUAL_INSTANCE": () => (/* binding */ VIRTUAL_INSTANCE)
/* harmony export */ });
const FIBER_INSTANCE = 0;
const VIRTUAL_INSTANCE = 1;
const FILTERED_FIBER_INSTANCE = 2;

/***/ }),

/***/ "../react-devtools-shared/src/backend/flight/DevToolsComponentInfoStack.js":
/*!*********************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/flight/DevToolsComponentInfoStack.js ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getOwnerStackByComponentInfoInDev": () => (/* binding */ getOwnerStackByComponentInfoInDev)
/* harmony export */ });
/* harmony import */ var _shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/DevToolsComponentStackFrame */ "../react-devtools-shared/src/backend/shared/DevToolsComponentStackFrame.js");
/* harmony import */ var _shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/DevToolsOwnerStack */ "../react-devtools-shared/src/backend/shared/DevToolsOwnerStack.js");


function getOwnerStackByComponentInfoInDev(componentInfo) {
  try {
    let info = '';
    if (!componentInfo.owner && typeof componentInfo.name === 'string') {
      return (0,_shared_DevToolsComponentStackFrame__WEBPACK_IMPORTED_MODULE_0__.describeBuiltInComponentFrame)(componentInfo.name);
    }
    let owner = componentInfo;
    while (owner) {
      const ownerStack = owner.debugStack;
      if (ownerStack != null) {
        owner = owner.owner;
        if (owner) {
          info += '\n' + (0,_shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_1__.formatOwnerStack)(ownerStack);
        }
      } else {
        break;
      }
    }
    return info;
  } catch (x) {
    return '\nError generating stack: ' + x.message + '\n' + x.stack;
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/flight/renderer.js":
/*!***************************************************************!*\
  !*** ../react-devtools-shared/src/backend/flight/renderer.js ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "attach": () => (/* binding */ attach)
/* harmony export */ });
/* harmony import */ var _DevToolsComponentInfoStack__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./DevToolsComponentInfoStack */ "../react-devtools-shared/src/backend/flight/DevToolsComponentInfoStack.js");
/* harmony import */ var _shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/DevToolsOwnerStack */ "../react-devtools-shared/src/backend/shared/DevToolsOwnerStack.js");
/* harmony import */ var _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../shared/DevToolsServerComponentLogs */ "../react-devtools-shared/src/backend/shared/DevToolsServerComponentLogs.js");
/* harmony import */ var react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");




function supportsConsoleTasks(componentInfo) {
  return !!componentInfo.debugTask;
}
function attach(hook, rendererID, renderer, global) {
  const {
    getCurrentComponentInfo
  } = renderer;
  function getComponentStack(topFrame) {
    if (getCurrentComponentInfo === undefined) {
      return null;
    }
    const current = getCurrentComponentInfo();
    if (current === null) {
      return null;
    }
    if (supportsConsoleTasks(current)) {
      return null;
    }
    const enableOwnerStacks = current.debugStack != null;
    let componentStack = '';
    if (enableOwnerStacks) {
      const topStackFrames = (0,_shared_DevToolsOwnerStack__WEBPACK_IMPORTED_MODULE_1__.formatOwnerStack)(topFrame);
      if (topStackFrames) {
        componentStack += '\n' + topStackFrames;
      }
      componentStack += (0,_DevToolsComponentInfoStack__WEBPACK_IMPORTED_MODULE_0__.getOwnerStackByComponentInfoInDev)(current);
    }
    return {
      enableOwnerStacks,
      componentStack
    };
  }
  function onErrorOrWarning(type, args) {
    if (getCurrentComponentInfo === undefined) {
      return;
    }
    const componentInfo = getCurrentComponentInfo();
    if (componentInfo === null) {
      return;
    }
    if (args.length > 3 && typeof args[0] === 'string' && args[0].startsWith('%c%s%c ') && typeof args[1] === 'string' && typeof args[2] === 'string' && typeof args[3] === 'string') {
      const format = args[0].slice(7);
      const env = args[2].trim();
      args = args.slice(4);
      if (env !== componentInfo.env) {
        args.unshift('[' + env + '] ' + format);
      } else {
        args.unshift(format);
      }
    }
    const message = (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_3__.formatConsoleArgumentsToSingleString)(...args);
    let componentLogsEntry = _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_2__.componentInfoToComponentLogsMap.get(componentInfo);
    if (componentLogsEntry === undefined) {
      componentLogsEntry = {
        errors: new Map(),
        errorsCount: 0,
        warnings: new Map(),
        warningsCount: 0
      };
      _shared_DevToolsServerComponentLogs__WEBPACK_IMPORTED_MODULE_2__.componentInfoToComponentLogsMap.set(componentInfo, componentLogsEntry);
    }
    const messageMap = type === 'error' ? componentLogsEntry.errors : componentLogsEntry.warnings;
    const count = messageMap.get(message) || 0;
    messageMap.set(message, count + 1);
    if (type === 'error') {
      componentLogsEntry.errorsCount++;
    } else {
      componentLogsEntry.warningsCount++;
    }
  }
  const supportsTogglingSuspense = false;
  return {
    cleanup() {},
    clearErrorsAndWarnings() {},
    clearErrorsForElementID() {},
    clearWarningsForElementID() {},
    getSerializedElementValueByPath() {},
    deletePath() {},
    findHostInstancesForElementID() {
      return null;
    },
    findLastKnownRectsForID() {
      return null;
    },
    flushInitialOperations() {},
    getBestMatchForTrackedPath() {
      return null;
    },
    getComponentStack,
    getDisplayNameForElementID() {
      return null;
    },
    getNearestMountedDOMNode() {
      return null;
    },
    getElementIDForHostInstance() {
      return null;
    },
    getSuspenseNodeIDForHostInstance() {
      return null;
    },
    getInstanceAndStyle() {
      return {
        instance: null,
        style: null
      };
    },
    getOwnersList() {
      return null;
    },
    getPathForElement() {
      return null;
    },
    getProfilingData() {
      throw new Error('getProfilingData not supported by this renderer');
    },
    handleCommitFiberRoot() {},
    handleCommitFiberUnmount() {},
    handlePostCommitFiberRoot() {},
    hasElementWithId() {
      return false;
    },
    inspectElement(requestID, id, path) {
      return {
        id,
        responseID: requestID,
        type: 'not-found'
      };
    },
    logElementToConsole() {},
    getElementAttributeByPath() {},
    getElementSourceFunctionById() {},
    onErrorOrWarning,
    overrideError() {},
    overrideSuspense() {},
    overrideSuspenseMilestone() {},
    overrideValueAtPath() {},
    renamePath() {},
    renderer,
    setTraceUpdatesEnabled() {},
    setTrackedPath() {},
    startProfiling() {},
    stopProfiling() {},
    storeAsGlobal() {},
    supportsTogglingSuspense,
    updateComponentFilters() {},
    getEnvironmentNames() {
      return [];
    }
  };
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/legacy/renderer.js":
/*!***************************************************************!*\
  !*** ../react-devtools-shared/src/backend/legacy/renderer.js ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "attach": () => (/* binding */ attach)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/frontend/types */ "../react-devtools-shared/src/frontend/types.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-devtools-shared/src/utils */ "../react-devtools-shared/src/utils.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils */ "../react-devtools-shared/src/backend/utils/index.js");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../constants */ "../react-devtools-shared/src/constants.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./utils */ "../react-devtools-shared/src/backend/legacy/utils.js");






function getData(internalInstance) {
  let displayName = null;
  let key = null;
  if (internalInstance._currentElement != null) {
    if (internalInstance._currentElement.key) {
      key = String(internalInstance._currentElement.key);
    }
    const elementType = internalInstance._currentElement.type;
    if (typeof elementType === 'string') {
      displayName = elementType;
    } else if (typeof elementType === 'function') {
      displayName = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getDisplayName)(elementType);
    }
  }
  return {
    displayName,
    key
  };
}
function getElementType(internalInstance) {
  if (internalInstance._currentElement != null) {
    const elementType = internalInstance._currentElement.type;
    if (typeof elementType === 'function') {
      const publicInstance = internalInstance.getPublicInstance();
      if (publicInstance !== null) {
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeClass;
      } else {
        return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeFunction;
      }
    } else if (typeof elementType === 'string') {
      return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeHostComponent;
    }
  }
  return react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown;
}
function getChildren(internalInstance) {
  const children = [];
  if (typeof internalInstance !== 'object') {} else if (internalInstance._currentElement === null || internalInstance._currentElement === false) {} else if (internalInstance._renderedComponent) {
    const child = internalInstance._renderedComponent;
    if (getElementType(child) !== react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown) {
      children.push(child);
    }
  } else if (internalInstance._renderedChildren) {
    const renderedChildren = internalInstance._renderedChildren;
    for (const name in renderedChildren) {
      const child = renderedChildren[name];
      if (getElementType(child) !== react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown) {
        children.push(child);
      }
    }
  }
  return children;
}
function attach(hook, rendererID, renderer, global) {
  const idToInternalInstanceMap = new Map();
  const internalInstanceToIDMap = new WeakMap();
  const internalInstanceToRootIDMap = new WeakMap();
  let getElementIDForHostInstance = null;
  let findHostInstanceForInternalID;
  let getNearestMountedDOMNode = node => {
    return null;
  };
  if (renderer.ComponentTree) {
    getElementIDForHostInstance = node => {
      const internalInstance = renderer.ComponentTree.getClosestInstanceFromNode(node);
      return internalInstanceToIDMap.get(internalInstance) || null;
    };
    findHostInstanceForInternalID = id => {
      const internalInstance = idToInternalInstanceMap.get(id);
      return renderer.ComponentTree.getNodeFromInstance(internalInstance);
    };
    getNearestMountedDOMNode = node => {
      const internalInstance = renderer.ComponentTree.getClosestInstanceFromNode(node);
      if (internalInstance != null) {
        return renderer.ComponentTree.getNodeFromInstance(internalInstance);
      }
      return null;
    };
  } else if (renderer.Mount.getID && renderer.Mount.getNode) {
    getElementIDForHostInstance = node => {
      return null;
    };
    findHostInstanceForInternalID = id => {
      return null;
    };
  }
  const supportsTogglingSuspense = false;
  function getDisplayNameForElementID(id) {
    const internalInstance = idToInternalInstanceMap.get(id);
    return internalInstance ? getData(internalInstance).displayName : null;
  }
  function getID(internalInstance) {
    if (typeof internalInstance !== 'object' || internalInstance === null) {
      throw new Error('Invalid internal instance: ' + internalInstance);
    }
    if (!internalInstanceToIDMap.has(internalInstance)) {
      const id = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getUID)();
      internalInstanceToIDMap.set(internalInstance, id);
      idToInternalInstanceMap.set(id, internalInstance);
    }
    return internalInstanceToIDMap.get(internalInstance);
  }
  function areEqualArrays(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  let parentIDStack = [];
  let oldReconcilerMethods = null;
  if (renderer.Reconciler) {
    oldReconcilerMethods = (0,_utils__WEBPACK_IMPORTED_MODULE_4__.decorateMany)(renderer.Reconciler, {
      mountComponent(fn, args) {
        const internalInstance = args[0];
        const hostContainerInfo = args[3];
        if (getElementType(internalInstance) === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown) {
          return fn.apply(this, args);
        }
        if (hostContainerInfo._topLevelWrapper === undefined) {
          return fn.apply(this, args);
        }
        const id = getID(internalInstance);
        const parentID = parentIDStack.length > 0 ? parentIDStack[parentIDStack.length - 1] : 0;
        recordMount(internalInstance, id, parentID);
        parentIDStack.push(id);
        internalInstanceToRootIDMap.set(internalInstance, getID(hostContainerInfo._topLevelWrapper));
        try {
          const result = fn.apply(this, args);
          parentIDStack.pop();
          return result;
        } catch (err) {
          parentIDStack = [];
          throw err;
        } finally {
          if (parentIDStack.length === 0) {
            const rootID = internalInstanceToRootIDMap.get(internalInstance);
            if (rootID === undefined) {
              throw new Error('Expected to find root ID.');
            }
            flushPendingEvents(rootID);
          }
        }
      },
      performUpdateIfNecessary(fn, args) {
        const internalInstance = args[0];
        if (getElementType(internalInstance) === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown) {
          return fn.apply(this, args);
        }
        const id = getID(internalInstance);
        parentIDStack.push(id);
        const prevChildren = getChildren(internalInstance);
        try {
          const result = fn.apply(this, args);
          const nextChildren = getChildren(internalInstance);
          if (!areEqualArrays(prevChildren, nextChildren)) {
            recordReorder(internalInstance, id, nextChildren);
          }
          parentIDStack.pop();
          return result;
        } catch (err) {
          parentIDStack = [];
          throw err;
        } finally {
          if (parentIDStack.length === 0) {
            const rootID = internalInstanceToRootIDMap.get(internalInstance);
            if (rootID === undefined) {
              throw new Error('Expected to find root ID.');
            }
            flushPendingEvents(rootID);
          }
        }
      },
      receiveComponent(fn, args) {
        const internalInstance = args[0];
        if (getElementType(internalInstance) === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown) {
          return fn.apply(this, args);
        }
        const id = getID(internalInstance);
        parentIDStack.push(id);
        const prevChildren = getChildren(internalInstance);
        try {
          const result = fn.apply(this, args);
          const nextChildren = getChildren(internalInstance);
          if (!areEqualArrays(prevChildren, nextChildren)) {
            recordReorder(internalInstance, id, nextChildren);
          }
          parentIDStack.pop();
          return result;
        } catch (err) {
          parentIDStack = [];
          throw err;
        } finally {
          if (parentIDStack.length === 0) {
            const rootID = internalInstanceToRootIDMap.get(internalInstance);
            if (rootID === undefined) {
              throw new Error('Expected to find root ID.');
            }
            flushPendingEvents(rootID);
          }
        }
      },
      unmountComponent(fn, args) {
        const internalInstance = args[0];
        if (getElementType(internalInstance) === react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeOtherOrUnknown) {
          return fn.apply(this, args);
        }
        const id = getID(internalInstance);
        parentIDStack.push(id);
        try {
          const result = fn.apply(this, args);
          parentIDStack.pop();
          recordUnmount(internalInstance, id);
          return result;
        } catch (err) {
          parentIDStack = [];
          throw err;
        } finally {
          if (parentIDStack.length === 0) {
            const rootID = internalInstanceToRootIDMap.get(internalInstance);
            if (rootID === undefined) {
              throw new Error('Expected to find root ID.');
            }
            flushPendingEvents(rootID);
          }
        }
      }
    });
  }
  function cleanup() {
    if (oldReconcilerMethods !== null) {
      if (renderer.Component) {
        (0,_utils__WEBPACK_IMPORTED_MODULE_4__.restoreMany)(renderer.Component.Mixin, oldReconcilerMethods);
      } else {
        (0,_utils__WEBPACK_IMPORTED_MODULE_4__.restoreMany)(renderer.Reconciler, oldReconcilerMethods);
      }
    }
    oldReconcilerMethods = null;
  }
  function recordMount(internalInstance, id, parentID) {
    const isRoot = parentID === 0;
    if (_constants__WEBPACK_IMPORTED_MODULE_3__.__DEBUG__) {
      console.log('%crecordMount()', 'color: green; font-weight: bold;', id, getData(internalInstance).displayName);
    }
    if (isRoot) {
      const hasOwnerMetadata = internalInstance._currentElement != null && internalInstance._currentElement._owner != null;
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_3__.TREE_OPERATION_ADD);
      pushOperation(id);
      pushOperation(react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeRoot);
      pushOperation(0);
      pushOperation(0);
      pushOperation(0);
      pushOperation(hasOwnerMetadata ? 1 : 0);
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_3__.SUSPENSE_TREE_OPERATION_ADD);
      pushOperation(id);
      pushOperation(parentID);
      pushOperation(getStringID(null));
      pushOperation(0);
      pushOperation(-1);
    } else {
      const type = getElementType(internalInstance);
      const {
        displayName,
        key
      } = getData(internalInstance);
      const ownerID = internalInstance._currentElement != null && internalInstance._currentElement._owner != null ? getID(internalInstance._currentElement._owner) : 0;
      const displayNameStringID = getStringID(displayName);
      const keyStringID = getStringID(key);
      pushOperation(_constants__WEBPACK_IMPORTED_MODULE_3__.TREE_OPERATION_ADD);
      pushOperation(id);
      pushOperation(type);
      pushOperation(parentID);
      pushOperation(ownerID);
      pushOperation(displayNameStringID);
      pushOperation(keyStringID);
      pushOperation(getStringID(null));
    }
  }
  function recordReorder(internalInstance, id, nextChildren) {
    pushOperation(_constants__WEBPACK_IMPORTED_MODULE_3__.TREE_OPERATION_REORDER_CHILDREN);
    pushOperation(id);
    const nextChildIDs = nextChildren.map(getID);
    pushOperation(nextChildIDs.length);
    for (let i = 0; i < nextChildIDs.length; i++) {
      pushOperation(nextChildIDs[i]);
    }
  }
  function recordUnmount(internalInstance, id) {
    const isRoot = parentIDStack.length === 0;
    if (isRoot) {
      pendingUnmountedRootID = id;
    } else {
      pendingUnmountedIDs.push(id);
    }
    idToInternalInstanceMap.delete(id);
  }
  function crawlAndRecordInitialMounts(id, parentID, rootID) {
    if (_constants__WEBPACK_IMPORTED_MODULE_3__.__DEBUG__) {
      console.group('crawlAndRecordInitialMounts() id:', id);
    }
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance != null) {
      internalInstanceToRootIDMap.set(internalInstance, rootID);
      recordMount(internalInstance, id, parentID);
      getChildren(internalInstance).forEach(child => crawlAndRecordInitialMounts(getID(child), id, rootID));
    }
    if (_constants__WEBPACK_IMPORTED_MODULE_3__.__DEBUG__) {
      console.groupEnd();
    }
  }
  function flushInitialOperations() {
    const roots = renderer.Mount._instancesByReactRootID || renderer.Mount._instancesByContainerID;
    for (const key in roots) {
      const internalInstance = roots[key];
      const id = getID(internalInstance);
      crawlAndRecordInitialMounts(id, 0, id);
      flushPendingEvents(id);
    }
  }
  const pendingOperations = [];
  const pendingStringTable = new Map();
  let pendingUnmountedIDs = [];
  let pendingStringTableLength = 0;
  let pendingUnmountedRootID = null;
  function flushPendingEvents(rootID) {
    if (pendingOperations.length === 0 && pendingUnmountedIDs.length === 0 && pendingUnmountedRootID === null) {
      return;
    }
    const numUnmountIDs = pendingUnmountedIDs.length + (pendingUnmountedRootID === null ? 0 : 1);
    const operations = new Array(2 + 1 + pendingStringTableLength + (numUnmountIDs > 0 ? 2 + numUnmountIDs : 0) + (pendingUnmountedRootID === null ? 0 : 3) + pendingOperations.length);
    let i = 0;
    operations[i++] = rendererID;
    operations[i++] = rootID;
    operations[i++] = pendingStringTableLength;
    pendingStringTable.forEach((value, key) => {
      operations[i++] = key.length;
      const encodedKey = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.utfEncodeString)(key);
      for (let j = 0; j < encodedKey.length; j++) {
        operations[i + j] = encodedKey[j];
      }
      i += key.length;
    });
    if (numUnmountIDs > 0) {
      operations[i++] = _constants__WEBPACK_IMPORTED_MODULE_3__.TREE_OPERATION_REMOVE;
      operations[i++] = numUnmountIDs;
      for (let j = 0; j < pendingUnmountedIDs.length; j++) {
        operations[i++] = pendingUnmountedIDs[j];
      }
      if (pendingUnmountedRootID !== null) {
        operations[i] = pendingUnmountedRootID;
        i++;
        operations[i++] = _constants__WEBPACK_IMPORTED_MODULE_3__.SUSPENSE_TREE_OPERATION_REMOVE;
        operations[i++] = 1;
        operations[i++] = pendingUnmountedRootID;
      }
    }
    for (let j = 0; j < pendingOperations.length; j++) {
      operations[i + j] = pendingOperations[j];
    }
    i += pendingOperations.length;
    if (_constants__WEBPACK_IMPORTED_MODULE_3__.__DEBUG__) {
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__.printOperationsArray)(operations);
    }
    hook.emit('operations', operations);
    pendingOperations.length = 0;
    pendingUnmountedIDs = [];
    pendingUnmountedRootID = null;
    pendingStringTable.clear();
    pendingStringTableLength = 0;
  }
  function pushOperation(op) {
    if (true) {
      if (!Number.isInteger(op)) {
        console.error('pushOperation() was called but the value is not an integer.', op);
      }
    }
    pendingOperations.push(op);
  }
  function getStringID(str) {
    if (str === null) {
      return 0;
    }
    const existingID = pendingStringTable.get(str);
    if (existingID !== undefined) {
      return existingID;
    }
    const stringID = pendingStringTable.size + 1;
    pendingStringTable.set(str, stringID);
    pendingStringTableLength += str.length + 1;
    return stringID;
  }
  let currentlyInspectedElementID = null;
  let currentlyInspectedPaths = {};
  function mergeInspectedPaths(path) {
    let current = currentlyInspectedPaths;
    path.forEach(key => {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    });
  }
  function createIsPathAllowed(key) {
    return function isPathAllowed(path) {
      let current = currentlyInspectedPaths[key];
      if (!current) {
        return false;
      }
      for (let i = 0; i < path.length; i++) {
        current = current[path[i]];
        if (!current) {
          return false;
        }
      }
      return true;
    };
  }
  function getInstanceAndStyle(id) {
    let instance = null;
    let style = null;
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance != null) {
      instance = internalInstance._instance || null;
      const element = internalInstance._currentElement;
      if (element != null && element.props != null) {
        style = element.props.style || null;
      }
    }
    return {
      instance,
      style
    };
  }
  function updateSelectedElement(id) {
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance == null) {
      console.warn(`Could not find instance with id "${id}"`);
      return;
    }
    switch (getElementType(internalInstance)) {
      case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeClass:
        global.$r = internalInstance._instance;
        break;
      case react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeFunction:
        const element = internalInstance._currentElement;
        if (element == null) {
          console.warn(`Could not find element with id "${id}"`);
          return;
        }
        global.$r = {
          props: element.props,
          type: element.type
        };
        break;
      default:
        global.$r = null;
        break;
    }
  }
  function storeAsGlobal(id, path, count) {
    const inspectedElement = inspectElementRaw(id);
    if (inspectedElement !== null) {
      const value = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getInObject)(inspectedElement, path);
      const key = `$reactTemp${count}`;
      window[key] = value;
      console.log(key);
      console.log(value);
    }
  }
  function getSerializedElementValueByPath(id, path) {
    const inspectedElement = inspectElementRaw(id);
    if (inspectedElement !== null) {
      const valueToCopy = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getInObject)(inspectedElement, path);
      return (0,_utils__WEBPACK_IMPORTED_MODULE_2__.serializeToString)(valueToCopy);
    }
  }
  function inspectElement(requestID, id, path, forceFullData) {
    if (forceFullData || currentlyInspectedElementID !== id) {
      currentlyInspectedElementID = id;
      currentlyInspectedPaths = {};
    }
    const inspectedElement = inspectElementRaw(id);
    if (inspectedElement === null) {
      return {
        id,
        responseID: requestID,
        type: 'not-found'
      };
    }
    if (path !== null) {
      mergeInspectedPaths(path);
    }
    updateSelectedElement(id);
    inspectedElement.context = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.context, createIsPathAllowed('context'));
    inspectedElement.props = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.props, createIsPathAllowed('props'));
    inspectedElement.state = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.state, createIsPathAllowed('state'));
    inspectedElement.suspendedBy = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.cleanForBridge)(inspectedElement.suspendedBy, createIsPathAllowed('suspendedBy'));
    return {
      id,
      responseID: requestID,
      type: 'full-data',
      value: inspectedElement
    };
  }
  function inspectElementRaw(id) {
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance == null) {
      return null;
    }
    const rootID = internalInstanceToRootIDMap.get(internalInstance);
    if (rootID === undefined) {
      throw new Error('Expected to find root ID.');
    }
    const isRoot = rootID === id;
    return isRoot ? inspectRootsRaw(rootID) : inspectInternalInstanceRaw(id, internalInstance);
  }
  function inspectInternalInstanceRaw(id, internalInstance) {
    const {
      key
    } = getData(internalInstance);
    const type = getElementType(internalInstance);
    let context = null;
    let owners = null;
    let props = null;
    let state = null;
    const element = internalInstance._currentElement;
    if (element !== null) {
      props = element.props;
      let owner = element._owner;
      if (owner) {
        owners = [];
        while (owner != null) {
          owners.push({
            displayName: getData(owner).displayName || 'Unknown',
            id: getID(owner),
            key: element.key,
            env: null,
            stack: null,
            type: getElementType(owner)
          });
          if (owner._currentElement) {
            owner = owner._currentElement._owner;
          }
        }
      }
    }
    const publicInstance = internalInstance._instance;
    if (publicInstance != null) {
      context = publicInstance.context || null;
      state = publicInstance.state || null;
    }
    const errors = [];
    const warnings = [];
    return {
      id,
      canEditHooks: false,
      canEditFunctionProps: false,
      canEditHooksAndDeletePaths: false,
      canEditHooksAndRenamePaths: false,
      canEditFunctionPropsDeletePaths: false,
      canEditFunctionPropsRenamePaths: false,
      canToggleError: false,
      isErrored: false,
      canToggleSuspense: false,
      isSuspended: null,
      source: null,
      stack: null,
      hasLegacyContext: true,
      type: type,
      key: key != null ? key : null,
      context,
      hooks: null,
      props,
      state,
      errors,
      warnings,
      suspendedBy: [],
      suspendedByRange: null,
      unknownSuspenders: _constants__WEBPACK_IMPORTED_MODULE_3__.UNKNOWN_SUSPENDERS_NONE,
      owners,
      env: null,
      rootType: null,
      rendererPackageName: null,
      rendererVersion: null,
      plugins: {
        stylex: null
      },
      nativeTag: null
    };
  }
  function inspectRootsRaw(arbitraryRootID) {
    const roots = renderer.Mount._instancesByReactRootID || renderer.Mount._instancesByContainerID;
    const inspectedRoots = {
      id: arbitraryRootID,
      type: react_devtools_shared_src_frontend_types__WEBPACK_IMPORTED_MODULE_0__.ElementTypeRoot,
      isErrored: false,
      errors: [],
      warnings: [],
      suspendedBy: [],
      suspendedByRange: null,
      unknownSuspenders: _constants__WEBPACK_IMPORTED_MODULE_3__.UNKNOWN_SUSPENDERS_NONE,
      rootType: null,
      plugins: {
        stylex: null
      },
      nativeTag: null,
      env: null,
      source: null,
      stack: null,
      rendererPackageName: null,
      rendererVersion: null,
      key: null,
      canEditFunctionProps: false,
      canEditHooks: false,
      canEditFunctionPropsDeletePaths: false,
      canEditFunctionPropsRenamePaths: false,
      canEditHooksAndDeletePaths: false,
      canEditHooksAndRenamePaths: false,
      canToggleError: false,
      canToggleSuspense: false,
      isSuspended: false,
      hasLegacyContext: false,
      context: null,
      hooks: null,
      props: null,
      state: null,
      owners: null
    };
    let minSuspendedByRange = Infinity;
    let maxSuspendedByRange = -Infinity;
    for (const rootKey in roots) {
      const internalInstance = roots[rootKey];
      const id = getID(internalInstance);
      const inspectedRoot = inspectInternalInstanceRaw(id, internalInstance);
      if (inspectedRoot === null) {
        return null;
      }
      if (inspectedRoot.isErrored) {
        inspectedRoots.isErrored = true;
      }
      for (let i = 0; i < inspectedRoot.errors.length; i++) {
        inspectedRoots.errors.push(inspectedRoot.errors[i]);
      }
      for (let i = 0; i < inspectedRoot.warnings.length; i++) {
        inspectedRoots.warnings.push(inspectedRoot.warnings[i]);
      }
      for (let i = 0; i < inspectedRoot.suspendedBy.length; i++) {
        inspectedRoots.suspendedBy.push(inspectedRoot.suspendedBy[i]);
      }
      const suspendedByRange = inspectedRoot.suspendedByRange;
      if (suspendedByRange !== null) {
        if (suspendedByRange[0] < minSuspendedByRange) {
          minSuspendedByRange = suspendedByRange[0];
        }
        if (suspendedByRange[1] > maxSuspendedByRange) {
          maxSuspendedByRange = suspendedByRange[1];
        }
      }
    }
    if (minSuspendedByRange !== Infinity || maxSuspendedByRange !== -Infinity) {
      inspectedRoots.suspendedByRange = [minSuspendedByRange, maxSuspendedByRange];
    }
    return inspectedRoots;
  }
  function logElementToConsole(id) {
    const result = inspectElementRaw(id);
    if (result === null) {
      console.warn(`Could not find element with id "${id}"`);
      return;
    }
    const displayName = getDisplayNameForElementID(id);
    const supportsGroup = typeof console.groupCollapsed === 'function';
    if (supportsGroup) {
      console.groupCollapsed(`[Click to expand] %c<${displayName || 'Component'} />`, 'color: var(--dom-tag-name-color); font-weight: normal;');
    }
    if (result.props !== null) {
      console.log('Props:', result.props);
    }
    if (result.state !== null) {
      console.log('State:', result.state);
    }
    if (result.context !== null) {
      console.log('Context:', result.context);
    }
    const hostInstance = findHostInstanceForInternalID(id);
    if (hostInstance !== null) {
      console.log('Node:', hostInstance);
    }
    if (window.chrome || /firefox/i.test(navigator.userAgent)) {
      console.log('Right-click any value to save it as a global variable for further inspection.');
    }
    if (supportsGroup) {
      console.groupEnd();
    }
  }
  function getElementAttributeByPath(id, path) {
    const inspectedElement = inspectElementRaw(id);
    if (inspectedElement !== null) {
      return (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getInObject)(inspectedElement, path);
    }
    return undefined;
  }
  function getElementSourceFunctionById(id) {
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance == null) {
      console.warn(`Could not find instance with id "${id}"`);
      return null;
    }
    const element = internalInstance._currentElement;
    if (element == null) {
      console.warn(`Could not find element with id "${id}"`);
      return null;
    }
    return element.type;
  }
  function deletePath(type, id, hookID, path) {
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance != null) {
      const publicInstance = internalInstance._instance;
      if (publicInstance != null) {
        switch (type) {
          case 'context':
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.deletePathInObject)(publicInstance.context, path);
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
          case 'hooks':
            throw new Error('Hooks not supported by this renderer');
          case 'props':
            const element = internalInstance._currentElement;
            internalInstance._currentElement = {
              ...element,
              props: (0,_utils__WEBPACK_IMPORTED_MODULE_2__.copyWithDelete)(element.props, path)
            };
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
          case 'state':
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.deletePathInObject)(publicInstance.state, path);
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
        }
      }
    }
  }
  function renamePath(type, id, hookID, oldPath, newPath) {
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance != null) {
      const publicInstance = internalInstance._instance;
      if (publicInstance != null) {
        switch (type) {
          case 'context':
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.renamePathInObject)(publicInstance.context, oldPath, newPath);
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
          case 'hooks':
            throw new Error('Hooks not supported by this renderer');
          case 'props':
            const element = internalInstance._currentElement;
            internalInstance._currentElement = {
              ...element,
              props: (0,_utils__WEBPACK_IMPORTED_MODULE_2__.copyWithRename)(element.props, oldPath, newPath)
            };
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
          case 'state':
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.renamePathInObject)(publicInstance.state, oldPath, newPath);
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
        }
      }
    }
  }
  function overrideValueAtPath(type, id, hookID, path, value) {
    const internalInstance = idToInternalInstanceMap.get(id);
    if (internalInstance != null) {
      const publicInstance = internalInstance._instance;
      if (publicInstance != null) {
        switch (type) {
          case 'context':
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.setInObject)(publicInstance.context, path, value);
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
          case 'hooks':
            throw new Error('Hooks not supported by this renderer');
          case 'props':
            const element = internalInstance._currentElement;
            internalInstance._currentElement = {
              ...element,
              props: (0,_utils__WEBPACK_IMPORTED_MODULE_2__.copyWithSet)(element.props, path, value)
            };
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
          case 'state':
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.setInObject)(publicInstance.state, path, value);
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.forceUpdate)(publicInstance);
            break;
        }
      }
    }
  }
  const getProfilingData = () => {
    throw new Error('getProfilingData not supported by this renderer');
  };
  const handleCommitFiberRoot = () => {
    throw new Error('handleCommitFiberRoot not supported by this renderer');
  };
  const handleCommitFiberUnmount = () => {
    throw new Error('handleCommitFiberUnmount not supported by this renderer');
  };
  const handlePostCommitFiberRoot = () => {
    throw new Error('handlePostCommitFiberRoot not supported by this renderer');
  };
  const overrideError = () => {
    throw new Error('overrideError not supported by this renderer');
  };
  const overrideSuspense = () => {
    throw new Error('overrideSuspense not supported by this renderer');
  };
  const overrideSuspenseMilestone = () => {
    throw new Error('overrideSuspenseMilestone not supported by this renderer');
  };
  const startProfiling = () => {};
  const stopProfiling = () => {};
  function getBestMatchForTrackedPath() {
    return null;
  }
  function getPathForElement(id) {
    return null;
  }
  function updateComponentFilters(componentFilters) {}
  function getEnvironmentNames() {
    return [];
  }
  function setTraceUpdatesEnabled(enabled) {}
  function setTrackedPath(path) {}
  function getOwnersList(id) {
    return null;
  }
  function clearErrorsAndWarnings() {}
  function clearErrorsForElementID(id) {}
  function clearWarningsForElementID(id) {}
  function hasElementWithId(id) {
    return idToInternalInstanceMap.has(id);
  }
  return {
    clearErrorsAndWarnings,
    clearErrorsForElementID,
    clearWarningsForElementID,
    cleanup,
    getSerializedElementValueByPath,
    deletePath,
    flushInitialOperations,
    getBestMatchForTrackedPath,
    getDisplayNameForElementID,
    getNearestMountedDOMNode,
    getElementIDForHostInstance,
    getSuspenseNodeIDForHostInstance(id) {
      return null;
    },
    getInstanceAndStyle,
    findHostInstancesForElementID: id => {
      const hostInstance = findHostInstanceForInternalID(id);
      return hostInstance == null ? null : [hostInstance];
    },
    findLastKnownRectsForID() {
      return null;
    },
    getOwnersList,
    getPathForElement,
    getProfilingData,
    handleCommitFiberRoot,
    handleCommitFiberUnmount,
    handlePostCommitFiberRoot,
    hasElementWithId,
    inspectElement,
    logElementToConsole,
    overrideError,
    overrideSuspense,
    overrideSuspenseMilestone,
    overrideValueAtPath,
    renamePath,
    getElementAttributeByPath,
    getElementSourceFunctionById,
    renderer,
    setTraceUpdatesEnabled,
    setTrackedPath,
    startProfiling,
    stopProfiling,
    storeAsGlobal,
    supportsTogglingSuspense,
    updateComponentFilters,
    getEnvironmentNames
  };
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/legacy/utils.js":
/*!************************************************************!*\
  !*** ../react-devtools-shared/src/backend/legacy/utils.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decorate": () => (/* binding */ decorate),
/* harmony export */   "decorateMany": () => (/* binding */ decorateMany),
/* harmony export */   "forceUpdate": () => (/* binding */ forceUpdate),
/* harmony export */   "restoreMany": () => (/* binding */ restoreMany)
/* harmony export */ });
function decorate(object, attr, fn) {
  const old = object[attr];
  object[attr] = function (instance) {
    return fn.call(this, old, arguments);
  };
  return old;
}
function decorateMany(source, fns) {
  const olds = {};
  for (const name in fns) {
    olds[name] = decorate(source, name, fns[name]);
  }
  return olds;
}
function restoreMany(source, olds) {
  for (const name in olds) {
    source[name] = olds[name];
  }
}
function forceUpdate(instance) {
  if (typeof instance.forceUpdate === 'function') {
    instance.forceUpdate();
  } else if (instance.updater != null && typeof instance.updater.enqueueForceUpdate === 'function') {
    instance.updater.enqueueForceUpdate(this, () => {}, 'forceUpdate');
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/shared/DevToolsComponentStackFrame.js":
/*!**********************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/shared/DevToolsComponentStackFrame.js ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "describeBuiltInComponentFrame": () => (/* binding */ describeBuiltInComponentFrame),
/* harmony export */   "describeClassComponentFrame": () => (/* binding */ describeClassComponentFrame),
/* harmony export */   "describeDebugInfoFrame": () => (/* binding */ describeDebugInfoFrame),
/* harmony export */   "describeFunctionComponentFrame": () => (/* binding */ describeFunctionComponentFrame),
/* harmony export */   "describeNativeComponentFrame": () => (/* binding */ describeNativeComponentFrame)
/* harmony export */ });
/* harmony import */ var _DevToolsConsolePatching__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./DevToolsConsolePatching */ "../react-devtools-shared/src/backend/shared/DevToolsConsolePatching.js");

let prefix;
function describeBuiltInComponentFrame(name) {
  if (prefix === undefined) {
    try {
      throw Error();
    } catch (x) {
      const match = x.stack.trim().match(/\n( *(at )?)/);
      prefix = match && match[1] || '';
    }
  }
  let suffix = '';
  if (true) {
    suffix = ' (<anonymous>)';
  } else {}
  return '\n' + prefix + name + suffix;
}
function describeDebugInfoFrame(name, env) {
  return describeBuiltInComponentFrame(name + (env ? ' [' + env + ']' : ''));
}
let reentry = false;
let componentFrameCache;
if (true) {
  const PossiblyWeakMap = typeof WeakMap === 'function' ? WeakMap : Map;
  componentFrameCache = new PossiblyWeakMap();
}
function describeNativeComponentFrame(fn, construct, currentDispatcherRef) {
  if (!fn || reentry) {
    return '';
  }
  if (true) {
    const frame = componentFrameCache.get(fn);
    if (frame !== undefined) {
      return frame;
    }
  }
  const previousPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = undefined;
  reentry = true;
  const previousDispatcher = currentDispatcherRef.H;
  currentDispatcherRef.H = null;
  (0,_DevToolsConsolePatching__WEBPACK_IMPORTED_MODULE_0__.disableLogs)();
  try {
    const RunInRootFrame = {
      DetermineComponentFrameRoot() {
        let control;
        try {
          if (construct) {
            const Fake = function () {
              throw Error();
            };
            Object.defineProperty(Fake.prototype, 'props', {
              set: function () {
                throw Error();
              }
            });
            if (typeof Reflect === 'object' && Reflect.construct) {
              try {
                Reflect.construct(Fake, []);
              } catch (x) {
                control = x;
              }
              Reflect.construct(fn, [], Fake);
            } else {
              try {
                Fake.call();
              } catch (x) {
                control = x;
              }
              let prototypeModified = false;
              let prevProps;
              try {
                prevProps = Object.getOwnPropertyDescriptor(fn.prototype, 'props');
                Object.defineProperty(fn.prototype, 'props', {
                  configurable: true,
                  set() {
                    throw Error();
                  }
                });
                prototypeModified = true;
                new fn();
              } finally {
                if (prototypeModified) {
                  if (prevProps !== undefined) {
                    Object.defineProperty(fn.prototype, 'props', prevProps);
                  } else {
                    delete fn.prototype.props;
                  }
                }
              }
            }
          } else {
            try {
              throw Error();
            } catch (x) {
              control = x;
            }
            const maybePromise = fn();
            if (maybePromise && typeof maybePromise.catch === 'function') {
              maybePromise.catch(() => {});
            }
          }
        } catch (sample) {
          if (sample && control && typeof sample.stack === 'string') {
            return [sample.stack, control.stack];
          }
        }
        return [null, null];
      }
    };
    RunInRootFrame.DetermineComponentFrameRoot.displayName = 'DetermineComponentFrameRoot';
    const namePropDescriptor = Object.getOwnPropertyDescriptor(RunInRootFrame.DetermineComponentFrameRoot, 'name');
    if (namePropDescriptor && namePropDescriptor.configurable) {
      Object.defineProperty(RunInRootFrame.DetermineComponentFrameRoot, 'name', {
        value: 'DetermineComponentFrameRoot'
      });
    }
    const [sampleStack, controlStack] = RunInRootFrame.DetermineComponentFrameRoot();
    if (sampleStack && controlStack) {
      const sampleLines = sampleStack.split('\n');
      const controlLines = controlStack.split('\n');
      let s = 0;
      let c = 0;
      while (s < sampleLines.length && !sampleLines[s].includes('DetermineComponentFrameRoot')) {
        s++;
      }
      while (c < controlLines.length && !controlLines[c].includes('DetermineComponentFrameRoot')) {
        c++;
      }
      if (s === sampleLines.length || c === controlLines.length) {
        s = sampleLines.length - 1;
        c = controlLines.length - 1;
        while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
          c--;
        }
      }
      for (; s >= 1 && c >= 0; s--, c--) {
        if (sampleLines[s] !== controlLines[c]) {
          if (s !== 1 || c !== 1) {
            do {
              s--;
              c--;
              if (c < 0 || sampleLines[s] !== controlLines[c]) {
                let frame = '\n' + sampleLines[s].replace(' at new ', ' at ');
                if (fn.displayName && frame.includes('<anonymous>')) {
                  frame = frame.replace('<anonymous>', fn.displayName);
                }
                if (true) {
                  if (typeof fn === 'function') {
                    componentFrameCache.set(fn, frame);
                  }
                }
                return frame;
              }
            } while (s >= 1 && c >= 0);
          }
          break;
        }
      }
    }
  } finally {
    reentry = false;
    Error.prepareStackTrace = previousPrepareStackTrace;
    currentDispatcherRef.H = previousDispatcher;
    (0,_DevToolsConsolePatching__WEBPACK_IMPORTED_MODULE_0__.reenableLogs)();
  }
  const name = fn ? fn.displayName || fn.name : '';
  const syntheticFrame = name ? describeBuiltInComponentFrame(name) : '';
  if (true) {
    if (typeof fn === 'function') {
      componentFrameCache.set(fn, syntheticFrame);
    }
  }
  return syntheticFrame;
}
function describeClassComponentFrame(ctor, currentDispatcherRef) {
  return describeNativeComponentFrame(ctor, true, currentDispatcherRef);
}
function describeFunctionComponentFrame(fn, currentDispatcherRef) {
  return describeNativeComponentFrame(fn, false, currentDispatcherRef);
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/shared/DevToolsConsolePatching.js":
/*!******************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/shared/DevToolsConsolePatching.js ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "disableLogs": () => (/* binding */ disableLogs),
/* harmony export */   "reenableLogs": () => (/* binding */ reenableLogs)
/* harmony export */ });
let disabledDepth = 0;
let prevLog;
let prevInfo;
let prevWarn;
let prevError;
let prevGroup;
let prevGroupCollapsed;
let prevGroupEnd;
function disabledLog() {}
disabledLog.__reactDisabledLog = true;
function disableLogs() {
  if (disabledDepth === 0) {
    prevLog = console.log;
    prevInfo = console.info;
    prevWarn = console.warn;
    prevError = console.error;
    prevGroup = console.group;
    prevGroupCollapsed = console.groupCollapsed;
    prevGroupEnd = console.groupEnd;
    const props = {
      configurable: true,
      enumerable: true,
      value: disabledLog,
      writable: true
    };
    Object.defineProperties(console, {
      info: props,
      log: props,
      warn: props,
      error: props,
      group: props,
      groupCollapsed: props,
      groupEnd: props
    });
  }
  disabledDepth++;
}
function reenableLogs() {
  disabledDepth--;
  if (disabledDepth === 0) {
    const props = {
      configurable: true,
      enumerable: true,
      writable: true
    };
    Object.defineProperties(console, {
      log: {
        ...props,
        value: prevLog
      },
      info: {
        ...props,
        value: prevInfo
      },
      warn: {
        ...props,
        value: prevWarn
      },
      error: {
        ...props,
        value: prevError
      },
      group: {
        ...props,
        value: prevGroup
      },
      groupCollapsed: {
        ...props,
        value: prevGroupCollapsed
      },
      groupEnd: {
        ...props,
        value: prevGroupEnd
      }
    });
  }
  if (disabledDepth < 0) {
    console.error('disabledDepth fell below zero. ' + 'This is a bug in React. Please file an issue.');
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/shared/DevToolsOwnerStack.js":
/*!*************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/shared/DevToolsOwnerStack.js ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "formatOwnerStack": () => (/* binding */ formatOwnerStack)
/* harmony export */ });
function formatOwnerStack(error) {
  const prevPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = undefined;
  let stack = error.stack;
  Error.prepareStackTrace = prevPrepareStackTrace;
  if (stack.startsWith('Error: react-stack-top-frame\n')) {
    stack = stack.slice(29);
  }
  let idx = stack.indexOf('\n');
  if (idx !== -1) {
    stack = stack.slice(idx + 1);
  }
  idx = stack.indexOf('react_stack_bottom_frame');
  if (idx === -1) {
    idx = stack.indexOf('react-stack-bottom-frame');
  }
  if (idx !== -1) {
    idx = stack.lastIndexOf('\n', idx);
  }
  if (idx !== -1) {
    stack = stack.slice(0, idx);
  } else {
    return '';
  }
  return stack;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/shared/DevToolsReactDispatcher.js":
/*!******************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/shared/DevToolsReactDispatcher.js ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getDispatcherRef": () => (/* binding */ getDispatcherRef)
/* harmony export */ });
function getDispatcherRef(renderer) {
  if (renderer.currentDispatcherRef === undefined) {
    return undefined;
  }
  const injectedRef = renderer.currentDispatcherRef;
  if (typeof injectedRef.H === 'undefined' && typeof injectedRef.current !== 'undefined') {
    return {
      get H() {
        return injectedRef.current;
      },
      set H(value) {
        injectedRef.current = value;
      }
    };
  }
  return injectedRef;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/shared/DevToolsServerComponentLogs.js":
/*!**********************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/shared/DevToolsServerComponentLogs.js ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "componentInfoToComponentLogsMap": () => (/* binding */ componentInfoToComponentLogsMap)
/* harmony export */ });
const componentInfoToComponentLogsMap = new WeakMap();

/***/ }),

/***/ "../react-devtools-shared/src/backend/shared/ReactSymbols.js":
/*!*******************************************************************!*\
  !*** ../react-devtools-shared/src/backend/shared/ReactSymbols.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CONCURRENT_MODE_NUMBER": () => (/* binding */ CONCURRENT_MODE_NUMBER),
/* harmony export */   "CONCURRENT_MODE_SYMBOL_STRING": () => (/* binding */ CONCURRENT_MODE_SYMBOL_STRING),
/* harmony export */   "CONSUMER_SYMBOL_STRING": () => (/* binding */ CONSUMER_SYMBOL_STRING),
/* harmony export */   "CONTEXT_NUMBER": () => (/* binding */ CONTEXT_NUMBER),
/* harmony export */   "CONTEXT_SYMBOL_STRING": () => (/* binding */ CONTEXT_SYMBOL_STRING),
/* harmony export */   "DEBUG_TRACING_MODE_NUMBER": () => (/* binding */ DEBUG_TRACING_MODE_NUMBER),
/* harmony export */   "DEBUG_TRACING_MODE_SYMBOL_STRING": () => (/* binding */ DEBUG_TRACING_MODE_SYMBOL_STRING),
/* harmony export */   "DEPRECATED_ASYNC_MODE_SYMBOL_STRING": () => (/* binding */ DEPRECATED_ASYNC_MODE_SYMBOL_STRING),
/* harmony export */   "ELEMENT_SYMBOL_STRING": () => (/* binding */ ELEMENT_SYMBOL_STRING),
/* harmony export */   "FORWARD_REF_NUMBER": () => (/* binding */ FORWARD_REF_NUMBER),
/* harmony export */   "FORWARD_REF_SYMBOL_STRING": () => (/* binding */ FORWARD_REF_SYMBOL_STRING),
/* harmony export */   "FRAGMENT_NUMBER": () => (/* binding */ FRAGMENT_NUMBER),
/* harmony export */   "FRAGMENT_SYMBOL_STRING": () => (/* binding */ FRAGMENT_SYMBOL_STRING),
/* harmony export */   "LAZY_NUMBER": () => (/* binding */ LAZY_NUMBER),
/* harmony export */   "LAZY_SYMBOL_STRING": () => (/* binding */ LAZY_SYMBOL_STRING),
/* harmony export */   "LEGACY_ELEMENT_NUMBER": () => (/* binding */ LEGACY_ELEMENT_NUMBER),
/* harmony export */   "LEGACY_ELEMENT_SYMBOL_STRING": () => (/* binding */ LEGACY_ELEMENT_SYMBOL_STRING),
/* harmony export */   "MEMO_NUMBER": () => (/* binding */ MEMO_NUMBER),
/* harmony export */   "MEMO_SYMBOL_STRING": () => (/* binding */ MEMO_SYMBOL_STRING),
/* harmony export */   "PORTAL_NUMBER": () => (/* binding */ PORTAL_NUMBER),
/* harmony export */   "PORTAL_SYMBOL_STRING": () => (/* binding */ PORTAL_SYMBOL_STRING),
/* harmony export */   "PROFILER_NUMBER": () => (/* binding */ PROFILER_NUMBER),
/* harmony export */   "PROFILER_SYMBOL_STRING": () => (/* binding */ PROFILER_SYMBOL_STRING),
/* harmony export */   "PROVIDER_NUMBER": () => (/* binding */ PROVIDER_NUMBER),
/* harmony export */   "PROVIDER_SYMBOL_STRING": () => (/* binding */ PROVIDER_SYMBOL_STRING),
/* harmony export */   "REACT_MEMO_CACHE_SENTINEL": () => (/* binding */ REACT_MEMO_CACHE_SENTINEL),
/* harmony export */   "REACT_OPTIMISTIC_KEY": () => (/* binding */ REACT_OPTIMISTIC_KEY),
/* harmony export */   "SCOPE_NUMBER": () => (/* binding */ SCOPE_NUMBER),
/* harmony export */   "SCOPE_SYMBOL_STRING": () => (/* binding */ SCOPE_SYMBOL_STRING),
/* harmony export */   "SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED_SYMBOL_STRING": () => (/* binding */ SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED_SYMBOL_STRING),
/* harmony export */   "SERVER_CONTEXT_SYMBOL_STRING": () => (/* binding */ SERVER_CONTEXT_SYMBOL_STRING),
/* harmony export */   "STRICT_MODE_NUMBER": () => (/* binding */ STRICT_MODE_NUMBER),
/* harmony export */   "STRICT_MODE_SYMBOL_STRING": () => (/* binding */ STRICT_MODE_SYMBOL_STRING),
/* harmony export */   "SUSPENSE_LIST_NUMBER": () => (/* binding */ SUSPENSE_LIST_NUMBER),
/* harmony export */   "SUSPENSE_LIST_SYMBOL_STRING": () => (/* binding */ SUSPENSE_LIST_SYMBOL_STRING),
/* harmony export */   "SUSPENSE_NUMBER": () => (/* binding */ SUSPENSE_NUMBER),
/* harmony export */   "SUSPENSE_SYMBOL_STRING": () => (/* binding */ SUSPENSE_SYMBOL_STRING)
/* harmony export */ });
const CONCURRENT_MODE_NUMBER = 0xeacf;
const CONCURRENT_MODE_SYMBOL_STRING = 'Symbol(react.concurrent_mode)';
const CONTEXT_NUMBER = 0xeace;
const CONTEXT_SYMBOL_STRING = 'Symbol(react.context)';
const SERVER_CONTEXT_SYMBOL_STRING = 'Symbol(react.server_context)';
const DEPRECATED_ASYNC_MODE_SYMBOL_STRING = 'Symbol(react.async_mode)';
const ELEMENT_SYMBOL_STRING = 'Symbol(react.transitional.element)';
const LEGACY_ELEMENT_NUMBER = 0xeac7;
const LEGACY_ELEMENT_SYMBOL_STRING = 'Symbol(react.element)';
const DEBUG_TRACING_MODE_NUMBER = 0xeae1;
const DEBUG_TRACING_MODE_SYMBOL_STRING = 'Symbol(react.debug_trace_mode)';
const FORWARD_REF_NUMBER = 0xead0;
const FORWARD_REF_SYMBOL_STRING = 'Symbol(react.forward_ref)';
const FRAGMENT_NUMBER = 0xeacb;
const FRAGMENT_SYMBOL_STRING = 'Symbol(react.fragment)';
const LAZY_NUMBER = 0xead4;
const LAZY_SYMBOL_STRING = 'Symbol(react.lazy)';
const MEMO_NUMBER = 0xead3;
const MEMO_SYMBOL_STRING = 'Symbol(react.memo)';
const PORTAL_NUMBER = 0xeaca;
const PORTAL_SYMBOL_STRING = 'Symbol(react.portal)';
const PROFILER_NUMBER = 0xead2;
const PROFILER_SYMBOL_STRING = 'Symbol(react.profiler)';
const PROVIDER_NUMBER = 0xeacd;
const PROVIDER_SYMBOL_STRING = 'Symbol(react.provider)';
const CONSUMER_SYMBOL_STRING = 'Symbol(react.consumer)';
const SCOPE_NUMBER = 0xead7;
const SCOPE_SYMBOL_STRING = 'Symbol(react.scope)';
const STRICT_MODE_NUMBER = 0xeacc;
const STRICT_MODE_SYMBOL_STRING = 'Symbol(react.strict_mode)';
const SUSPENSE_NUMBER = 0xead1;
const SUSPENSE_SYMBOL_STRING = 'Symbol(react.suspense)';
const SUSPENSE_LIST_NUMBER = 0xead8;
const SUSPENSE_LIST_SYMBOL_STRING = 'Symbol(react.suspense_list)';
const SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED_SYMBOL_STRING = 'Symbol(react.server_context.defaultValue)';
const REACT_MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');
const REACT_OPTIMISTIC_KEY = Symbol.for('react.optimistic_key');

/***/ }),

/***/ "../react-devtools-shared/src/backend/utils/formatConsoleArguments.js":
/*!****************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/utils/formatConsoleArguments.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ formatConsoleArguments)
/* harmony export */ });
function formatConsoleArguments(maybeMessage, ...inputArgs) {
  if (inputArgs.length === 0 || typeof maybeMessage !== 'string') {
    return [maybeMessage, ...inputArgs];
  }
  const args = inputArgs.slice();
  let template = '';
  let argumentsPointer = 0;
  for (let i = 0; i < maybeMessage.length; ++i) {
    const currentChar = maybeMessage[i];
    if (currentChar !== '%') {
      template += currentChar;
      continue;
    }
    const nextChar = maybeMessage[i + 1];
    ++i;
    switch (nextChar) {
      case 'c':
      case 'O':
      case 'o':
        {
          ++argumentsPointer;
          template += `%${nextChar}`;
          break;
        }
      case 'd':
      case 'i':
        {
          if (argumentsPointer >= args.length) {
            template += `%${nextChar}`;
            break;
          }
          const [arg] = args.splice(argumentsPointer, 1);
          template += parseInt(arg, 10).toString();
          break;
        }
      case 'f':
        {
          if (argumentsPointer >= args.length) {
            template += `%${nextChar}`;
            break;
          }
          const [arg] = args.splice(argumentsPointer, 1);
          template += parseFloat(arg).toString();
          break;
        }
      case 's':
        {
          if (argumentsPointer >= args.length) {
            template += `%${nextChar}`;
            break;
          }
          const [arg] = args.splice(argumentsPointer, 1);
          template += String(arg);
          break;
        }
      default:
        if (nextChar === undefined) {
          template += '%';
        } else {
          template += `%${nextChar}`;
        }
    }
  }
  return [template, ...args];
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/utils/formatWithStyles.js":
/*!**********************************************************************!*\
  !*** ../react-devtools-shared/src/backend/utils/formatWithStyles.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ formatWithStyles)
/* harmony export */ });
function formatWithStyles(inputArgs, style) {
  if (inputArgs === undefined || inputArgs === null || inputArgs.length === 0 || typeof inputArgs[0] === 'string' && inputArgs[0].match(/([^%]|^)(%c)/g) || style === undefined) {
    return inputArgs;
  }
  const REGEXP = /([^%]|^)((%%)*)(%([oOdisf]))/g;
  if (typeof inputArgs[0] === 'string' && inputArgs[0].match(REGEXP)) {
    return [`%c${inputArgs[0]}`, style, ...inputArgs.slice(1)];
  } else {
    const firstArg = inputArgs.reduce((formatStr, elem, i) => {
      if (i > 0) {
        formatStr += ' ';
      }
      switch (typeof elem) {
        case 'string':
        case 'boolean':
        case 'symbol':
          return formatStr += '%s';
        case 'number':
          const formatting = Number.isInteger(elem) ? '%i' : '%f';
          return formatStr += formatting;
        default:
          return formatStr += '%o';
      }
    }, '%c');
    return [firstArg, style, ...inputArgs];
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/utils/index.js":
/*!***********************************************************!*\
  !*** ../react-devtools-shared/src/backend/utils/index.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "cleanForBridge": () => (/* binding */ cleanForBridge),
/* harmony export */   "copyWithDelete": () => (/* binding */ copyWithDelete),
/* harmony export */   "copyWithRename": () => (/* binding */ copyWithRename),
/* harmony export */   "copyWithSet": () => (/* binding */ copyWithSet),
/* harmony export */   "formatConsoleArguments": () => (/* reexport safe */ _formatConsoleArguments__WEBPACK_IMPORTED_MODULE_3__["default"]),
/* harmony export */   "formatConsoleArgumentsToSingleString": () => (/* binding */ formatConsoleArgumentsToSingleString),
/* harmony export */   "formatDurationToMicrosecondsGranularity": () => (/* binding */ formatDurationToMicrosecondsGranularity),
/* harmony export */   "formatWithStyles": () => (/* reexport safe */ _formatWithStyles__WEBPACK_IMPORTED_MODULE_2__["default"]),
/* harmony export */   "getEffectDurations": () => (/* binding */ getEffectDurations),
/* harmony export */   "gt": () => (/* binding */ gt),
/* harmony export */   "gte": () => (/* binding */ gte),
/* harmony export */   "hasAssignedBackend": () => (/* binding */ hasAssignedBackend),
/* harmony export */   "isReactNativeEnvironment": () => (/* binding */ isReactNativeEnvironment),
/* harmony export */   "isSynchronousXHRSupported": () => (/* binding */ isSynchronousXHRSupported),
/* harmony export */   "serializeToString": () => (/* binding */ serializeToString)
/* harmony export */ });
/* harmony import */ var compare_versions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! compare-versions */ "../../node_modules/compare-versions/lib/esm/index.js");
/* harmony import */ var react_devtools_shared_src_hydration__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/hydration */ "../react-devtools-shared/src/hydration.js");
/* harmony import */ var shared_isArray__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! shared/isArray */ "../shared/isArray.js");
/* harmony import */ var _formatWithStyles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./formatWithStyles */ "../react-devtools-shared/src/backend/utils/formatWithStyles.js");
/* harmony import */ var _formatConsoleArguments__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./formatConsoleArguments */ "../react-devtools-shared/src/backend/utils/formatConsoleArguments.js");





const FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER = '999.9.9';
function hasAssignedBackend(version) {
  if (version == null || version === '') {
    return false;
  }
  return gte(version, FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER);
}
function cleanForBridge(data, isPathAllowed, path = []) {
  if (data !== null) {
    const cleanedPaths = [];
    const unserializablePaths = [];
    const cleanedData = (0,react_devtools_shared_src_hydration__WEBPACK_IMPORTED_MODULE_0__.dehydrate)(data, cleanedPaths, unserializablePaths, path, isPathAllowed);
    return {
      data: cleanedData,
      cleaned: cleanedPaths,
      unserializable: unserializablePaths
    };
  } else {
    return null;
  }
}
function copyWithDelete(obj, path, index = 0) {
  const key = path[index];
  const updated = (0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(obj) ? obj.slice() : {
    ...obj
  };
  if (index + 1 === path.length) {
    if ((0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(updated)) {
      updated.splice(key, 1);
    } else {
      delete updated[key];
    }
  } else {
    updated[key] = copyWithDelete(obj[key], path, index + 1);
  }
  return updated;
}
function copyWithRename(obj, oldPath, newPath, index = 0) {
  const oldKey = oldPath[index];
  const updated = (0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(obj) ? obj.slice() : {
    ...obj
  };
  if (index + 1 === oldPath.length) {
    const newKey = newPath[index];
    updated[newKey] = updated[oldKey];
    if ((0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(updated)) {
      updated.splice(oldKey, 1);
    } else {
      delete updated[oldKey];
    }
  } else {
    updated[oldKey] = copyWithRename(obj[oldKey], oldPath, newPath, index + 1);
  }
  return updated;
}
function copyWithSet(obj, path, value, index = 0) {
  if (index >= path.length) {
    return value;
  }
  const key = path[index];
  const updated = (0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(obj) ? obj.slice() : {
    ...obj
  };
  updated[key] = copyWithSet(obj[key], path, value, index + 1);
  return updated;
}
function getEffectDurations(root) {
  let effectDuration = null;
  let passiveEffectDuration = null;
  const hostRoot = root.current;
  if (hostRoot != null) {
    const stateNode = hostRoot.stateNode;
    if (stateNode != null) {
      effectDuration = stateNode.effectDuration != null ? stateNode.effectDuration : null;
      passiveEffectDuration = stateNode.passiveEffectDuration != null ? stateNode.passiveEffectDuration : null;
    }
  }
  return {
    effectDuration,
    passiveEffectDuration
  };
}
function serializeToString(data) {
  if (data === undefined) {
    return 'undefined';
  }
  if (typeof data === 'function') {
    return data.toString();
  }
  const cache = new Set();
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return;
      }
      cache.add(value);
    }
    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }
    return value;
  }, 2);
}
function safeToString(val) {
  try {
    return String(val);
  } catch (err) {
    if (typeof val === 'object') {
      return '[object Object]';
    }
    throw err;
  }
}
function formatConsoleArgumentsToSingleString(maybeMessage, ...inputArgs) {
  const args = inputArgs.slice();
  let formatted = safeToString(maybeMessage);
  if (typeof maybeMessage === 'string') {
    if (args.length) {
      const REGEXP = /(%?)(%([jdisf]))/g;
      formatted = formatted.replace(REGEXP, (match, escaped, ptn, flag) => {
        if (escaped || args.length === 0) {
          return match;
        }
        let arg = args.shift();
        switch (flag) {
          case 's':
            arg += '';
            break;
          case 'd':
          case 'i':
            arg = parseInt(arg, 10).toString();
            break;
          case 'f':
            arg = parseFloat(arg).toString();
            break;
        }
        return arg;
      });
    }
  }
  if (args.length) {
    for (let i = 0; i < args.length; i++) {
      formatted += ' ' + safeToString(args[i]);
    }
  }
  formatted = formatted.replace(/%{2,2}/g, '%');
  return String(formatted);
}
function isSynchronousXHRSupported() {
  return !!(window.document && window.document.featurePolicy && window.document.featurePolicy.allowsFeature('sync-xhr'));
}
function gt(a = '', b = '') {
  return (0,compare_versions__WEBPACK_IMPORTED_MODULE_4__.compareVersions)(a, b) === 1;
}
function gte(a = '', b = '') {
  return (0,compare_versions__WEBPACK_IMPORTED_MODULE_4__.compareVersions)(a, b) > -1;
}
const isReactNativeEnvironment = () => {
  return window.document == null;
};
function formatDurationToMicrosecondsGranularity(duration) {
  return Math.round(duration * 1000) / 1000;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/utils/parseStackTrace.js":
/*!*********************************************************************!*\
  !*** ../react-devtools-shared/src/backend/utils/parseStackTrace.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "extractLocationFromComponentStack": () => (/* binding */ extractLocationFromComponentStack),
/* harmony export */   "extractLocationFromOwnerStack": () => (/* binding */ extractLocationFromOwnerStack),
/* harmony export */   "parseStackTrace": () => (/* binding */ parseStackTrace),
/* harmony export */   "parseStackTraceFromString": () => (/* binding */ parseStackTraceFromString)
/* harmony export */ });
function parseStackTraceFromChromeStack(stack, skipFrames) {
  if (stack.startsWith('Error: react-stack-top-frame\n')) {
    stack = stack.slice(29);
  }
  let idx = stack.indexOf('react_stack_bottom_frame');
  if (idx === -1) {
    idx = stack.indexOf('react-stack-bottom-frame');
  }
  if (idx !== -1) {
    idx = stack.lastIndexOf('\n', idx);
  }
  if (idx !== -1) {
    stack = stack.slice(0, idx);
  }
  const frames = stack.split('\n');
  const parsedFrames = [];
  for (let i = skipFrames; i < frames.length; i++) {
    const parsed = chromeFrameRegExp.exec(frames[i]);
    if (!parsed) {
      continue;
    }
    let name = parsed[1] || '';
    let isAsync = parsed[8] === 'async ';
    if (name === '<anonymous>') {
      name = '';
    } else if (name.startsWith('async ')) {
      name = name.slice(6);
      isAsync = true;
    }
    let filename = parsed[2] || parsed[5] || '';
    if (filename === '<anonymous>') {
      filename = '';
    }
    const line = +(parsed[3] || parsed[6] || 0);
    const col = +(parsed[4] || parsed[7] || 0);
    parsedFrames.push([name, filename, line, col, 0, 0, isAsync]);
  }
  return parsedFrames;
}
const firefoxFrameRegExp = /^((?:.*".+")?[^@]*)@(.+):(\d+):(\d+)$/;
function parseStackTraceFromFirefoxStack(stack, skipFrames) {
  let idx = stack.indexOf('react_stack_bottom_frame');
  if (idx === -1) {
    idx = stack.indexOf('react-stack-bottom-frame');
  }
  if (idx !== -1) {
    idx = stack.lastIndexOf('\n', idx);
  }
  if (idx !== -1) {
    stack = stack.slice(0, idx);
  }
  const frames = stack.split('\n');
  const parsedFrames = [];
  for (let i = skipFrames; i < frames.length; i++) {
    const parsed = firefoxFrameRegExp.exec(frames[i]);
    if (!parsed) {
      continue;
    }
    const name = parsed[1] || '';
    const filename = parsed[2] || '';
    const line = +parsed[3];
    const col = +parsed[4];
    parsedFrames.push([name, filename, line, col, 0, 0, false]);
  }
  return parsedFrames;
}
const CHROME_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m;
function parseStackTraceFromString(stack, skipFrames) {
  if (stack.match(CHROME_STACK_REGEXP)) {
    return parseStackTraceFromChromeStack(stack, skipFrames);
  }
  return parseStackTraceFromFirefoxStack(stack, skipFrames);
}
let framesToSkip = 0;
let collectedStackTrace = null;
const identifierRegExp = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
function getMethodCallName(callSite) {
  const typeName = callSite.getTypeName();
  const methodName = callSite.getMethodName();
  const functionName = callSite.getFunctionName();
  let result = '';
  if (functionName) {
    if (typeName && identifierRegExp.test(functionName) && functionName !== typeName) {
      result += typeName + '.';
    }
    result += functionName;
    if (methodName && functionName !== methodName && !functionName.endsWith('.' + methodName) && !functionName.endsWith(' ' + methodName)) {
      result += ' [as ' + methodName + ']';
    }
  } else {
    if (typeName) {
      result += typeName + '.';
    }
    if (methodName) {
      result += methodName;
    } else {
      result += '<anonymous>';
    }
  }
  return result;
}
function collectStackTrace(error, structuredStackTrace) {
  const result = [];
  for (let i = framesToSkip; i < structuredStackTrace.length; i++) {
    const callSite = structuredStackTrace[i];
    let name = typeof callSite.getFunctionName === 'function' ? callSite.getFunctionName() || '<anonymous>' : '';
    if (name.includes('react_stack_bottom_frame') || name.includes('react-stack-bottom-frame')) {
      break;
    } else if (typeof callSite.isNative === 'function' && callSite.isNative()) {
      const isAsync = typeof callSite.isAsync === 'function' && callSite.isAsync();
      result.push([name, '', 0, 0, 0, 0, isAsync]);
    } else {
      if (typeof callSite.isConstructor === 'function' && callSite.isConstructor()) {
        name = 'new ' + name;
      } else if (typeof callSite.isToplevel === 'function' && !callSite.isToplevel()) {
        name = getMethodCallName(callSite);
      }
      if (name === '<anonymous>') {
        name = '';
      }
      let filename = typeof callSite.getScriptNameOrSourceURL === 'function' ? callSite.getScriptNameOrSourceURL() || '<anonymous>' : '';
      if (filename === '<anonymous>') {
        filename = '';
        if (typeof callSite.isEval === 'function' && callSite.isEval()) {
          const origin = typeof callSite.getEvalOrigin === 'function' ? callSite.getEvalOrigin() : null;
          if (origin) {
            filename = origin.toString() + ', <anonymous>';
          }
        }
      }
      const line = typeof callSite.getLineNumber === 'function' && callSite.getLineNumber() || 0;
      const col = typeof callSite.getColumnNumber === 'function' && callSite.getColumnNumber() || 0;
      const enclosingLine = typeof callSite.getEnclosingLineNumber === 'function' ? callSite.getEnclosingLineNumber() || 0 : 0;
      const enclosingCol = typeof callSite.getEnclosingColumnNumber === 'function' ? callSite.getEnclosingColumnNumber() || 0 : 0;
      const isAsync = typeof callSite.isAsync === 'function' && callSite.isAsync();
      result.push([name, filename, line, col, enclosingLine, enclosingCol, isAsync]);
    }
  }
  collectedStackTrace = result;
  const name = error.name || 'Error';
  const message = error.message || '';
  let stack = name + ': ' + message;
  for (let i = 0; i < structuredStackTrace.length; i++) {
    stack += '\n    at ' + structuredStackTrace[i].toString();
  }
  return stack;
}
const chromeFrameRegExp = /^ *at (?:(.+) \((?:(.+):(\d+):(\d+)|\<anonymous\>)\)|(?:async )?(.+):(\d+):(\d+)|\<anonymous\>)$/;
const stackTraceCache = new WeakMap();
function parseStackTrace(error, skipFrames) {
  const existing = stackTraceCache.get(error);
  if (existing !== undefined) {
    return existing;
  }
  collectedStackTrace = null;
  framesToSkip = skipFrames;
  const previousPrepare = Error.prepareStackTrace;
  Error.prepareStackTrace = collectStackTrace;
  let stack;
  try {
    stack = String(error.stack);
  } finally {
    Error.prepareStackTrace = previousPrepare;
  }
  if (collectedStackTrace !== null) {
    const result = collectedStackTrace;
    collectedStackTrace = null;
    stackTraceCache.set(error, result);
    return result;
  }
  const parsedFrames = parseStackTraceFromString(stack, skipFrames);
  stackTraceCache.set(error, parsedFrames);
  return parsedFrames;
}
function extractLocationFromOwnerStack(error) {
  const stackTrace = parseStackTrace(error, 1);
  const stack = error.stack;
  if (!stack.includes('react_stack_bottom_frame') && !stack.includes('react-stack-bottom-frame')) {
    return null;
  }
  for (let i = stackTrace.length - 1; i >= 0; i--) {
    const [functionName, fileName, line, col, encLine, encCol] = stackTrace[i];
    if (fileName.indexOf(':') !== -1) {
      return [functionName, fileName, encLine || line, encCol || col];
    }
  }
  return null;
}
function extractLocationFromComponentStack(stack) {
  const stackTrace = parseStackTraceFromString(stack, 0);
  for (let i = 0; i < stackTrace.length; i++) {
    const [functionName, fileName, line, col, encLine, encCol] = stackTrace[i];
    if (fileName.indexOf(':') !== -1) {
      return [functionName, fileName, encLine || line, encCol || col];
    }
  }
  return null;
}

/***/ }),

/***/ "../react-devtools-shared/src/config/DevToolsFeatureFlags.extension-oss.js":
/*!*********************************************************************************!*\
  !*** ../react-devtools-shared/src/config/DevToolsFeatureFlags.extension-oss.js ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "enableActivitySlices": () => (/* binding */ enableActivitySlices),
/* harmony export */   "enableLogger": () => (/* binding */ enableLogger),
/* harmony export */   "enableStyleXFeatures": () => (/* binding */ enableStyleXFeatures),
/* harmony export */   "isInternalFacebookBuild": () => (/* binding */ isInternalFacebookBuild)
/* harmony export */ });
const enableActivitySlices = true;
const enableLogger = false;
const enableStyleXFeatures = false;
const isInternalFacebookBuild = false;
null;

/***/ }),

/***/ "../react-devtools-shared/src/constants.js":
/*!*************************************************!*\
  !*** ../react-devtools-shared/src/constants.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ANSI_STYLE_DIMMING_TEMPLATE": () => (/* binding */ ANSI_STYLE_DIMMING_TEMPLATE),
/* harmony export */   "ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK": () => (/* binding */ ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK),
/* harmony export */   "CHROME_WEBSTORE_EXTENSION_ID": () => (/* binding */ CHROME_WEBSTORE_EXTENSION_ID),
/* harmony export */   "FIREFOX_CONSOLE_DIMMING_COLOR": () => (/* binding */ FIREFOX_CONSOLE_DIMMING_COLOR),
/* harmony export */   "INTERNAL_EXTENSION_ID": () => (/* binding */ INTERNAL_EXTENSION_ID),
/* harmony export */   "LOCAL_EXTENSION_ID": () => (/* binding */ LOCAL_EXTENSION_ID),
/* harmony export */   "LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR": () => (/* binding */ LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR),
/* harmony export */   "LOCAL_STORAGE_BROWSER_THEME": () => (/* binding */ LOCAL_STORAGE_BROWSER_THEME),
/* harmony export */   "LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY": () => (/* binding */ LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY),
/* harmony export */   "LOCAL_STORAGE_DEFAULT_TAB_KEY": () => (/* binding */ LOCAL_STORAGE_DEFAULT_TAB_KEY),
/* harmony export */   "LOCAL_STORAGE_OPEN_IN_EDITOR_URL": () => (/* binding */ LOCAL_STORAGE_OPEN_IN_EDITOR_URL),
/* harmony export */   "LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET": () => (/* binding */ LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET),
/* harmony export */   "LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY": () => (/* binding */ LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY),
/* harmony export */   "LOCAL_STORAGE_SUPPORTS_PROFILING_KEY": () => (/* binding */ LOCAL_STORAGE_SUPPORTS_PROFILING_KEY),
/* harmony export */   "LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY": () => (/* binding */ LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY),
/* harmony export */   "PROFILER_EXPORT_VERSION": () => (/* binding */ PROFILER_EXPORT_VERSION),
/* harmony export */   "PROFILING_FLAG_BASIC_SUPPORT": () => (/* binding */ PROFILING_FLAG_BASIC_SUPPORT),
/* harmony export */   "PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT": () => (/* binding */ PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT),
/* harmony export */   "SESSION_STORAGE_LAST_SELECTION_KEY": () => (/* binding */ SESSION_STORAGE_LAST_SELECTION_KEY),
/* harmony export */   "SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY": () => (/* binding */ SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY),
/* harmony export */   "SESSION_STORAGE_RELOAD_AND_PROFILE_KEY": () => (/* binding */ SESSION_STORAGE_RELOAD_AND_PROFILE_KEY),
/* harmony export */   "SUSPENSE_TREE_OPERATION_ADD": () => (/* binding */ SUSPENSE_TREE_OPERATION_ADD),
/* harmony export */   "SUSPENSE_TREE_OPERATION_REMOVE": () => (/* binding */ SUSPENSE_TREE_OPERATION_REMOVE),
/* harmony export */   "SUSPENSE_TREE_OPERATION_REORDER_CHILDREN": () => (/* binding */ SUSPENSE_TREE_OPERATION_REORDER_CHILDREN),
/* harmony export */   "SUSPENSE_TREE_OPERATION_RESIZE": () => (/* binding */ SUSPENSE_TREE_OPERATION_RESIZE),
/* harmony export */   "SUSPENSE_TREE_OPERATION_SUSPENDERS": () => (/* binding */ SUSPENSE_TREE_OPERATION_SUSPENDERS),
/* harmony export */   "TREE_OPERATION_ADD": () => (/* binding */ TREE_OPERATION_ADD),
/* harmony export */   "TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE": () => (/* binding */ TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE),
/* harmony export */   "TREE_OPERATION_REMOVE": () => (/* binding */ TREE_OPERATION_REMOVE),
/* harmony export */   "TREE_OPERATION_REORDER_CHILDREN": () => (/* binding */ TREE_OPERATION_REORDER_CHILDREN),
/* harmony export */   "TREE_OPERATION_SET_SUBTREE_MODE": () => (/* binding */ TREE_OPERATION_SET_SUBTREE_MODE),
/* harmony export */   "TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS": () => (/* binding */ TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS),
/* harmony export */   "TREE_OPERATION_UPDATE_TREE_BASE_DURATION": () => (/* binding */ TREE_OPERATION_UPDATE_TREE_BASE_DURATION),
/* harmony export */   "UNKNOWN_SUSPENDERS_NONE": () => (/* binding */ UNKNOWN_SUSPENDERS_NONE),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_OLD_VERSION": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_OLD_VERSION),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_PRODUCTION": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_PRODUCTION),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE),
/* harmony export */   "__DEBUG__": () => (/* binding */ __DEBUG__),
/* harmony export */   "__PERFORMANCE_PROFILE__": () => (/* binding */ __PERFORMANCE_PROFILE__)
/* harmony export */ });
const CHROME_WEBSTORE_EXTENSION_ID = 'fmkadmapgofadopljbjfkapdkoienihi';
const INTERNAL_EXTENSION_ID = 'dnjnjgbfilfphmojnmhliehogmojhclc';
const LOCAL_EXTENSION_ID = 'ikiahnapldjmdmpkmfhjdjilojjhgcbf';
const __DEBUG__ = false;
const __PERFORMANCE_PROFILE__ = false;
const TREE_OPERATION_ADD = 1;
const TREE_OPERATION_REMOVE = 2;
const TREE_OPERATION_REORDER_CHILDREN = 3;
const TREE_OPERATION_UPDATE_TREE_BASE_DURATION = 4;
const TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS = 5;
const TREE_OPERATION_SET_SUBTREE_MODE = 7;
const SUSPENSE_TREE_OPERATION_ADD = 8;
const SUSPENSE_TREE_OPERATION_REMOVE = 9;
const SUSPENSE_TREE_OPERATION_REORDER_CHILDREN = 10;
const SUSPENSE_TREE_OPERATION_RESIZE = 11;
const SUSPENSE_TREE_OPERATION_SUSPENDERS = 12;
const TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE = 13;
const PROFILING_FLAG_BASIC_SUPPORT = 0b001;
const PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT = 0b100;
const UNKNOWN_SUSPENDERS_NONE = 0;
const UNKNOWN_SUSPENDERS_REASON_PRODUCTION = 1;
const UNKNOWN_SUSPENDERS_REASON_OLD_VERSION = 2;
const UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE = 3;
const LOCAL_STORAGE_DEFAULT_TAB_KEY = 'React::DevTools::defaultTab';
const LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY = 'React::DevTools::componentFilters';
const SESSION_STORAGE_LAST_SELECTION_KEY = 'React::DevTools::lastSelection';
const LOCAL_STORAGE_OPEN_IN_EDITOR_URL = 'React::DevTools::openInEditorUrl';
const LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET = 'React::DevTools::openInEditorUrlPreset';
const LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR = 'React::DevTools::alwaysOpenInEditor';
const LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY = 'React::DevTools::parseHookNames';
const SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY = 'React::DevTools::recordChangeDescriptions';
const SESSION_STORAGE_RELOAD_AND_PROFILE_KEY = 'React::DevTools::reloadAndProfile';
const LOCAL_STORAGE_BROWSER_THEME = 'React::DevTools::theme';
const LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY = 'React::DevTools::traceUpdatesEnabled';
const LOCAL_STORAGE_SUPPORTS_PROFILING_KEY = 'React::DevTools::supportsProfiling';
const PROFILER_EXPORT_VERSION = 5;
const FIREFOX_CONSOLE_DIMMING_COLOR = 'color: rgba(124, 124, 124, 0.75)';
const ANSI_STYLE_DIMMING_TEMPLATE = '\x1b[2;38;2;124;124;124m%s\x1b[0m';
const ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK = '\x1b[2;38;2;124;124;124m%s %o\x1b[0m';

/***/ }),

/***/ "../react-devtools-shared/src/frontend/types.js":
/*!******************************************************!*\
  !*** ../react-devtools-shared/src/frontend/types.js ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActivityHiddenMode": () => (/* binding */ ActivityHiddenMode),
/* harmony export */   "ActivityVisibleMode": () => (/* binding */ ActivityVisibleMode),
/* harmony export */   "ComponentFilterActivitySlice": () => (/* binding */ ComponentFilterActivitySlice),
/* harmony export */   "ComponentFilterDisplayName": () => (/* binding */ ComponentFilterDisplayName),
/* harmony export */   "ComponentFilterElementType": () => (/* binding */ ComponentFilterElementType),
/* harmony export */   "ComponentFilterEnvironmentName": () => (/* binding */ ComponentFilterEnvironmentName),
/* harmony export */   "ComponentFilterHOC": () => (/* binding */ ComponentFilterHOC),
/* harmony export */   "ComponentFilterLocation": () => (/* binding */ ComponentFilterLocation),
/* harmony export */   "ElementTypeActivity": () => (/* binding */ ElementTypeActivity),
/* harmony export */   "ElementTypeClass": () => (/* binding */ ElementTypeClass),
/* harmony export */   "ElementTypeContext": () => (/* binding */ ElementTypeContext),
/* harmony export */   "ElementTypeForwardRef": () => (/* binding */ ElementTypeForwardRef),
/* harmony export */   "ElementTypeFunction": () => (/* binding */ ElementTypeFunction),
/* harmony export */   "ElementTypeHostComponent": () => (/* binding */ ElementTypeHostComponent),
/* harmony export */   "ElementTypeMemo": () => (/* binding */ ElementTypeMemo),
/* harmony export */   "ElementTypeOtherOrUnknown": () => (/* binding */ ElementTypeOtherOrUnknown),
/* harmony export */   "ElementTypeProfiler": () => (/* binding */ ElementTypeProfiler),
/* harmony export */   "ElementTypeRoot": () => (/* binding */ ElementTypeRoot),
/* harmony export */   "ElementTypeSuspense": () => (/* binding */ ElementTypeSuspense),
/* harmony export */   "ElementTypeSuspenseList": () => (/* binding */ ElementTypeSuspenseList),
/* harmony export */   "ElementTypeTracingMarker": () => (/* binding */ ElementTypeTracingMarker),
/* harmony export */   "ElementTypeViewTransition": () => (/* binding */ ElementTypeViewTransition),
/* harmony export */   "ElementTypeVirtual": () => (/* binding */ ElementTypeVirtual),
/* harmony export */   "StrictMode": () => (/* binding */ StrictMode)
/* harmony export */ });
const ElementTypeClass = 1;
const ElementTypeContext = 2;
const ElementTypeFunction = 5;
const ElementTypeForwardRef = 6;
const ElementTypeHostComponent = 7;
const ElementTypeMemo = 8;
const ElementTypeOtherOrUnknown = 9;
const ElementTypeProfiler = 10;
const ElementTypeRoot = 11;
const ElementTypeSuspense = 12;
const ElementTypeSuspenseList = 13;
const ElementTypeTracingMarker = 14;
const ElementTypeVirtual = 15;
const ElementTypeViewTransition = 16;
const ElementTypeActivity = 17;
const ComponentFilterElementType = 1;
const ComponentFilterDisplayName = 2;
const ComponentFilterLocation = 3;
const ComponentFilterHOC = 4;
const ComponentFilterEnvironmentName = 5;
const ComponentFilterActivitySlice = 6;
const StrictMode = 1;
const ActivityHiddenMode = 2;
const ActivityVisibleMode = 3;

/***/ }),

/***/ "../react-devtools-shared/src/hook.js":
/*!********************************************!*\
  !*** ../react-devtools-shared/src/hook.js ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "installHook": () => (/* binding */ installHook)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/constants */ "../react-devtools-shared/src/constants.js");
/* harmony import */ var _attachRenderer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./attachRenderer */ "../react-devtools-shared/src/attachRenderer.js");
/* harmony import */ var react_devtools_shared_src_backend_utils_formatConsoleArguments__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils/formatConsoleArguments */ "../react-devtools-shared/src/backend/utils/formatConsoleArguments.js");
/* harmony import */ var react_devtools_shared_src_backend_utils_formatWithStyles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils/formatWithStyles */ "../react-devtools-shared/src/backend/utils/formatWithStyles.js");




const PREFIX_REGEX = /\s{4}(in|at)\s{1}/;
const ROW_COLUMN_NUMBER_REGEX = /:\d+:\d+(\n|$)/;
function isStringComponentStack(text) {
  return PREFIX_REGEX.test(text) || ROW_COLUMN_NUMBER_REGEX.test(text);
}
const frameDiffs = / \(\<anonymous\>\)$|\@unknown\:0\:0$|\(|\)|\[|\]/gm;
function areStackTracesEqual(a, b) {
  return a.replace(frameDiffs, '') === b.replace(frameDiffs, '');
}
const targetConsole = console;
const defaultProfilingSettings = {
  recordChangeDescriptions: false
};
function installHook(target, componentFiltersOrComponentFiltersPromise, maybeSettingsOrSettingsPromise, shouldStartProfilingNow = false, profilingSettings = defaultProfilingSettings) {
  if (target.hasOwnProperty('__REACT_DEVTOOLS_GLOBAL_HOOK__')) {
    return null;
  }
  function detectReactBuildType(renderer) {
    try {
      if (typeof renderer.version === 'string') {
        if (renderer.bundleType > 0) {
          return 'development';
        }
        return 'production';
      }
      const toString = Function.prototype.toString;
      if (renderer.Mount && renderer.Mount._renderNewRootComponent) {
        const renderRootCode = toString.call(renderer.Mount._renderNewRootComponent);
        if (renderRootCode.indexOf('function') !== 0) {
          return 'production';
        }
        if (renderRootCode.indexOf('storedMeasure') !== -1) {
          return 'development';
        }
        if (renderRootCode.indexOf('should be a pure function') !== -1) {
          if (renderRootCode.indexOf('NODE_ENV') !== -1) {
            return 'development';
          }
          if (renderRootCode.indexOf('development') !== -1) {
            return 'development';
          }
          if (renderRootCode.indexOf('true') !== -1) {
            return 'development';
          }
          if (renderRootCode.indexOf('nextElement') !== -1 || renderRootCode.indexOf('nextComponent') !== -1) {
            return 'unminified';
          } else {
            return 'development';
          }
        }
        if (renderRootCode.indexOf('nextElement') !== -1 || renderRootCode.indexOf('nextComponent') !== -1) {
          return 'unminified';
        }
        return 'outdated';
      }
    } catch (err) {}
    return 'production';
  }
  function checkDCE(fn) {
    try {
      const toString = Function.prototype.toString;
      const code = toString.call(fn);
      if (code.indexOf('^_^') > -1) {
        hasDetectedBadDCE = true;
        setTimeout(function () {
          throw new Error('React is running in production mode, but dead code ' + 'elimination has not been applied. Read how to correctly ' + 'configure React for production: ' + 'https://react.dev/link/perf-use-production-build');
        });
      }
    } catch (err) {}
  }
  const isProfiling = shouldStartProfilingNow;
  let uidCounter = 0;
  function inject(renderer) {
    const id = ++uidCounter;
    renderers.set(id, renderer);
    const reactBuildType = hasDetectedBadDCE ? 'deadcode' : detectReactBuildType(renderer);
    hook.emit('renderer', {
      id,
      renderer,
      reactBuildType
    });
    const rendererInterface = (0,_attachRenderer__WEBPACK_IMPORTED_MODULE_1__["default"])(hook, id, renderer, target, isProfiling, profilingSettings, componentFiltersOrComponentFiltersPromise);
    if (rendererInterface != null) {
      hook.rendererInterfaces.set(id, rendererInterface);
      hook.emit('renderer-attached', {
        id,
        rendererInterface
      });
    } else {
      hook.hasUnsupportedRendererAttached = true;
      hook.emit('unsupported-renderer-version');
    }
    return id;
  }
  let hasDetectedBadDCE = false;
  function sub(event, fn) {
    hook.on(event, fn);
    return () => hook.off(event, fn);
  }
  function on(event, fn) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(fn);
  }
  function off(event, fn) {
    if (!listeners[event]) {
      return;
    }
    const index = listeners[event].indexOf(fn);
    if (index !== -1) {
      listeners[event].splice(index, 1);
    }
    if (!listeners[event].length) {
      delete listeners[event];
    }
  }
  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].map(fn => fn(data));
    }
  }
  function getFiberRoots(rendererID) {
    const roots = fiberRoots;
    if (!roots[rendererID]) {
      roots[rendererID] = new Set();
    }
    return roots[rendererID];
  }
  function onCommitFiberUnmount(rendererID, fiber) {
    const rendererInterface = rendererInterfaces.get(rendererID);
    if (rendererInterface != null) {
      rendererInterface.handleCommitFiberUnmount(fiber);
    }
  }
  function onCommitFiberRoot(rendererID, root, priorityLevel) {
    const mountedRoots = hook.getFiberRoots(rendererID);
    const current = root.current;
    const isKnownRoot = mountedRoots.has(root);
    const isUnmounting = current.memoizedState == null || current.memoizedState.element == null;
    if (!isKnownRoot && !isUnmounting) {
      mountedRoots.add(root);
    } else if (isKnownRoot && isUnmounting) {
      mountedRoots.delete(root);
    }
    const rendererInterface = rendererInterfaces.get(rendererID);
    if (rendererInterface != null) {
      rendererInterface.handleCommitFiberRoot(root, priorityLevel);
    }
  }
  function onPostCommitFiberRoot(rendererID, root) {
    const rendererInterface = rendererInterfaces.get(rendererID);
    if (rendererInterface != null) {
      rendererInterface.handlePostCommitFiberRoot(root);
    }
  }
  let isRunningDuringStrictModeInvocation = false;
  function setStrictMode(rendererID, isStrictMode) {
    isRunningDuringStrictModeInvocation = isStrictMode;
    if (isStrictMode) {
      patchConsoleForStrictMode();
    } else {
      unpatchConsoleForStrictMode();
    }
  }
  const unpatchConsoleCallbacks = [];
  function patchConsoleForStrictMode() {
    if (!hook.settings) {
      return;
    }
    if (unpatchConsoleCallbacks.length > 0) {
      return;
    }
    const consoleMethodsToOverrideForStrictMode = ['group', 'groupCollapsed', 'info', 'log'];
    for (const method of consoleMethodsToOverrideForStrictMode) {
      const originalMethod = targetConsole[method];
      const overrideMethod = (...args) => {
        const settings = hook.settings;
        if (settings == null) {
          originalMethod(...args);
          return;
        }
        if (settings.hideConsoleLogsInStrictMode) {
          return;
        }
        if (settings.disableSecondConsoleLogDimmingInStrictMode) {
          originalMethod(...args);
        } else {
          if (false) {} else {
            originalMethod(react_devtools_shared_src_constants__WEBPACK_IMPORTED_MODULE_0__.ANSI_STYLE_DIMMING_TEMPLATE, ...(0,react_devtools_shared_src_backend_utils_formatConsoleArguments__WEBPACK_IMPORTED_MODULE_2__["default"])(...args));
          }
        }
      };
      targetConsole[method] = overrideMethod;
      unpatchConsoleCallbacks.push(() => {
        targetConsole[method] = originalMethod;
      });
    }
  }
  function unpatchConsoleForStrictMode() {
    unpatchConsoleCallbacks.forEach(callback => callback());
    unpatchConsoleCallbacks.length = 0;
  }
  function patchConsoleForErrorsAndWarnings() {
    if (!hook.settings) {
      return;
    }
    const consoleMethodsToOverrideForErrorsAndWarnings = ['error', 'trace', 'warn'];
    for (const method of consoleMethodsToOverrideForErrorsAndWarnings) {
      const originalMethod = targetConsole[method];
      const overrideMethod = (...args) => {
        const settings = hook.settings;
        if (settings == null) {
          originalMethod(...args);
          return;
        }
        if (isRunningDuringStrictModeInvocation && settings.hideConsoleLogsInStrictMode) {
          return;
        }
        let injectedComponentStackAsFakeError = false;
        let alreadyHasComponentStack = false;
        if (settings.appendComponentStack) {
          const lastArg = args.length > 0 ? args[args.length - 1] : null;
          alreadyHasComponentStack = typeof lastArg === 'string' && isStringComponentStack(lastArg);
        }
        const shouldShowInlineWarningsAndErrors = settings.showInlineWarningsAndErrors && (method === 'error' || method === 'warn');
        for (const rendererInterface of hook.rendererInterfaces.values()) {
          const {
            onErrorOrWarning,
            getComponentStack
          } = rendererInterface;
          try {
            if (shouldShowInlineWarningsAndErrors) {
              if (onErrorOrWarning != null) {
                onErrorOrWarning(method, args.slice());
              }
            }
          } catch (error) {
            setTimeout(() => {
              throw error;
            }, 0);
          }
          try {
            if (settings.appendComponentStack && getComponentStack != null) {
              const topFrame = Error('react-stack-top-frame');
              const match = getComponentStack(topFrame);
              if (match !== null) {
                const {
                  enableOwnerStacks,
                  componentStack
                } = match;
                if (componentStack !== '') {
                  const fakeError = new Error('');
                  if (true) {
                    fakeError.name = enableOwnerStacks ? 'Error Stack' : 'Error Component Stack';
                  } else {}
                  fakeError.stack =  true ? (enableOwnerStacks ? 'Error Stack:' : 'Error Component Stack:') + componentStack : 0;
                  if (alreadyHasComponentStack) {
                    if (areStackTracesEqual(args[args.length - 1], componentStack)) {
                      const firstArg = args[0];
                      if (args.length > 1 && typeof firstArg === 'string' && firstArg.endsWith('%s')) {
                        args[0] = firstArg.slice(0, firstArg.length - 2);
                      }
                      args[args.length - 1] = fakeError;
                      injectedComponentStackAsFakeError = true;
                    }
                  } else {
                    args.push(fakeError);
                    injectedComponentStackAsFakeError = true;
                  }
                }
                break;
              }
            }
          } catch (error) {
            setTimeout(() => {
              throw error;
            }, 0);
          }
        }
        if (settings.breakOnConsoleErrors) {
          debugger;
        }
        if (isRunningDuringStrictModeInvocation && !settings.disableSecondConsoleLogDimmingInStrictMode) {
          if (false) {} else {
            originalMethod(injectedComponentStackAsFakeError ? react_devtools_shared_src_constants__WEBPACK_IMPORTED_MODULE_0__.ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK : react_devtools_shared_src_constants__WEBPACK_IMPORTED_MODULE_0__.ANSI_STYLE_DIMMING_TEMPLATE, ...(0,react_devtools_shared_src_backend_utils_formatConsoleArguments__WEBPACK_IMPORTED_MODULE_2__["default"])(...args));
          }
        } else {
          originalMethod(...args);
        }
      };
      targetConsole[method] = overrideMethod;
    }
  }
  const fiberRoots = {};
  const rendererInterfaces = new Map();
  const listeners = {};
  const renderers = new Map();
  const backends = new Map();
  const hook = {
    rendererInterfaces,
    listeners,
    backends,
    renderers,
    hasUnsupportedRendererAttached: false,
    emit,
    getFiberRoots,
    inject,
    on,
    off,
    sub,
    supportsFiber: true,
    supportsFlight: true,
    checkDCE,
    onCommitFiberUnmount,
    onCommitFiberRoot,
    onPostCommitFiberRoot,
    setStrictMode
  };
  if (maybeSettingsOrSettingsPromise == null) {
    hook.settings = {
      appendComponentStack: true,
      breakOnConsoleErrors: false,
      showInlineWarningsAndErrors: true,
      hideConsoleLogsInStrictMode: false,
      disableSecondConsoleLogDimmingInStrictMode: false
    };
    patchConsoleForErrorsAndWarnings();
  } else {
    Promise.resolve(maybeSettingsOrSettingsPromise).then(settings => {
      hook.settings = settings;
      hook.emit('settingsInitialized', settings);
      patchConsoleForErrorsAndWarnings();
    }).catch(() => {
      targetConsole.error("React DevTools failed to get Console Patching settings. Console won't be patched and some console features will not work.");
    });
  }
  Object.defineProperty(target, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    configurable: true,
    enumerable: false,
    get() {
      return hook;
    }
  });
  return hook;
}

/***/ }),

/***/ "../react-devtools-shared/src/hydration.js":
/*!*************************************************!*\
  !*** ../react-devtools-shared/src/hydration.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "dehydrate": () => (/* binding */ dehydrate),
/* harmony export */   "fillInPath": () => (/* binding */ fillInPath),
/* harmony export */   "hydrate": () => (/* binding */ hydrate),
/* harmony export */   "meta": () => (/* binding */ meta)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/utils */ "../react-devtools-shared/src/utils.js");
/* harmony import */ var shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! shared/ReactSymbols */ "../shared/ReactSymbols.js");
/* harmony import */ var shared_noop__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! shared/noop */ "../shared/noop.js");



const meta = {
  inspectable: Symbol('inspectable'),
  inspected: Symbol('inspected'),
  name: Symbol('name'),
  preview_long: Symbol('preview_long'),
  preview_short: Symbol('preview_short'),
  readonly: Symbol('readonly'),
  size: Symbol('size'),
  type: Symbol('type'),
  unserializable: Symbol('unserializable')
};
const LEVEL_THRESHOLD = 2;
function createDehydrated(type, inspectable, data, cleaned, path) {
  cleaned.push(path);
  const dehydrated = {
    inspectable,
    type,
    preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
    preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
    name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
  };
  if (type === 'array' || type === 'typed_array') {
    dehydrated.size = data.length;
  } else if (type === 'object') {
    dehydrated.size = Object.keys(data).length;
  }
  if (type === 'iterator' || type === 'typed_array') {
    dehydrated.readonly = true;
  }
  return dehydrated;
}
function dehydrate(data, cleaned, unserializable, path, isPathAllowed, level = 0) {
  const type = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getDataType)(data);
  let isPathAllowedCheck;
  switch (type) {
    case 'html_element':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.tagName,
        type
      };
    case 'function':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: typeof data.name === 'function' || !data.name ? 'function' : data.name,
        type
      };
    case 'string':
      isPathAllowedCheck = isPathAllowed(path);
      if (isPathAllowedCheck) {
        return data;
      } else {
        return data.length <= 500 ? data : data.slice(0, 500) + '...';
      }
    case 'bigint':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'symbol':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'react_element':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          cleaned.push(path);
          return {
            inspectable: true,
            preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
            preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
            name: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getDisplayNameForReactElement)(data) || 'Unknown',
            type
          };
        }
        const unserializableValue = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getDisplayNameForReactElement)(data) || 'Unknown'
        };
        unserializableValue.key = dehydrate(data.key, cleaned, unserializable, path.concat(['key']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        if (data.$$typeof === shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LEGACY_ELEMENT_TYPE) {
          unserializableValue.ref = dehydrate(data.ref, cleaned, unserializable, path.concat(['ref']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        }
        unserializableValue.props = dehydrate(data.props, cleaned, unserializable, path.concat(['props']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        unserializable.push(path);
        return unserializableValue;
      }
    case 'react_lazy':
      {
        isPathAllowedCheck = isPathAllowed(path);
        const payload = data._payload;
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          cleaned.push(path);
          const inspectable = payload !== null && typeof payload === 'object' && (payload._status === 1 || payload._status === 2 || payload.status === 'fulfilled' || payload.status === 'rejected');
          return {
            inspectable,
            preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
            preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
            name: 'lazy()',
            type
          };
        }
        const unserializableValue = {
          unserializable: true,
          type: type,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: 'lazy()'
        };
        unserializableValue._payload = dehydrate(payload, cleaned, unserializable, path.concat(['_payload']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        unserializable.push(path);
        return unserializableValue;
      }
    case 'array_buffer':
    case 'data_view':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: type === 'data_view' ? 'DataView' : 'ArrayBuffer',
        size: data.byteLength,
        type
      };
    case 'array':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      }
      const arr = [];
      for (let i = 0; i < data.length; i++) {
        arr[i] = dehydrateKey(data, i, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
      }
      return arr;
    case 'html_all_collection':
    case 'typed_array':
    case 'iterator':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const unserializableValue = {
          unserializable: true,
          type: type,
          readonly: true,
          size: type === 'typed_array' ? data.length : undefined,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
        };
        Array.from(data).forEach((item, i) => unserializableValue[i] = dehydrate(item, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1));
        unserializable.push(path);
        return unserializableValue;
      }
    case 'opaque_iterator':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data[Symbol.toStringTag],
        type
      };
    case 'date':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'regexp':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'thenable':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        cleaned.push(path);
        return {
          inspectable: data.status === 'fulfilled' || data.status === 'rejected',
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: data.toString(),
          type
        };
      }
      if (data.status === 'resolved_model' || data.status === 'resolve_module') {
        data.then(shared_noop__WEBPACK_IMPORTED_MODULE_2__["default"]);
      }
      switch (data.status) {
        case 'fulfilled':
          {
            const unserializableValue = {
              unserializable: true,
              type: type,
              preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
              preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
              name: 'fulfilled Thenable'
            };
            unserializableValue.value = dehydrate(data.value, cleaned, unserializable, path.concat(['value']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
            unserializable.push(path);
            return unserializableValue;
          }
        case 'rejected':
          {
            const unserializableValue = {
              unserializable: true,
              type: type,
              preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
              preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
              name: 'rejected Thenable'
            };
            unserializableValue.reason = dehydrate(data.reason, cleaned, unserializable, path.concat(['reason']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
            unserializable.push(path);
            return unserializableValue;
          }
        default:
          cleaned.push(path);
          return {
            inspectable: false,
            preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
            preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
            name: data.toString(),
            type
          };
      }
    case 'object':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const object = {};
        (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getAllEnumerableKeys)(data).forEach(key => {
          const name = key.toString();
          object[name] = dehydrateKey(data, key, cleaned, unserializable, path.concat([name]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        return object;
      }
    case 'class_instance':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          return createDehydrated(type, true, data, cleaned, path);
        }
        const value = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' ? '' : data.constructor.name
        };
        (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getAllEnumerableKeys)(data).forEach(key => {
          const keyAsString = key.toString();
          value[keyAsString] = dehydrate(data[key], cleaned, unserializable, path.concat([keyAsString]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        unserializable.push(path);
        return value;
      }
    case 'error':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          return createDehydrated(type, true, data, cleaned, path);
        }
        const value = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: data.name
        };
        value.message = dehydrate(data.message, cleaned, unserializable, path.concat(['message']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        value.stack = dehydrate(data.stack, cleaned, unserializable, path.concat(['stack']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        if ('cause' in data) {
          value.cause = dehydrate(data.cause, cleaned, unserializable, path.concat(['cause']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        }
        (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getAllEnumerableKeys)(data).forEach(key => {
          const keyAsString = key.toString();
          value[keyAsString] = dehydrate(data[key], cleaned, unserializable, path.concat([keyAsString]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        unserializable.push(path);
        return value;
      }
    case 'infinity':
    case '-infinity':
    case 'nan':
    case 'undefined':
      cleaned.push(path);
      return {
        type
      };
    default:
      return data;
  }
}
function dehydrateKey(parent, key, cleaned, unserializable, path, isPathAllowed, level = 0) {
  try {
    return dehydrate(parent[key], cleaned, unserializable, path, isPathAllowed, level);
  } catch (error) {
    let preview = '';
    if (typeof error === 'object' && error !== null && typeof error.stack === 'string') {
      preview = error.stack;
    } else if (typeof error === 'string') {
      preview = error;
    }
    cleaned.push(path);
    return {
      inspectable: false,
      preview_short: '[Exception]',
      preview_long: preview ? '[Exception: ' + preview + ']' : '[Exception]',
      name: preview,
      type: 'unknown'
    };
  }
}
function fillInPath(object, data, path, value) {
  const target = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getInObject)(object, path);
  if (target != null) {
    if (!target[meta.unserializable]) {
      delete target[meta.inspectable];
      delete target[meta.inspected];
      delete target[meta.name];
      delete target[meta.preview_long];
      delete target[meta.preview_short];
      delete target[meta.readonly];
      delete target[meta.size];
      delete target[meta.type];
    }
  }
  if (value !== null && data.unserializable.length > 0) {
    const unserializablePath = data.unserializable[0];
    let isMatch = unserializablePath.length === path.length;
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== unserializablePath[i]) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      upgradeUnserializable(value, value);
    }
  }
  (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.setInObject)(object, path, value);
}
function hydrate(object, cleaned, unserializable) {
  cleaned.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getInObject)(object, path.slice(0, length - 1));
    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }
    const value = parent[last];
    if (!value) {
      return;
    } else if (value.type === 'infinity') {
      parent[last] = Infinity;
    } else if (value.type === '-infinity') {
      parent[last] = -Infinity;
    } else if (value.type === 'nan') {
      parent[last] = NaN;
    } else if (value.type === 'undefined') {
      parent[last] = undefined;
    } else {
      const replaced = {};
      replaced[meta.inspectable] = !!value.inspectable;
      replaced[meta.inspected] = false;
      replaced[meta.name] = value.name;
      replaced[meta.preview_long] = value.preview_long;
      replaced[meta.preview_short] = value.preview_short;
      replaced[meta.size] = value.size;
      replaced[meta.readonly] = !!value.readonly;
      replaced[meta.type] = value.type;
      parent[last] = replaced;
    }
  });
  unserializable.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getInObject)(object, path.slice(0, length - 1));
    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }
    const node = parent[last];
    const replacement = {
      ...node
    };
    upgradeUnserializable(replacement, node);
    parent[last] = replacement;
  });
  return object;
}
function upgradeUnserializable(destination, source) {
  Object.defineProperties(destination, {
    [meta.inspected]: {
      configurable: true,
      enumerable: false,
      value: !!source.inspected
    },
    [meta.name]: {
      configurable: true,
      enumerable: false,
      value: source.name
    },
    [meta.preview_long]: {
      configurable: true,
      enumerable: false,
      value: source.preview_long
    },
    [meta.preview_short]: {
      configurable: true,
      enumerable: false,
      value: source.preview_short
    },
    [meta.size]: {
      configurable: true,
      enumerable: false,
      value: source.size
    },
    [meta.readonly]: {
      configurable: true,
      enumerable: false,
      value: !!source.readonly
    },
    [meta.type]: {
      configurable: true,
      enumerable: false,
      value: source.type
    },
    [meta.unserializable]: {
      configurable: true,
      enumerable: false,
      value: !!source.unserializable
    }
  });
  delete destination.inspected;
  delete destination.name;
  delete destination.preview_long;
  delete destination.preview_short;
  delete destination.size;
  delete destination.readonly;
  delete destination.type;
  delete destination.unserializable;
}

/***/ }),

/***/ "../react-devtools-shared/src/isArray.js":
/*!***********************************************!*\
  !*** ../react-devtools-shared/src/isArray.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const isArray = Array.isArray;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (isArray);

/***/ }),

/***/ "../react-devtools-shared/src/storage.js":
/*!***********************************************!*\
  !*** ../react-devtools-shared/src/storage.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "localStorageGetItem": () => (/* binding */ localStorageGetItem),
/* harmony export */   "localStorageRemoveItem": () => (/* binding */ localStorageRemoveItem),
/* harmony export */   "localStorageSetItem": () => (/* binding */ localStorageSetItem),
/* harmony export */   "sessionStorageGetItem": () => (/* binding */ sessionStorageGetItem),
/* harmony export */   "sessionStorageRemoveItem": () => (/* binding */ sessionStorageRemoveItem),
/* harmony export */   "sessionStorageSetItem": () => (/* binding */ sessionStorageSetItem)
/* harmony export */ });
function localStorageGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}
function localStorageRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {}
}
function localStorageSetItem(key, value) {
  try {
    return localStorage.setItem(key, value);
  } catch (error) {}
}
function sessionStorageGetItem(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}
function sessionStorageRemoveItem(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {}
}
function sessionStorageSetItem(key, value) {
  try {
    return sessionStorage.setItem(key, value);
  } catch (error) {}
}

/***/ }),

/***/ "../react-devtools-shared/src/utils.js":
/*!*********************************************!*\
  !*** ../react-devtools-shared/src/utils.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "alphaSortKeys": () => (/* binding */ alphaSortKeys),
/* harmony export */   "backendToFrontendSerializedElementMapper": () => (/* binding */ backendToFrontendSerializedElementMapper),
/* harmony export */   "deletePathInObject": () => (/* binding */ deletePathInObject),
/* harmony export */   "formatDataForPreview": () => (/* binding */ formatDataForPreview),
/* harmony export */   "getAllEnumerableKeys": () => (/* binding */ getAllEnumerableKeys),
/* harmony export */   "getAlwaysOpenInEditor": () => (/* binding */ getAlwaysOpenInEditor),
/* harmony export */   "getDataType": () => (/* binding */ getDataType),
/* harmony export */   "getDefaultComponentFilters": () => (/* binding */ getDefaultComponentFilters),
/* harmony export */   "getDefaultOpenInEditorURL": () => (/* binding */ getDefaultOpenInEditorURL),
/* harmony export */   "getDefaultPreset": () => (/* binding */ getDefaultPreset),
/* harmony export */   "getDisplayName": () => (/* binding */ getDisplayName),
/* harmony export */   "getDisplayNameForReactElement": () => (/* binding */ getDisplayNameForReactElement),
/* harmony export */   "getIfReloadedAndProfiling": () => (/* binding */ getIfReloadedAndProfiling),
/* harmony export */   "getInObject": () => (/* binding */ getInObject),
/* harmony export */   "getIsReloadAndProfileSupported": () => (/* binding */ getIsReloadAndProfileSupported),
/* harmony export */   "getOpenInEditorURL": () => (/* binding */ getOpenInEditorURL),
/* harmony export */   "getProfilingSettings": () => (/* binding */ getProfilingSettings),
/* harmony export */   "getSavedComponentFilters": () => (/* binding */ getSavedComponentFilters),
/* harmony export */   "getUID": () => (/* binding */ getUID),
/* harmony export */   "getWrappedDisplayName": () => (/* binding */ getWrappedDisplayName),
/* harmony export */   "isPlainObject": () => (/* binding */ isPlainObject),
/* harmony export */   "normalizeUrlIfValid": () => (/* binding */ normalizeUrlIfValid),
/* harmony export */   "onReloadAndProfile": () => (/* binding */ onReloadAndProfile),
/* harmony export */   "onReloadAndProfileFlagsReset": () => (/* binding */ onReloadAndProfileFlagsReset),
/* harmony export */   "parseElementDisplayNameFromBackend": () => (/* binding */ parseElementDisplayNameFromBackend),
/* harmony export */   "persistableComponentFilters": () => (/* binding */ persistableComponentFilters),
/* harmony export */   "printOperationsArray": () => (/* binding */ printOperationsArray),
/* harmony export */   "renamePathInObject": () => (/* binding */ renamePathInObject),
/* harmony export */   "setInObject": () => (/* binding */ setInObject),
/* harmony export */   "setSavedComponentFilters": () => (/* binding */ setSavedComponentFilters),
/* harmony export */   "shallowDiffers": () => (/* binding */ shallowDiffers),
/* harmony export */   "unionOfTwoArrays": () => (/* binding */ unionOfTwoArrays),
/* harmony export */   "utfDecodeStringWithRanges": () => (/* binding */ utfDecodeStringWithRanges),
/* harmony export */   "utfEncodeString": () => (/* binding */ utfEncodeString)
/* harmony export */ });
/* harmony import */ var lru_cache__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lru-cache */ "../../node_modules/lru-cache/index.js");
/* harmony import */ var lru_cache__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lru_cache__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! shared/ReactSymbols */ "../shared/ReactSymbols.js");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./constants */ "../react-devtools-shared/src/constants.js");
/* harmony import */ var _frontend_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-devtools-shared/src/frontend/types */ "../react-devtools-shared/src/frontend/types.js");
/* harmony import */ var react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-devtools-shared/src/storage */ "../react-devtools-shared/src/storage.js");
/* harmony import */ var _hydration__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./hydration */ "../react-devtools-shared/src/hydration.js");
/* harmony import */ var _isArray__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./isArray */ "../react-devtools-shared/src/isArray.js");
/* harmony import */ var _backend_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");









const hasOwnProperty = Object.prototype.hasOwnProperty;
const cachedDisplayNames = new WeakMap();
const encodedStringCache = new (lru_cache__WEBPACK_IMPORTED_MODULE_0___default())({
  max: 1000
});
const LEGACY_REACT_PROVIDER_TYPE = Symbol.for('react.provider');
function alphaSortKeys(a, b) {
  if (a.toString() > b.toString()) {
    return 1;
  } else if (b.toString() > a.toString()) {
    return -1;
  } else {
    return 0;
  }
}
function getAllEnumerableKeys(obj) {
  const keys = new Set();
  let current = obj;
  while (current != null) {
    const currentKeys = [...Object.keys(current), ...Object.getOwnPropertySymbols(current)];
    const descriptors = Object.getOwnPropertyDescriptors(current);
    currentKeys.forEach(key => {
      if (descriptors[key].enumerable) {
        keys.add(key);
      }
    });
    current = Object.getPrototypeOf(current);
  }
  return keys;
}
function getWrappedDisplayName(outerType, innerType, wrapperName, fallbackName) {
  const displayName = outerType?.displayName;
  return displayName || `${wrapperName}(${getDisplayName(innerType, fallbackName)})`;
}
function getDisplayName(type, fallbackName = 'Anonymous') {
  const nameFromCache = cachedDisplayNames.get(type);
  if (nameFromCache != null) {
    return nameFromCache;
  }
  let displayName = fallbackName;
  if (typeof type.displayName === 'string') {
    displayName = type.displayName;
  } else if (typeof type.name === 'string' && type.name !== '') {
    displayName = type.name;
  }
  cachedDisplayNames.set(type, displayName);
  return displayName;
}
let uidCounter = 0;
function getUID() {
  return ++uidCounter;
}
function utfDecodeStringWithRanges(array, left, right) {
  let string = '';
  for (let i = left; i <= right; i++) {
    string += String.fromCodePoint(array[i]);
  }
  return string;
}
function surrogatePairToCodePoint(charCode1, charCode2) {
  return ((charCode1 & 0x3ff) << 10) + (charCode2 & 0x3ff) + 0x10000;
}
function utfEncodeString(string) {
  const cached = encodedStringCache.get(string);
  if (cached !== undefined) {
    return cached;
  }
  const encoded = [];
  let i = 0;
  let charCode;
  while (i < string.length) {
    charCode = string.charCodeAt(i);
    if ((charCode & 0xf800) === 0xd800) {
      encoded.push(surrogatePairToCodePoint(charCode, string.charCodeAt(++i)));
    } else {
      encoded.push(charCode);
    }
    ++i;
  }
  encodedStringCache.set(string, encoded);
  return encoded;
}
function printOperationsArray(operations) {
  const rendererID = operations[0];
  const rootID = operations[1];
  const logs = [`operations for renderer:${rendererID} and root:${rootID}`];
  let i = 2;
  const stringTable = [null];
  const stringTableSize = operations[i++];
  const stringTableEnd = i + stringTableSize;
  while (i < stringTableEnd) {
    const nextLength = operations[i++];
    const nextString = utfDecodeStringWithRanges(operations, i, i + nextLength - 1);
    stringTable.push(nextString);
    i += nextLength;
  }
  while (i < operations.length) {
    const operation = operations[i];
    switch (operation) {
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_ADD:
        {
          const id = operations[i + 1];
          const type = operations[i + 2];
          i += 3;
          if (type === _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeRoot) {
            logs.push(`Add new root node ${id}`);
            i++;
            i++;
            i++;
            i++;
          } else {
            const parentID = operations[i];
            i++;
            i++;
            const displayNameStringID = operations[i];
            const displayName = stringTable[displayNameStringID];
            i++;
            i++;
            i++;
            logs.push(`Add node ${id} (${displayName || 'null'}) as child of ${parentID}`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;
          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            const id = operations[i];
            i += 1;
            logs.push(`Remove node ${id}`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_SET_SUBTREE_MODE:
        {
          const id = operations[i + 1];
          const mode = operations[i + 2];
          i += 3;
          logs.push(`Mode ${mode} set for subtree with root ${id}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_REORDER_CHILDREN:
        {
          const id = operations[i + 1];
          const numChildren = operations[i + 2];
          i += 3;
          const children = operations.slice(i, i + numChildren);
          i += numChildren;
          logs.push(`Re-order node ${id} children ${children.join(',')}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
        i += 3;
        break;
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
        {
          const id = operations[i + 1];
          const numErrors = operations[i + 2];
          const numWarnings = operations[i + 3];
          i += 4;
          logs.push(`Node ${id} has ${numErrors} errors and ${numWarnings} warnings`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_ADD:
        {
          const fiberID = operations[i + 1];
          const parentID = operations[i + 2];
          const nameStringID = operations[i + 3];
          const isSuspended = operations[i + 4];
          const numRects = operations[i + 5];
          i += 6;
          const name = stringTable[nameStringID];
          let rects;
          if (numRects === -1) {
            rects = 'null';
          } else {
            rects = '[';
            for (let rectIndex = 0; rectIndex < numRects; rectIndex++) {
              const offset = i + rectIndex * 4;
              const x = operations[offset + 0];
              const y = operations[offset + 1];
              const width = operations[offset + 2];
              const height = operations[offset + 3];
              if (rectIndex > 0) {
                rects += ', ';
              }
              rects += `(${x}, ${y}, ${width}, ${height})`;
              i += 4;
            }
            rects += ']';
          }
          logs.push(`Add suspense node ${fiberID} (${String(name)},rects={${rects}}) under ${parentID} suspended ${isSuspended}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;
          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            const id = operations[i];
            i += 1;
            logs.push(`Remove suspense node ${id}`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_REORDER_CHILDREN:
        {
          const id = operations[i + 1];
          const numChildren = operations[i + 2];
          i += 3;
          const children = operations.slice(i, i + numChildren);
          i += numChildren;
          logs.push(`Re-order suspense node ${id} children ${children.join(',')}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_RESIZE:
        {
          const id = operations[i + 1];
          const numRects = operations[i + 2];
          i += 3;
          if (numRects === -1) {
            logs.push(`Resize suspense node ${id} to null`);
          } else {
            let line = `Resize suspense node ${id} to [`;
            for (let rectIndex = 0; rectIndex < numRects; rectIndex++) {
              const x = operations[i + 0];
              const y = operations[i + 1];
              const width = operations[i + 2];
              const height = operations[i + 3];
              if (rectIndex > 0) {
                line += ', ';
              }
              line += `(${x}, ${y}, ${width}, ${height})`;
              i += 4;
            }
            logs.push(line + ']');
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_SUSPENDERS:
        {
          i++;
          const changeLength = operations[i++];
          for (let changeIndex = 0; changeIndex < changeLength; changeIndex++) {
            const id = operations[i++];
            const hasUniqueSuspenders = operations[i++] === 1;
            const endTime = operations[i++] / 1000;
            const isSuspended = operations[i++] === 1;
            const environmentNamesLength = operations[i++];
            i += environmentNamesLength;
            logs.push(`Suspense node ${id} unique suspenders set to ${String(hasUniqueSuspenders)} ending at ${String(endTime)} is suspended set to ${String(isSuspended)} with ${String(environmentNamesLength)} environments`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE:
        {
          i++;
          const activitySliceIDChange = operations[i++];
          logs.push(activitySliceIDChange === 0 ? 'Reset applied activity slice' : 'Applied activity slice change to ' + activitySliceIDChange);
          break;
        }
      default:
        throw Error(`Unsupported Bridge operation "${operation}"`);
    }
  }
  console.log(logs.join('\n  '));
}
function getDefaultComponentFilters() {
  return [{
    type: _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ComponentFilterElementType,
    value: _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeHostComponent,
    isEnabled: true
  }];
}
function getSavedComponentFilters() {
  try {
    const raw = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY);
    if (raw != null) {
      const parsedFilters = JSON.parse(raw);
      return persistableComponentFilters(parsedFilters);
    }
  } catch (error) {}
  return getDefaultComponentFilters();
}
function setSavedComponentFilters(componentFilters) {
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageSetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY, JSON.stringify(persistableComponentFilters(componentFilters)));
}
function persistableComponentFilters(componentFilters) {
  if (!Array.isArray(componentFilters)) {
    return componentFilters;
  }
  return componentFilters.filter(f => {
    return f.type !== _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ComponentFilterLocation && f.type !== _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ComponentFilterActivitySlice;
  });
}
const vscodeFilepath = 'vscode://file/{path}:{line}:{column}';
function getDefaultPreset() {
  return  false ? 0 : 'vscode';
}
function getDefaultOpenInEditorURL() {
  return  false ? 0 : vscodeFilepath;
}
function getOpenInEditorURL() {
  try {
    const rawPreset = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET);
    switch (rawPreset) {
      case '"vscode"':
        return vscodeFilepath;
    }
    const raw = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_OPEN_IN_EDITOR_URL);
    if (raw != null) {
      return JSON.parse(raw);
    }
  } catch (error) {}
  return getDefaultOpenInEditorURL();
}
function getAlwaysOpenInEditor() {
  try {
    const raw = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR);
    return raw === 'true';
  } catch (error) {}
  return false;
}
function parseElementDisplayNameFromBackend(displayName, type) {
  if (displayName === null) {
    return {
      formattedDisplayName: null,
      hocDisplayNames: null,
      compiledWithForget: false
    };
  }
  if (displayName.startsWith('Forget(')) {
    const displayNameWithoutForgetWrapper = displayName.slice(7, displayName.length - 1);
    const {
      formattedDisplayName,
      hocDisplayNames
    } = parseElementDisplayNameFromBackend(displayNameWithoutForgetWrapper, type);
    return {
      formattedDisplayName,
      hocDisplayNames,
      compiledWithForget: true
    };
  }
  let hocDisplayNames = null;
  switch (type) {
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeClass:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeForwardRef:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeFunction:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeMemo:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeVirtual:
      if (displayName.indexOf('(') >= 0) {
        const matches = displayName.match(/[^()]+/g);
        if (matches != null) {
          displayName = matches.pop();
          hocDisplayNames = matches;
        }
      }
      break;
    default:
      break;
  }
  return {
    formattedDisplayName: displayName,
    hocDisplayNames,
    compiledWithForget: false
  };
}
function shallowDiffers(prev, next) {
  for (const attribute in prev) {
    if (!(attribute in next)) {
      return true;
    }
  }
  for (const attribute in next) {
    if (prev[attribute] !== next[attribute]) {
      return true;
    }
  }
  return false;
}
function getInObject(object, path) {
  return path.reduce((reduced, attr) => {
    if (reduced) {
      if (hasOwnProperty.call(reduced, attr)) {
        return reduced[attr];
      }
      if (typeof reduced[Symbol.iterator] === 'function') {
        return Array.from(reduced)[attr];
      }
    }
    return null;
  }, object);
}
function deletePathInObject(object, path) {
  const length = path.length;
  const last = path[length - 1];
  if (object != null) {
    const parent = getInObject(object, path.slice(0, length - 1));
    if (parent) {
      if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(parent)) {
        parent.splice(last, 1);
      } else {
        delete parent[last];
      }
    }
  }
}
function renamePathInObject(object, oldPath, newPath) {
  const length = oldPath.length;
  if (object != null) {
    const parent = getInObject(object, oldPath.slice(0, length - 1));
    if (parent) {
      const lastOld = oldPath[length - 1];
      const lastNew = newPath[length - 1];
      parent[lastNew] = parent[lastOld];
      if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(parent)) {
        parent.splice(lastOld, 1);
      } else {
        delete parent[lastOld];
      }
    }
  }
}
function setInObject(object, path, value) {
  const length = path.length;
  const last = path[length - 1];
  if (object != null) {
    const parent = getInObject(object, path.slice(0, length - 1));
    if (parent) {
      parent[last] = value;
    }
  }
}
function isError(data) {
  if ('name' in data && 'message' in data) {
    while (data) {
      if (Object.prototype.toString.call(data) === '[object Error]') {
        return true;
      }
      data = Object.getPrototypeOf(data);
    }
  }
  return false;
}
function getDataType(data) {
  if (data === null) {
    return 'null';
  } else if (data === undefined) {
    return 'undefined';
  }
  if (typeof HTMLElement !== 'undefined' && data instanceof HTMLElement) {
    return 'html_element';
  }
  const type = typeof data;
  switch (type) {
    case 'bigint':
      return 'bigint';
    case 'boolean':
      return 'boolean';
    case 'function':
      return 'function';
    case 'number':
      if (Number.isNaN(data)) {
        return 'nan';
      } else if (!Number.isFinite(data)) {
        return data > 0 ? 'infinity' : '-infinity';
      } else {
        return 'number';
      }
    case 'object':
      switch (data.$$typeof) {
        case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_ELEMENT_TYPE:
        case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LEGACY_ELEMENT_TYPE:
          return 'react_element';
        case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LAZY_TYPE:
          return 'react_lazy';
      }
      if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(data)) {
        return 'array';
      } else if (ArrayBuffer.isView(data)) {
        return hasOwnProperty.call(data.constructor, 'BYTES_PER_ELEMENT') ? 'typed_array' : 'data_view';
      } else if (data.constructor && data.constructor.name === 'ArrayBuffer') {
        return 'array_buffer';
      } else if (typeof data[Symbol.iterator] === 'function') {
        const iterator = data[Symbol.iterator]();
        if (!iterator) {} else {
          return iterator === data ? 'opaque_iterator' : 'iterator';
        }
      } else if (data.constructor && data.constructor.name === 'RegExp') {
        return 'regexp';
      } else if (typeof data.then === 'function') {
        return 'thenable';
      } else if (isError(data)) {
        return 'error';
      } else {
        const toStringValue = Object.prototype.toString.call(data);
        if (toStringValue === '[object Date]') {
          return 'date';
        } else if (toStringValue === '[object HTMLAllCollection]') {
          return 'html_all_collection';
        }
      }
      if (!isPlainObject(data)) {
        return 'class_instance';
      }
      return 'object';
    case 'string':
      return 'string';
    case 'symbol':
      return 'symbol';
    case 'undefined':
      if (Object.prototype.toString.call(data) === '[object HTMLAllCollection]') {
        return 'html_all_collection';
      }
      return 'undefined';
    default:
      return 'unknown';
  }
}
function typeOfWithLegacyElementSymbol(object) {
  if (typeof object === 'object' && object !== null) {
    const $$typeof = object.$$typeof;
    switch ($$typeof) {
      case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_ELEMENT_TYPE:
      case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LEGACY_ELEMENT_TYPE:
        const type = object.type;
        switch (type) {
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FRAGMENT_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PROFILER_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_STRICT_MODE_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_LIST_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_VIEW_TRANSITION_TYPE:
            return type;
          default:
            const $$typeofType = type && type.$$typeof;
            switch ($$typeofType) {
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONTEXT_TYPE:
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FORWARD_REF_TYPE:
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LAZY_TYPE:
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_MEMO_TYPE:
                return $$typeofType;
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONSUMER_TYPE:
                return $$typeofType;
              default:
                return $$typeof;
            }
        }
      case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }
  return undefined;
}
function getDisplayNameForReactElement(element) {
  const elementType = typeOfWithLegacyElementSymbol(element);
  switch (elementType) {
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONSUMER_TYPE:
      return 'ContextConsumer';
    case LEGACY_REACT_PROVIDER_TYPE:
      return 'ContextProvider';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONTEXT_TYPE:
      return 'Context';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FORWARD_REF_TYPE:
      return 'ForwardRef';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FRAGMENT_TYPE:
      return 'Fragment';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LAZY_TYPE:
      return 'Lazy';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_MEMO_TYPE:
      return 'Memo';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PORTAL_TYPE:
      return 'Portal';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PROFILER_TYPE:
      return 'Profiler';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_STRICT_MODE_TYPE:
      return 'StrictMode';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_TYPE:
      return 'Suspense';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_VIEW_TRANSITION_TYPE:
      return 'ViewTransition';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_TRACING_MARKER_TYPE:
      return 'TracingMarker';
    default:
      const {
        type
      } = element;
      if (typeof type === 'string') {
        return type;
      } else if (typeof type === 'function') {
        return getDisplayName(type, 'Anonymous');
      } else if (type != null) {
        return 'NotImplementedInDevtools';
      } else {
        return 'Element';
      }
  }
}
const MAX_PREVIEW_STRING_LENGTH = 50;
function truncateForDisplay(string, length = MAX_PREVIEW_STRING_LENGTH) {
  if (string.length > length) {
    return string.slice(0, length) + '…';
  } else {
    return string;
  }
}
function formatDataForPreview(data, showFormattedValue) {
  if (data != null && hasOwnProperty.call(data, _hydration__WEBPACK_IMPORTED_MODULE_5__.meta.type)) {
    return showFormattedValue ? data[_hydration__WEBPACK_IMPORTED_MODULE_5__.meta.preview_long] : data[_hydration__WEBPACK_IMPORTED_MODULE_5__.meta.preview_short];
  }
  const type = getDataType(data);
  switch (type) {
    case 'html_element':
      return `<${truncateForDisplay(data.tagName.toLowerCase())} />`;
    case 'function':
      if (typeof data.name === 'function' || data.name === '') {
        return '() => {}';
      }
      return `${truncateForDisplay(data.name)}() {}`;
    case 'string':
      return `"${data}"`;
    case 'bigint':
      return truncateForDisplay(data.toString() + 'n');
    case 'regexp':
      return truncateForDisplay(data.toString());
    case 'symbol':
      return truncateForDisplay(data.toString());
    case 'react_element':
      return `<${truncateForDisplay(getDisplayNameForReactElement(data) || 'Unknown')} />`;
    case 'react_lazy':
      const payload = data._payload;
      if (payload !== null && typeof payload === 'object') {
        if (payload._status === 0) {
          return `pending lazy()`;
        }
        if (payload._status === 1 && payload._result != null) {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload._result.default, false);
            return `fulfilled lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled lazy() {…}`;
          }
        }
        if (payload._status === 2) {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload._result, false);
            return `rejected lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected lazy() {…}`;
          }
        }
        if (payload.status === 'pending' || payload.status === 'blocked') {
          return `pending lazy()`;
        }
        if (payload.status === 'fulfilled') {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload.value, false);
            return `fulfilled lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled lazy() {…}`;
          }
        }
        if (payload.status === 'rejected') {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload.reason, false);
            return `rejected lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected lazy() {…}`;
          }
        }
      }
      return 'lazy()';
    case 'array_buffer':
      return `ArrayBuffer(${data.byteLength})`;
    case 'data_view':
      return `DataView(${data.buffer.byteLength})`;
    case 'array':
      if (showFormattedValue) {
        let formatted = '';
        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }
          formatted += formatDataForPreview(data[i], false);
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `[${truncateForDisplay(formatted)}]`;
      } else {
        const length = hasOwnProperty.call(data, _hydration__WEBPACK_IMPORTED_MODULE_5__.meta.size) ? data[_hydration__WEBPACK_IMPORTED_MODULE_5__.meta.size] : data.length;
        return `Array(${length})`;
      }
    case 'typed_array':
      const shortName = `${data.constructor.name}(${data.length})`;
      if (showFormattedValue) {
        let formatted = '';
        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }
          formatted += data[i];
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `${shortName} [${truncateForDisplay(formatted)}]`;
      } else {
        return shortName;
      }
    case 'iterator':
      const name = data.constructor.name;
      if (showFormattedValue) {
        const array = Array.from(data);
        let formatted = '';
        for (let i = 0; i < array.length; i++) {
          const entryOrEntries = array[i];
          if (i > 0) {
            formatted += ', ';
          }
          if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(entryOrEntries)) {
            const key = formatDataForPreview(entryOrEntries[0], true);
            const value = formatDataForPreview(entryOrEntries[1], false);
            formatted += `${key} => ${value}`;
          } else {
            formatted += formatDataForPreview(entryOrEntries, false);
          }
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `${name}(${data.size}) {${truncateForDisplay(formatted)}}`;
      } else {
        return `${name}(${data.size})`;
      }
    case 'opaque_iterator':
      {
        return data[Symbol.toStringTag];
      }
    case 'date':
      return data.toString();
    case 'class_instance':
      try {
        let resolvedConstructorName = data.constructor.name;
        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }
        resolvedConstructorName = Object.getPrototypeOf(data).constructor.name;
        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }
        try {
          return truncateForDisplay(String(data));
        } catch (error) {
          return 'unserializable';
        }
      } catch (error) {
        return 'unserializable';
      }
    case 'thenable':
      let displayName;
      if (isPlainObject(data)) {
        displayName = 'Thenable';
      } else {
        let resolvedConstructorName = data.constructor.name;
        if (typeof resolvedConstructorName !== 'string') {
          resolvedConstructorName = Object.getPrototypeOf(data).constructor.name;
        }
        if (typeof resolvedConstructorName === 'string') {
          displayName = resolvedConstructorName;
        } else {
          displayName = 'Thenable';
        }
      }
      switch (data.status) {
        case 'pending':
          return `pending ${displayName}`;
        case 'fulfilled':
          if (showFormattedValue) {
            const formatted = formatDataForPreview(data.value, false);
            return `fulfilled ${displayName} {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled ${displayName} {…}`;
          }
        case 'rejected':
          if (showFormattedValue) {
            const formatted = formatDataForPreview(data.reason, false);
            return `rejected ${displayName} {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected ${displayName} {…}`;
          }
        default:
          return displayName;
      }
    case 'object':
      if (showFormattedValue) {
        const keys = Array.from(getAllEnumerableKeys(data)).sort(alphaSortKeys);
        let formatted = '';
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (i > 0) {
            formatted += ', ';
          }
          formatted += `${key.toString()}: ${formatDataForPreview(data[key], false)}`;
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `{${truncateForDisplay(formatted)}}`;
      } else {
        return '{…}';
      }
    case 'error':
      return truncateForDisplay(String(data));
    case 'boolean':
    case 'number':
    case 'infinity':
    case '-infinity':
    case 'nan':
    case 'null':
    case 'undefined':
      return String(data);
    default:
      try {
        return truncateForDisplay(String(data));
      } catch (error) {
        return 'unserializable';
      }
  }
}
const isPlainObject = object => {
  const objectPrototype = Object.getPrototypeOf(object);
  if (!objectPrototype) return true;
  const objectParentPrototype = Object.getPrototypeOf(objectPrototype);
  return !objectParentPrototype;
};
function backendToFrontendSerializedElementMapper(element) {
  const {
    formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  } = parseElementDisplayNameFromBackend(element.displayName, element.type);
  return {
    ...element,
    displayName: formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  };
}
function normalizeUrlIfValid(url) {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}
function getIsReloadAndProfileSupported() {
  let isBackendStorageAPISupported = false;
  try {
    localStorage.getItem('test');
    isBackendStorageAPISupported = true;
  } catch (error) {}
  return isBackendStorageAPISupported && (0,_backend_utils__WEBPACK_IMPORTED_MODULE_7__.isSynchronousXHRSupported)();
}
function getIfReloadedAndProfiling() {
  return (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RELOAD_AND_PROFILE_KEY) === 'true';
}
function getProfilingSettings() {
  return {
    recordChangeDescriptions: (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY) === 'true'
  };
}
function onReloadAndProfile(recordChangeDescriptions) {
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageSetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RELOAD_AND_PROFILE_KEY, 'true');
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageSetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY, recordChangeDescriptions ? 'true' : 'false');
}
function onReloadAndProfileFlagsReset() {
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageRemoveItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RELOAD_AND_PROFILE_KEY);
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageRemoveItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY);
}
function unionOfTwoArrays(a, b) {
  let result = a;
  for (let i = 0; i < b.length; i++) {
    const value = b[i];
    if (a.indexOf(value) === -1) {
      if (result === a) {
        result = a.slice(0);
      }
      result.push(value);
    }
  }
  return result;
}

/***/ }),

/***/ "../shared/ReactIODescription.js":
/*!***************************************!*\
  !*** ../shared/ReactIODescription.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getIODescription": () => (/* binding */ getIODescription)
/* harmony export */ });
function getIODescription(value) {
  if (false) {}
  try {
    switch (typeof value) {
      case 'function':
        return value.name || '';
      case 'object':
        if (value === null) {
          return '';
        } else if (value instanceof Error) {
          return String(value.message);
        } else if (typeof value.url === 'string') {
          return value.url;
        } else if (typeof value.href === 'string') {
          return value.href;
        } else if (typeof value.src === 'string') {
          return value.src;
        } else if (typeof value.currentSrc === 'string') {
          return value.currentSrc;
        } else if (typeof value.command === 'string') {
          return value.command;
        } else if (typeof value.request === 'object' && value.request !== null && typeof value.request.url === 'string') {
          return value.request.url;
        } else if (typeof value.response === 'object' && value.response !== null && typeof value.response.url === 'string') {
          return value.response.url;
        } else if (typeof value.id === 'string' || typeof value.id === 'number' || typeof value.id === 'bigint') {
          return String(value.id);
        } else if (typeof value.name === 'string') {
          return value.name;
        } else {
          const str = value.toString();
          if (str.startsWith('[object ') || str.length < 5 || str.length > 500) {
            return '';
          }
          return str;
        }
      case 'string':
        if (value.length < 5 || value.length > 500) {
          return '';
        }
        return value;
      case 'number':
      case 'bigint':
        return String(value);
      default:
        return '';
    }
  } catch (x) {
    return '';
  }
}

/***/ }),

/***/ "../shared/ReactSymbols.js":
/*!*********************************!*\
  !*** ../shared/ReactSymbols.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ASYNC_ITERATOR": () => (/* binding */ ASYNC_ITERATOR),
/* harmony export */   "REACT_ACTIVITY_TYPE": () => (/* binding */ REACT_ACTIVITY_TYPE),
/* harmony export */   "REACT_CONSUMER_TYPE": () => (/* binding */ REACT_CONSUMER_TYPE),
/* harmony export */   "REACT_CONTEXT_TYPE": () => (/* binding */ REACT_CONTEXT_TYPE),
/* harmony export */   "REACT_ELEMENT_TYPE": () => (/* binding */ REACT_ELEMENT_TYPE),
/* harmony export */   "REACT_FORWARD_REF_TYPE": () => (/* binding */ REACT_FORWARD_REF_TYPE),
/* harmony export */   "REACT_FRAGMENT_TYPE": () => (/* binding */ REACT_FRAGMENT_TYPE),
/* harmony export */   "REACT_LAZY_TYPE": () => (/* binding */ REACT_LAZY_TYPE),
/* harmony export */   "REACT_LEGACY_ELEMENT_TYPE": () => (/* binding */ REACT_LEGACY_ELEMENT_TYPE),
/* harmony export */   "REACT_LEGACY_HIDDEN_TYPE": () => (/* binding */ REACT_LEGACY_HIDDEN_TYPE),
/* harmony export */   "REACT_MEMO_CACHE_SENTINEL": () => (/* binding */ REACT_MEMO_CACHE_SENTINEL),
/* harmony export */   "REACT_MEMO_TYPE": () => (/* binding */ REACT_MEMO_TYPE),
/* harmony export */   "REACT_OPTIMISTIC_KEY": () => (/* binding */ REACT_OPTIMISTIC_KEY),
/* harmony export */   "REACT_PORTAL_TYPE": () => (/* binding */ REACT_PORTAL_TYPE),
/* harmony export */   "REACT_PROFILER_TYPE": () => (/* binding */ REACT_PROFILER_TYPE),
/* harmony export */   "REACT_RECOVERABLE_TYPE": () => (/* binding */ REACT_RECOVERABLE_TYPE),
/* harmony export */   "REACT_SCOPE_TYPE": () => (/* binding */ REACT_SCOPE_TYPE),
/* harmony export */   "REACT_STRICT_MODE_TYPE": () => (/* binding */ REACT_STRICT_MODE_TYPE),
/* harmony export */   "REACT_SUSPENSE_LIST_TYPE": () => (/* binding */ REACT_SUSPENSE_LIST_TYPE),
/* harmony export */   "REACT_SUSPENSE_TYPE": () => (/* binding */ REACT_SUSPENSE_TYPE),
/* harmony export */   "REACT_TRACING_MARKER_TYPE": () => (/* binding */ REACT_TRACING_MARKER_TYPE),
/* harmony export */   "REACT_VIEW_TRANSITION_TYPE": () => (/* binding */ REACT_VIEW_TRANSITION_TYPE),
/* harmony export */   "getIteratorFn": () => (/* binding */ getIteratorFn)
/* harmony export */ });
const REACT_LEGACY_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_ELEMENT_TYPE = Symbol.for('react.transitional.element');
const REACT_PORTAL_TYPE = Symbol.for('react.portal');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const REACT_CONSUMER_TYPE = Symbol.for('react.consumer');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');
const REACT_SCOPE_TYPE = Symbol.for('react.scope');
const REACT_ACTIVITY_TYPE = Symbol.for('react.activity');
const REACT_LEGACY_HIDDEN_TYPE = Symbol.for('react.legacy_hidden');
const REACT_TRACING_MARKER_TYPE = Symbol.for('react.tracing_marker');
const REACT_MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');
const REACT_VIEW_TRANSITION_TYPE = Symbol.for('react.view_transition');
const REACT_RECOVERABLE_TYPE = Symbol.for('react.recoverable');
const MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
const FAUX_ITERATOR_SYMBOL = '@@iterator';
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }
  const maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }
  return null;
}
const ASYNC_ITERATOR = Symbol.asyncIterator;
const REACT_OPTIMISTIC_KEY = Symbol.for('react.optimistic_key');

/***/ }),

/***/ "../shared/isArray.js":
/*!****************************!*\
  !*** ../shared/isArray.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const isArrayImpl = Array.isArray;
function isArray(a) {
  return isArrayImpl(a);
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (isArray);

/***/ }),

/***/ "../shared/noop.js":
/*!*************************!*\
  !*** ../shared/noop.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ noop)
/* harmony export */ });
function noop() {}

/***/ }),

/***/ "../shared/objectIs.js":
/*!*****************************!*\
  !*** ../shared/objectIs.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function is(x, y) {
  return x === y && (x !== 0 || 1 / x === 1 / y) || x !== x && y !== y;
}
const objectIs = typeof Object.is === 'function' ? Object.is : is;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (objectIs);

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			loaded: false,
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/node module decorator */
/******/ 	(() => {
/******/ 		__webpack_require__.nmd = (module) => {
/******/ 			module.paths = [];
/******/ 			if (!module.children) module.children = [];
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!*******************************************!*\
  !*** ./src/contentScripts/installHook.js ***!
  \*******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react_devtools_shared_src_hook__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/hook */ "../react-devtools-shared/src/hook.js");
/* harmony import */ var react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-devtools-shared/src/utils */ "../react-devtools-shared/src/utils.js");
/* harmony import */ var _messages__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./messages */ "./src/contentScripts/messages.js");
/* harmony import */ var _reactBuildType__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./reactBuildType */ "./src/contentScripts/reactBuildType.js");




let resolveHookSettingsInjection;
let resolveComponentFiltersInjection;
function messageListener(event) {
  if (event.source !== window) {
    return;
  }
  if (event.data.source === 'react-devtools-settings-injector') {
    const payload = event.data.payload;
    if (payload.handshake) {
      (0,_messages__WEBPACK_IMPORTED_MODULE_2__.postMessage)({
        source: 'react-devtools-hook-installer',
        payload: {
          handshake: true
        }
      });
    } else if (payload.hookSettings) {
      window.removeEventListener('message', messageListener);
      resolveHookSettingsInjection(payload.hookSettings);
      resolveComponentFiltersInjection(payload.componentFilters);
    }
  }
}
if (!window.hasOwnProperty('__REACT_DEVTOOLS_GLOBAL_HOOK__')) {
  const hookSettingsPromise = new Promise(resolve => {
    resolveHookSettingsInjection = resolve;
  });
  const componentFiltersPromise = new Promise(resolve => {
    resolveComponentFiltersInjection = resolve;
  });
  window.addEventListener('message', messageListener);
  (0,_messages__WEBPACK_IMPORTED_MODULE_2__.postMessage)({
    source: 'react-devtools-hook-installer',
    payload: {
      handshake: true
    }
  });
  const shouldStartProfiling = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getIfReloadedAndProfiling)();
  const profilingSettings = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_1__.getProfilingSettings)();
  (0,react_devtools_shared_src_hook__WEBPACK_IMPORTED_MODULE_0__.installHook)(window, componentFiltersPromise, hookSettingsPromise, shouldStartProfiling, profilingSettings);
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.on('renderer', (0,_reactBuildType__WEBPACK_IMPORTED_MODULE_3__.createReactRendererListener)(window));
}
})();

/******/ })()
;
//# sourceMappingURL=installHook.js.map