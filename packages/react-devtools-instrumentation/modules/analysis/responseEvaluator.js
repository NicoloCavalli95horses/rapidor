//===================
// Import
//===================
import { eventBus, events, emit } from "../../utils/eventBus.js";
import { filter } from 'rxjs/operators';
import { log, isPlainObject, getCurrentDOM } from "../../utils/utils.js";
import { config } from "../../config.js";



//===================
// Functions
//===================
export class ResponseEvaluator {
  constructor() {
    // Similarity threshold in response keys, and within the body
    // more relaxed [0,1] more strict key's similarity
    this.responseBodyThr = 0.45;

    this.sensitiveKeys = [
      "premium", "locked", "access", "active", "blocked", "unlocked",
      "role", "plan", "subscription", "subscribed", "free",
      "entitlement", "tier", "paid", "available"
    ];

    this.reportedId = new Set();
    this.totIdor = 0;
  }



  init() {
    eventBus
      .pipe(filter(e => e.type === events.EVALUATE))
      .subscribe(e => this.handleEvent(e.payload));
  }



  async handleEvent(event) {
    log({ module: "response evaluator", msg: "Starting evaluation..." });

    const { reference, candidate: current } = event;

    const httpResponses = this.handleResponseSimilarity(reference.response, current.response);
    const clientSideAuthZ = this.assessAuthZ(reference.node.props, current.node.props);
    const canReport = httpResponses.areSimilar && clientSideAuthZ.isPremium;

    const id = await this.getReportId(current);

    if (config.verbose) {
      log({ module: "response evaluator", msg: { httpResponses, clientSideAuthZ, canReport } });
    }

    if (!canReport || !id) {
      log({ module: "response evaluator", msg: "Nothing to report" });
      return;
    }

    this.totIdor++;

    emit({
      type: events.REPORT,
      payload: {
        id,
        reference,
        current,
        analysis: { clientSideAuthZ, httpResponses },
        description: 'potential access control vulnerability'
      }
    });

    log({ module: "response evaluator", type: "warning", msg: `${this.totIdor} potential access control issue${this.totIdor > 1 ? 's' : ''} found` });
  }



  // Differential analysis: compare reference props to current props
  // if there are differences for critical keys (eg. isPremium), return true (ie, currProps describes a premium item)
  assessAuthZ(refProps, currProps) {
    const diffs = this.compareObj(refProps, currProps);
    const fields = ["key", "pathStr", "current", "reference"];
    const sensitiveDiffs = diffs.filter(d => fields.some(f => this.isSensitiveKey(d[f])));
    const isPremium = sensitiveDiffs.some(d => d.reference != d.current);

    return { isPremium, sensitiveDiffs };
  }



  isSensitiveKey(key) {
    if (key == null) { return false; }
    if (typeof key === "number" || typeof key === "boolean") { key = String(key); }
    if (typeof key !== "string") { return false; }

    // "isPremium" > ["is", "premium"]
    function tokenize(key) {
      return key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    }

    const tokens = tokenize(key);
    return tokens.some(token => this.sensitiveKeys.includes(token));
  }



  // [TODO] to test
  compareObj(a, b) {
    const visited = new WeakSet();
    const diffs = [];

    function compare(a, b, path = []) {
      if (a === b) { return; }

      // check different types
      if (typeof a !== typeof b) {
        const key = path.length ? path[path.length - 1] : "";
        diffs.push({ path, reference: a, current: b, key, pathStr: path.join(".") });
        return;
      }

      // check different primitives
      if (!isPlainObject(a) || !isPlainObject(b)) {
        const key = path.length ? path[path.length - 1] : "";
        diffs.push({ path, reference: a, current: b, key: key, pathStr: path.join(".") });
        return;
      }

      if (visited.has(a) || visited.has(b)) { return; }
      visited.add(a);
      visited.add(b);

      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

      for (const key of keys) {
        compare(a[key], b[key], [...path, key]);
      }
    }

    compare(a, b);

    return diffs;
  }


  // Returns a report ID used to avoid duplicates
  async getReportId(current) {
    // Do not consider data from reference node: this may lead to duplicate reports
    const curr = `current::${current.analysis.target.value}:nodeId:${current.node.id}`;
    const http = `http::${current.request.method}:${current.request.url}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(curr + http);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const id = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    if (!this.reportedId.has(id)) {
      this.reportedId.add(id);
      return id;
    }

    return null;
  }



  handleResponseSimilarity(reference, current) {
    // The new query parameters triggered client-side DOM changes
    if (reference.isClientSide && reference.dom) {
      const currentClientSideRes = current.dom || (current.status === 200 && current.body?.length ? current.body : null);
      return this.getClientResponseSimilarity(reference.dom, currentClientSideRes);
    }

    // Compare server-side responses body
    return this.getServerResponseSimilarity(reference, current);
  }



  getClientResponseSimilarity(dom1, dom2) {
    return {
      areSimilar: this.checkIntSimilarity(dom1.length, dom2.length),
      description: "Original request was handled by the SPA routing system. This similarity refers to the two DOMs obtained from the original URL and the mutated one",
      bodyLength: {
        refDOMlength: dom1.length,
        currDOMLength: dom2.length,
        threshold: this.responseBodyThr
      },
    }
  }



  getServerResponseSimilarity(refResponse, currResponse) {
    // 1. Compare response fields
    const { fields, areFieldsEqual } = this.areFieldsEqual(refResponse, currResponse);

    // 2. Compare response body length
    const { refBodyLength, currBodyLength, isBodyLengthSimilar } = this.getBodyLengthSimilarity(refResponse, currResponse);

    // 3. Compare response body shape
    const { refBodyKeys, currBodyKeys, isBodyShapeSimilar } = this.getBodyShapeSimilarity(refResponse, currResponse);

    return {
      areSimilar: areFieldsEqual && isBodyLengthSimilar && isBodyShapeSimilar,
      description: "the response similarity takes into account response fields similarity, body length and body content",
      fields: {
        fields,
        areEqual: areFieldsEqual,
      },
      bodyLength: {
        refBodyLength,
        currBodyLength,
        isBodyLengthSimilar,
        threshold: this.responseBodyThr,
      },
      bodyShape: {
        refBodyKeys,
        currBodyKeys,
        isBodyShapeSimilar,
        threshold: this.responseBodyThr,
      },
    }
  }



  getBodyShapeSimilarity(reference, current) {
    const refBodyKeys = this.extractKeyPaths({ obj: reference?.body || {}, depth: 1 });
    const currBodyKeys = this.extractKeyPaths({ obj: current?.body || {}, depth: 1 });

    // Calculate similarity on the length of the sets of keys
    // We dont care about the actual content, we just expect similar shapes
    const isBodyShapeSimilar = this.checkIntSimilarity(refBodyKeys.length, currBodyKeys.length);

    return { refBodyKeys, currBodyKeys, isBodyShapeSimilar };
  }



  // Returns a flat array of all the keys, including nested ones
  // Consider the path to improve matching efficacy
  extractKeyPaths({ obj = {}, depth = Infinity, prefix = '' } = {}) {
    if (!obj || depth <= 0) { return []; }
    let paths = [];

    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(path);

      const value = obj[key];

      if (depth > 1 && value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(
          ...this.extractKeyPaths({
            obj: value,
            depth: depth - 1,
            prefix: path,
          })
        );
      }
    }

    return paths;
  }



  getBodyLengthSimilarity(reference, current) {
    const refBodyLength = Number(reference['content-length']) || 0;
    const currBodyLength = Number(current['content-length']) || 0;
    const isBodyLengthSimilar = this.checkIntSimilarity(refBodyLength, currBodyLength);

    return { refBodyLength, currBodyLength, isBodyLengthSimilar };
  }



  areFieldsEqual(reference, current) {
    const fields = ['status', 'type', 'rawType', 'headers'];
    let areFieldsEqual = true;

    for (const f of fields) {
      if (reference[f] !== current[f]) {
        areFieldsEqual = false;
      }
    }

    return { fields, areFieldsEqual };
  }



  checkIntSimilarity(a, b, thr = this.responseBodyThr) {
    if (a === 0 && b === 0) { return true; }
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) { return false; }
    const ratio = b / a;

    return (ratio >= thr) && (ratio <= 1 / thr);
  }
}