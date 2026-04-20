//===================
// Import
//===================
import { eventBus, events, emit } from "../../utils/eventBus.js";
import { filter } from 'rxjs/operators';
import { log, isPlainObject } from "../../utils/utils.js";
import { config } from "../../config.js";


//===================
// Functions
//===================
export class ResponseEvaluator {
  constructor(stateManager) {
    this.stateManager = stateManager;

    // Similarity threshold in response keys, and within the body
    // > [0] more relaxed key's similarity
    // > [1] more strict key's similarity
    this.responseBodyThr = 0.55;

    // Similarity threshold considered in Jaccard's similarity index
    // > [0] non-similar with HIGH visual differences
    // > [1] non-similar with LOW visual differences)
    this.jaccardThr = 0.70;

    this.CSSmap = new Map(); // Map<graphIndex, Map<nodeId, cssArray>>

    this.sensitiveKeys = [
      "premium", "locked", "access", "active", "blocked", "unlocked",
      "role", "plan", "subscription", "subscribed", "free",
      "entitlement", "tier", "paid"
    ];
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.EVALUATE))
      .subscribe(e => this.handleEvent(e.payload));
  }


  // [TODO] new strategies
  // > heuristics-based approach: find relevant key-values in `props` (eg. isLocked, isPremium, etc)

  // This currently does not work when we have free items with different DOM classes (eg. promova case)
  async handleEvent(event) {
    log({ module: "response evaluator", msg: "Starting evaluation..." });
    const { reference, candidate } = event;
    this.CSSmap.clear();

    const httpResponses = this.handleResponseSimilarity(reference.response, candidate.response);
    //const domEl = await this.handleVisualAnalysis(reference, candidate);
    const clientSideAuthZ = this.assessAuthZ(reference.node.props, candidate.node.props);
    const canReport = httpResponses.areSimilar && clientSideAuthZ.isPremium; //&& domEl.areDifferent ;

    console.log({ reference, candidate, clientSideAuthZ })

    if (!canReport) {
      log({ module: "response evaluator", msg: "Nothing to report" });
      return;
    }

    emit({
      type: events.REPORT,
      payload: {
        id: this.getReportId(candidate, reference),
        reference,
        candidate,
        analysis: { clientSideAuthZ, httpResponses },
        description: 'potential access control vulnerability'
      }
    });

    log({ module: "response evaluator", type: "warning", msg: "Potential access control issue found" });
  }



  // Differential analysis: compare reference props to current props
  // if there are differences for critical keys (eg. isPremium), return true (ie, currProps describes a premium item)
  assessAuthZ(refProps, currProps) {
    const diffs = this.compareObj(refProps, currProps);
    const sensitiveDiffs = diffs.filter(d => this.isSensitiveKey(d.key) || this.isSensitiveKey(d.pathStr));
    const isPremium = sensitiveDiffs.some(d => d.reference != d.current);

    return { isPremium, sensitiveDiffs };
  }



  isSensitiveKey(key) {
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



  // [TODO] to check: sometimes weird properties are matched, eg. updated_at (?)
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



  getReportId(current, reference) {
    return `current:${current.analysis.target.value}:nodeId:${current.node.id}:::reference:${reference.analysis.target.value}:nodeId:${reference.node.id}`;
  }



  handleResponseSimilarity(reference, current) {
    // The new query parameters triggered client-side DOM changes
    if (reference.isClientSide && current.isUsingNewParams) {
      return this.getClientResponseSimilarity(reference.dom, current.dom);
    }

    // Compare server-side responses body
    return this.getServerResponseSimilarity(reference, current);
  }



  getClientResponseSimilarity(dom1, dom2) {
    return {
      areSimilar: this.checkIntSimilarity(dom1.length, dom2.length),
      bodyLength: { refDOMlength: dom1.length, currDOMLength: dom2.length, threshold: this.responseBodyThr },
      description: "mutated query parameters produced client-side DOM changes",
    }
  }



  async handleVisualAnalysis(reference, current) {
    const graphIndex = reference.node.graphIndex;
    const referenceCSS = await this.getCSS(reference, graphIndex);
    const currentCSS = await this.getCSS(current, graphIndex);

    await Promise.all(
      current.node.instancesIds.map(async (id) => {
        const graph = this.CSSmap.get(graphIndex);

        if (graph?.has(id)) { return; }

        const [node, relations] = await Promise.all([
          this.stateManager.getNodeByID(graphIndex, id),
          this.stateManager.getRelationsByID(graphIndex, id)
        ]);

        await this.getCSS({ node, relations }, graphIndex);
      })
    );

    const instancesCSS = this.CSSmap.get(graphIndex);
    const freq = this.buildGlobalStats(instancesCSS);
    const score = this.buildScoreMap({ freeSet: referenceCSS, freq, totalNodes: instancesCSS.size });
    const areDifferent = this.hasLikelyPremiumCSS(currentCSS, score);

    return {
      description: "We estimate the likelihood of a component being free or premium by weighting its CSS classes according to their global frequency and their occurrence in a known free instance.",
      CSSanalysis: { reference: referenceCSS, current: currentCSS, freq, score },
      areDifferent
    }
  }



  // Create a map of frequencies of CSS classes
  // This describes how common a specific CSS class is
  buildGlobalStats(cssMap) {
    const freq = {};

    cssMap.forEach(classes => {
      for (const c of new Set(classes)) {
        freq[c] = (freq[c] || 0) + 1;
      }
    });

    return freq;
  }



  // This describes the likelihood of CSS class being used in a free element
  // The lower the value the higher the change that it is used in premium elements
  buildScoreMap({ freeSet, freq, totalNodes }) {
    const score = {};

    for (const c of Object.keys(freq)) {
      const p_global = freq[c] / totalNodes;
      const inFree = freeSet.has(c) ? 1 : 0;
      score[c] = inFree - p_global;
    }

    return score;
  }



  hasLikelyPremiumCSS(nodeCSS = new Set(), scoreMap) {
    let tot = 0;

    for (const c of nodeCSS) {
      tot += scoreMap[c] || 0;
    }

    return tot < 0;
  }



  async getCSS(obj, graphIndex) {
    const nodeId = obj.node.id;
    let graph = this.CSSmap.get(graphIndex);

    if (!graph) {
      graph = new Map();
      this.CSSmap.set(graphIndex, graph);
    }

    let css = graph.get(nodeId);

    if (!css) {
      css = await this.handleDOMclasses(obj, graphIndex);
      graph.set(nodeId, css);
    }

    return new Set(css);
  }



  async handleDOMclasses(obj, graphIndex) {
    const idx = obj.relations?.siblingMeta?.relativeIdx;
    const dom = obj.node.DOM || await this.stateManager.getAncestorDOM(graphIndex, obj.node.id);

    if (!Array.isArray(dom?.DOMchildren)) {
      log({ module: "response evaluator", type: "error", msg: "Impossible to execute DOM analysis" });
      return [];
    }

    const el = dom?.DOMchildren[idx];

    return el ? this.getFlatCSSClasses(el) : [];
  }



  // Returns flat array of CSS classes
  // classes and DOMchildren properties are appended in bridge.js
  getFlatCSSClasses(el, arr = []) {
    if (!el) { return arr; }

    if (el?.classes?.length) {
      arr.push(...el.classes);
    }

    if (el?.DOMchildren) {
      for (const child of el.DOMchildren) {
        this.getFlatCSSClasses(child, arr);
      }
    }

    return arr;
  }



  // [TODO] we are just considering JSON responses. To extend to HTML/JS or other valid responses (?)
  getServerResponseSimilarity(refResponse, currResponse) {
    // 1. Compare response fields
    const { fields, areFieldsEqual } = this.areFieldsEqual(refResponse, currResponse);

    // 2. Compare response body length
    const { refBodyLength, currBodyLength, isBodyLengthSimilar } = this.getBodyLengthSimilarity(refResponse, currResponse);

    // 3. Compare response body shape
    const { refBodyKeys, currBodyKeys, isBodyShapeSimilar } = this.getBodyShapeSimilarity(refResponse, currResponse);

    return {
      areSimilar: areFieldsEqual && isBodyLengthSimilar && isBodyShapeSimilar,
      fields: { areEqual: areFieldsEqual, fields },
      bodyLength: { refBodyLength, currBodyLength, isBodyLengthSimilar, threshold: this.responseBodyThr },
      bodyShape: { refBodyKeys, currBodyKeys, isBodyShapeSimilar, threshold: this.responseBodyThr },
      description: "the response similarity takes into account response fields similarity, body length and body content",
    }
  }



  getBodyShapeSimilarity(reference, current) {
    const refBodyKeys = this.extractKeyPaths(reference?.body || {});
    const currBodyKeys = this.extractKeyPaths(current?.body || {});

    // Calculate similarity on the length of the sets of keys
    // We dont care about the actual content, we just expect similar shapes
    const isBodyShapeSimilar = this.checkIntSimilarity(refBodyKeys.length, currBodyKeys.length);

    return { refBodyKeys, currBodyKeys, isBodyShapeSimilar };
  }



  // Returns a flat array of all the keys, including nested ones
  extractKeyPaths(obj = {}, prefix = '') {
    let paths = [];
    if (!obj) { return paths; }

    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(path);

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        paths = paths.concat(this.extractKeyPaths(obj[key], path));
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