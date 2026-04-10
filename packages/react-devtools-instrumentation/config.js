// Global configuration
export const config = Object.freeze({
  toolName: 'RAPIDOR',
  sessionID: crypto.randomUUID(), // [meta] ID of stored data
  debounceTimeMs: 1500,           // [optimization] Component state retrieval
  timeBetweenRequests: 1000,      // [policy] Ms between each generated HTTP request
  jaccardThr: 0.50,               // [policy] Similarity threshold considered in Jaccard's similarity index (0: more strict visual similarity, 1: more relaxed visual similarity)
  resBodyThr: 0.70,               // [policy] Similarity threshold in the response body (0: more relaxed key's similarity, 1: more strict key's similarity)
  domainRequestOnly: true,        // [optimization] Intercept only HTTP events to the domain's web server
  maxStateSnapshots: 10,          // [optimization] For each HTTP event, analysis is performed on the N most recent state snapshots
  tagsWhitelist: [0,7,11,15],     // [optimization] Eligible node.tags (see ReactWorkTags.js)
  maxExplorationDepth: 5,         // [optimization] Matching nodes are discarded if the path to the property being searched is too long
  maxExplorationKeys: 100,        // [optimization] Trim extremely large objects
  maxSegmentsHistoryLength: 100,  // [optimization] Max length of the history of URL segments
});


// Empirically-identified relevant tags:
// > Pimsleur: [0]
// > Busuu: [11]
// > Memrise: [7]
// > Promova: [0,15]