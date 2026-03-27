// Global configuration
export const config = Object.freeze({
  toolName: 'RAPIDOR',
  sessionID: crypto.randomUUID(), // [meta] ID of stored data
  debounceTimeMs: 1500,           // [optimization] component state retrieval
  timeBetweenRequests: 500,       // [policy] ms between each generated HTTP request
  jaccardThr: 0.50,               // [policy] similarity threshold considered in Jaccard's similarity index (0: more strict visual similarity, 1: more relaxed visual similarity)
  resBodyThr: 0.70,               // [policy] similarity threshold in the response body (0: more relaxed key's similarity, 1: more strict key's similarity)
  domainRequestOnly: true,        // [optimization] intercept only HTTP events to the domain's web server
  maxPagesPerHTTPEvent: 3,        // [optimization] each HTTP events is process on max n past UI state snapshots
  tagsWhitelist: [0],             // [optimization] eligible node.tags (see ReactWorkTags.js)
  graphExplorationDepth: 5,       // [optimization] matching nodes are discarded if the path to the property being searched is too long
});