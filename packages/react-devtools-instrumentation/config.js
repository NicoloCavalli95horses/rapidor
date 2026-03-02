// Global configuration
export const config = Object.freeze({
  debounceTimeMs: 1000, // component state retrieval
  sessionID: crypto.randomUUID(), // ID of stored data

  // HostComponent (5): has DOM info
  // Fragment (7): has end-component props
  allowedNodeTag: [5, 7], // whitelist of component types to scan (see ReactWorkTags.js)
});