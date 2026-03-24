// Global configuration
export const config = Object.freeze({
  toolName: 'RAPIDOR',
  debounceTimeMs: 1500, // component state retrieval
  timeBetweenRequests: 500, // milliseconds between each generated HTTP request
  sessionID: crypto.randomUUID(), // ID of stored data
  jaccardThr: 0.50, // similarity threshold considered in Jaccard's similarity index (0: more strict visual similarity, 1: more relaxed visual similarity)
  resBodyThr: 0.70, // similarity threshold in the response body (0: more relaxed key's similarity, 1: more strict key's similarity)
  domainRequestOnly: true, // intercept only HTTP events to the domain's web server
  maxPagesPerHTTPEvent: 3, // each HTTP events is process on max n past UI state snapshots
});