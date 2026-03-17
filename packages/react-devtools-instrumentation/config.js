// Global configuration
export const config = Object.freeze({
  toolName: 'RAPIDOR',
  debounceTimeMs: 0,//1000, // component state retrieval
  timeBetweenRequests: 500, // milliseconds between each generated HTTP request
  sessionID: crypto.randomUUID(), // ID of stored data
  jaccardThr: 0.5, // similarity threshold considered in Jaccard's similarity index
  resBodyThr: 0.8, // similarity threshold in the response body 
  domainRequestOnly: true, // intercept only HTTP events to the domain's web server
  snapshotAnalysisWindow: 10, // [todo] number of snapshots on which each HTTP event is analyzed
  
  // whitelist of component types to scan (currently we save all the nodes and then analyze only nodes with siblings)
  // allowedNodeTags: [5,7],
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
