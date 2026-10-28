// offscreen.js

//========================
// Import
//========================
import { pipeline } from "@huggingface/transformers";



//========================
// Const
//========================
class OffScreen {
  constructor() { }

  init() {
    this.addEventListener();
    console.log('chrome.storage exist', typeof chrome?.storage)
  }

  addEventListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.target !== "offscreen" || message.type !== "CLASSIFY_KEYS") { return; }
      if (!Array.isArray(message.payload)) { return; }

      // Keep the channel open while the classification is async
      this.classifyKeys(message.payload)
        .then((results) => sendResponse({ results }))
        .catch((error) => {
          console.error("[offscreen] Classification error:", error);
          sendResponse({ error: error.message });
        });

      return true;
    }
    );
  }



  async classifyKeys(keys) {
    const results = [];

    for (const key of keys) {
      const result = await this.classify(key);
      results.push(result);
    }

    return results;
  }



  async classify(key) {
    // TODO: integra qui Transformers.js
    console.log("[offscreen] cache non trovata, devo classificare:", key);

    return { key, classification: "unknown" };
  }
}

const os = new OffScreen();
os.init();