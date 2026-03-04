// Global configuration
export const config = Object.freeze({
  debounceTimeMs: 1000, // component state retrieval
  sessionID: crypto.randomUUID(), // ID of stored data
  allowedNodeTags: [0,5,7], // whitelist of component types to scan
});


// Components Tags are defined in ReactWorkTags.js
// Useful tags are found empirically

// tag === 0 // FunctionComponent
// tag === 1 // ClassComponent
// tag === 5 // HostComponent
// tag === 7 // Fragment
// tag === 11 // ForwardRef
// tag === 13 // SuspenseComponent
// tag === 14 // MemoComponent
// tag === 15 // SimpleMemoComponent
// tag === 16 // LazyComponent
// tag === 17 // IncompleteClassComponent
// tag === 19 // SuspenseListComponent
// tag === 21 // ScopeComponent
// tag === 22 // OffscreenComponent
// tag === 23 // LegacyHiddenComponent
// tag === 24 // CacheComponent
// tag === 25 // TracingMarkerComponent
// tag === 28 // IncompleteFunctionComponent
// tag === 30 // ViewTransitionComponent
// tag === 31 // ActivityComponent
