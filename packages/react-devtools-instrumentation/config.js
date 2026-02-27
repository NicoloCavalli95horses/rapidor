// Global configuration
export const config = Object.freeze({
  debounceTimeMs: 1000,            // component state retrieval
  sessionID: crypto.randomUUID(),  // ID of stored data
});