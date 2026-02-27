// Global configuration
export const config = Object.freeze({
  debounceTimeMs: 1500,            // affect component state retrieval
  sessionID: crypto.randomUUID(),  // ID of stored data
});