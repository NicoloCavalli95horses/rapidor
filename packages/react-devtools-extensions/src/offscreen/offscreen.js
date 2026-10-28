// offscreen.js

//========================
// Import
//========================
import { env, pipeline } from "@huggingface/transformers";
import { log } from "../../../react-devtools-instrumentation/utils/utils";

// use local models instead of hosted ones (it overrides default behaviour)
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("assets/ort/");


//========================
// Const
//========================
class OffScreen {
  constructor() {
    this.extractor = null;
    this.initializationPromise = null;
  }

  init() {
    this.addEventListener();
  }



  addEventListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.target != "offscreen") { return; }

      if (message.type == "INITIALIZE_MODEL") {
        this.initializeModel()
          .then(() => sendResponse({ success: true }))
          .catch((error) => {
            log({ module: "offscreen", msg: `Model initialization error:, ${error}`, type: "error" });
            sendResponse({ success: false, error: error.message });
          });

        return true; // this keep the channel open 
      }

      if (message.type == "CLASSIFY_KEYS") {
        if (!Array.isArray(message.payload)) { return; }

        this.classifyKeys(message.payload)
          .then((results) => sendResponse({ results }))
          .catch((error) => {
            console.error("[offscreen] Classification error:", error);
            sendResponse({ success: false, error: error.message });
          });

        return true;
      }
    });
  }



  async initializeModel() {
    if (this.extractor) { return this.extractor; }

    if (!this.initializationPromise) {
      this.initializationPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")
        .then((extractor) => {
          this.extractor = extractor;
          console.log("[offscreen] Model successfully initialized");
          return extractor;
        })
        .catch((error) => {
          // Allow retry after a failed initialization
          this.initializationPromise = null;
          throw error;
        });
    }

    return this.initializationPromise;
  }



  async classifyKeys(keys) {
    await this.initializeModel();

    const results = [];

    for (const key of keys) {
      results.push(await this.classify(key));
    }

    return results;
  }



  async classify(key) {
    // TODO
    return { key, classification: "unknown" };
  }
}

const os = new OffScreen();
os.init();