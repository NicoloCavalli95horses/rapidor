//===================
// Import
//===================
import { eventBus, events, emit } from "../../utils/eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../../utils/utils.js";
import { config } from "../../config.js";


//===================
// Functions
//===================
export class ResponseEvaluator {
  constructor() {
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.EVALUATE))
      .subscribe(e => this.handleEvent(e.payload));
  }


  // [TODO] new strategies
  // > compare callstacks after click events on siblings 
  // > probabilistic grouping of free or premium elements
  // > heuristics-based approach: find relevant key-values in `props` (eg. isLocked, isPremium, etc)

  // This currently does not work when we have free items with different DOM classes (eg. promova case)
  handleEvent(event) {
    log({ module: "response evaluator", msg: "Starting evaluation..." });
    const { reference, candidate } = event;

    const responseSimilarity = this.handleResponseSimilarity(reference.response, candidate.response);
    const DOMsimilarity = this.handleDOMSimilarity(reference, candidate);
    const canReport = DOMsimilarity.areDifferent && responseSimilarity.areSimilar;

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
        similarity: { DOMsimilarity, responseSimilarity },
        description: 'potential access control vulnerability'
      }
    });

    log({ module: "response evaluator", type: "warning", msg: "Potential access control issue found" });
  }



  getReportId(cand, ref) {
    return `curr:${cand.analysis.target.value}:nodeId:${cand.node.id}:::ref:${ref.analysis.target.value}:nodeId:${ref.node.id}`;
  }



  handleResponseSimilarity(refResponse, currResponse) {
    // The new query parameters triggered client-side DOM changes
    if (refResponse.isClientSide && currResponse.isUsingNewParams) {
      return this.getDOMResponseSimilarity(refResponse.dom, currResponse.dom);
    }

    // Compare server-side responses body
    return this.getResponseSimilarity(refResponse, currResponse);
  }



  getDOMResponseSimilarity(dom1, dom2) {
    return {
      areSimilar: this.checkIntSimilarity(dom1.length, dom2.length, config.resBodyThr),
      bodyLength: { refDOMlength: dom1.length, currDOMLength: dom2.length, threshold: config.resBodyThr },
      description: "mutated query parameters produced client-side DOM changes",
    }
  }



  handleDOMSimilarity(reference, candidate) {
    const refIdx = reference.relations.siblingMeta?.relativeIdx;
    const currIdx = candidate.relations.siblingMeta?.relativeIdx;
    const refDOM = reference.node.DOM?.DOMchildren;
    const currDOM = candidate.node.DOM?.DOMchildren;

    if (Array.isArray(refDOM) && Array.isArray(currDOM)) {
      return this.evaluateDOM({ refDOM: refDOM[refIdx], currDOM: currDOM[currIdx] });
    }
  }



  // [TODO] we are just considering JSON responses. To extend to HTML/JS or other valid responses (?)
  getResponseSimilarity(refResponse, currResponse) {
    // 1. Compare response fields
    const {fields, areFieldsEqual} = this.areFieldsEqual(refResponse, currResponse);

    // 2. Compare response body length
    const { refBodyLength, currBodyLength, isBodyLengthSimilar } = this.getBodyLengthSimilarity(refResponse, currResponse);

    // 3. Compare response body shape
    const { refBodyKeys, currBodyKeys, isBodyShapeSimilar } = this.getBodyShapeSimilarity(refResponse, currResponse);

    return {
      areSimilar: areFieldsEqual && isBodyLengthSimilar && isBodyShapeSimilar,
      fields: { areEqual: areFieldsEqual, fields},
      bodyLength: { refBodyLength, currBodyLength, isBodyLengthSimilar, threshold: config.resBodyThr },
      bodyShape: { refBodyKeys, currBodyKeys, isBodyShapeSimilar, threshold: config.resBodyThr },
      description: "the overall similarity takes into consideration response fields similarity, body length and body content",
    }
  }



  getBodyShapeSimilarity(reference, current) {
    const refBodyKeys = this.extractKeyPaths(reference?.body || {});
    const currBodyKeys = this.extractKeyPaths(current?.body || {});

    // Calculate similarity on the length of the sets of keys
    // We dont care about the actual content, we just expect similar shapes
    const isBodyShapeSimilar = this.checkIntSimilarity(refBodyKeys.length, currBodyKeys.length, config.resBodyThr);

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
    const isBodyLengthSimilar = this.checkIntSimilarity(refBodyLength, currBodyLength, config.resBodyThr);

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

    return {fields, areFieldsEqual};
  }




  checkIntSimilarity(a, b, thr) {
    if (a === 0 && b === 0) { return true; }
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) { return false; }
    const ratio = b / a;
    return (ratio >= thr) && (ratio <= 1 / thr);
  }



  evaluateDOM({ refDOM, currDOM }) {
    const refClasses = [];
    const currClasses = [];

    function getClasses(arr, el) {
      if (!el) { return; }

      if (el.classes && el.classes.length) {
        arr.push(...el.classes);
      }

      if (el.DOMchildren) {
        for (const child of el.DOMchildren) {
          getClasses(arr, child);
        }
      }
    };

    getClasses(refClasses, refDOM);
    getClasses(currClasses, currDOM);

    const jaccard = this.jaccardMultiset(refClasses, currClasses);

    return {
      jaccard,
      orderSimilarity: this.orderedSimilarity(refClasses, currClasses),
      description: "the similarity is calculated on DOM classes chain. These originate from a common ancestor and end in two sibling nodes",
      CSSclasses: { referenceNodeCSS: refClasses, candidateNodeCSS: currClasses },
      threshold: config.jaccardThr,
      areDifferent: jaccard <= config.jaccardThr
    }
  }




  jaccardMultiset(a, b) {
    const countA = {};
    const countB = {};

    for (const x of a) countA[x] = (countA[x] || 0) + 1;
    for (const x of b) countB[x] = (countB[x] || 0) + 1;

    const keys = new Set([...Object.keys(countA), ...Object.keys(countB)]);

    let intersection = 0;
    let union = 0;

    for (const k of keys) {
      const ca = countA[k] || 0;
      const cb = countB[k] || 0;

      intersection += Math.min(ca, cb);
      union += Math.max(ca, cb);
    }

    return (union === 0) ? 1 : (intersection / union);
  }



  // Returns the longest sequence of common elements
  // A = ['a','b','c','d']
  // B = ['a','c','d']
  // LCS = 3 
  longestCommonSubsequence(A, B) {
    const m = A.length;
    const n = B.length;

    // new matrice (m+1)x(n+1) init at 0
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (A[i - 1] === B[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = m, j = n;
    const lcs = [];
    while (i > 0 && j > 0) {
      if (A[i - 1] === B[j - 1]) {
        lcs.unshift(A[i - 1]);
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return { length: dp[m][n], sequence: lcs };
  }



  // Normalize LCS
  orderedSimilarity(A, B) {
    const lcsLen = this.longestCommonSubsequence(A, B).length;
    return lcsLen / Math.max(A.length, B.length);
  }
}