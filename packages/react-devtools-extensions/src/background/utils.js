// [INFO]
// This runs as background script (service worker)
// Does not have access to the same IndexedDB instance as the main thread


//========================
// Const
//========================
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
let creatingOffscreenDocument = null;


//========================
// Functions
//========================
// Create off-screen document
export async function createOffscreenDocument() {
  if (creatingOffscreenDocument) {
    return creatingOffscreenDocument;
  }

  creatingOffscreenDocument = (async () => {
    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
    const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [offscreenUrl], });

    if (contexts.length > 0) { return; }

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["WORKERS"],
      justification: "Execute Hugging Face Transformers",
    });
  })();

  try {
    await creatingOffscreenDocument;
  } finally {
    creatingOffscreenDocument = null;
  }
}