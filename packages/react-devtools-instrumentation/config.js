// Global configuration
export const config = Object.freeze({
  toolName: 'RAPIDOR',
  sessionID: crypto.randomUUID(),       // [meta] ID of stored data
  verbose: false,                       // [policy] logs extra information
  debounceTimeMs: 1500,                 // [optimization] Component state retrieval
  throttleTimeMs: 7000,                 // [optimization] Component state retrieval
  timeBetweenRequests: 800,             // [policy] Ms between each generated HTTP request
  domainRequestOnly: true,              // [optimization] Intercept only HTTP events to the domain's web server
  domHandlerEnabled: false,             // [policy] Enables the DOMhandler module (floating "Download logs"/"Print stats" buttons)
  maxStateSnapshots: 10,                // [optimization] For each HTTP event, analysis is performed on the N most recent state snapshots
  tagsWhitelist: [0, 7, 11, 15],        // [optimization] Eligible node.tags (see ReactWorkTags.js) (*)
  maxExplorationDepth: 5,               // [optimization] Matching nodes are discarded if the path to the property being searched is too long
  maxExplorationKeys: 100,              // [optimization] Trim extremely large objects
  maxSegmentsHistoryLength: 250,        // [optimization] Max length of the history of URL segments
  testClientSideQueryParamsUsage: true, // [policy] Candidate query parameters are tested on the client-side (eg. url.searchParams.set(param, value); window.history.pushState({}, "", url);)
  sensitiveKeyThr: 0.6,                 // [policy] Threshold above which a key is classified as relevant for authorization

  huggingfaceModel: "Xenova/all-MiniLM-L6-v2", // [policy] model from HuggingFace (https://huggingface.co/docs/transformers.js/en/index)

  // [policy] the value of the keys matching the following list is preindexed
  preindexedKeys: [
    'id', 'user', 'account', 'profile', 'order',
    'resource', 'item', 'object', 'doc', 'name', 'key', 'title', 'type', 'url', 'link',
    'owner', 'author', 'creator', 'role', 'permission', 'scope',
    'content', 'node', 'slug'
  ],

});

//////////////////////////////
// Notes
/////////////////////////////
// (*) Empirically-identified relevant tags