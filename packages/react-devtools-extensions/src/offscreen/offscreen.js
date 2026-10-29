// offscreen.js

//========================
// Import
//========================
import { env, pipeline } from "@huggingface/transformers";
import { log } from "../../../react-devtools-instrumentation/utils/utils";
import { config } from "../../../react-devtools-instrumentation/config";

// use local models instead of hosted ones (it overrides default behaviour)
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("assets/ort/");


//========================
// Const
//========================
class OffScreen {
  constructor() {
    this.extractor = null;
    this.initializationPromise = null;
    this.model = config.huggingfaceModel;
    this.AUTHZ_CONCEPTS = [
      "permissions and access control: user roles, permissions, and access rights determine whether a user can access, use, or is blocked from using a feature or resource",
      "feature gating and availability: features or content can be free, paid, premium, locked, unlocked, blocked, or available depending on the user's permissions and authorization",
      "subscription and access tiers: free and premium subscriptions, paid plans, and membership levels determine access to locked or unlocked features and content",
      "entitlements and usage limitations: user entitlements, credits, quotas, and usage limits determine whether a feature or resource is available, accessible, locked, unlocked, or blocked"
    ];

    this.conceptEmbeddings = null;
    this.threshold = 0.33;
  }

  init() {
    this.addEventListener();
  }



  addEventListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.target != "offscreen") { return; }

      if (message.type == "INITIALIZE_MODEL") {
        this.initializeModel()
          .then(async () => {
            if (!this.conceptEmbeddings) {
              await this.getConceptEmbedding();
            }
            sendResponse({ success: true });
          })
          .catch((error) => {
            log({ module: "offscreen", msg: `Model initialization error:, ${error}`, type: "error" });
            sendResponse({ success: false, error: error.message });
          });

        return true; // this keep the channel open 
      }

      if (message.type == "CLASSIFY_KEYS") {
        if (!Array.isArray(message.payload)) { return; }

        this.classifyKeys(message.payload)
          .then((results) => sendResponse({results}))
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
      this.initializationPromise = pipeline("feature-extraction", this.model)
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


  async getConceptEmbedding() {
    const output = await this.extractor(this.AUTHZ_CONCEPTS, { pooling: "mean", normalize: true });
    const dimension = output.dims.at(-1);

    this.conceptEmbeddings = this.AUTHZ_CONCEPTS.map((concept, i) => ({
      concept,
      embedding: Array.from(output.data.slice(i * dimension, (i + 1) * dimension)),
    }));

    return this.conceptEmbeddings;
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
    const output = await this.extractor(key, { pooling: "mean", normalize: true });
    const dimension = output.dims[output.dims.length - 1];
    const keyEmbedding = Array.from(output.data.slice(0, dimension));

    const scores = this.conceptEmbeddings.map(({ concept, embedding }) => {
      // Embeddings are normalized: scalar product is cosine similarity
      const score = keyEmbedding.reduce((sum, value, i) => sum + value * embedding[i], 0);
      return { concept, score };
    });


    const best = scores.reduce((a, b) => b.score > a.score ? b : a);

    return {
      key,
      score: best.score,
      scores,
      closestConcept: best.concept,
      isAuthZRelevant: best.score >= this.threshold,
    };
  }
}

const os = new OffScreen();
os.init();