//===================
// Import
//===================
import { eventBus, events, emit } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../utils.js";
import { config } from "../config.js";
import { ReportManager } from "./reportManager.js";


//===================
// Functions
//===================
export class ResponseEvaluator {
  constructor() {
    this.reportManger = new ReportManager();
  }

  init() {
    this.reportManger.init();

    eventBus
      .pipe(filter(e => e.type === events.EVALUATE))
      .subscribe(e => this.handleEvent(e.payload));
  }


  handleEvent(event) {
    log({ module: "response evaluator", msg: "starting evaluation..." });

    const { reference, candidate } = event;
    const refIdx = reference.node.siblingIdx;
    const currIdx = candidate.node.siblingIdx;
    const refDOM = reference.node.DOM?.DOMchildren;
    const currDOM = candidate.node.DOM?.DOMchildren;
    const refResponse = reference.response;
    const currResponse = candidate.response;

    const resSimilarity = this.responseSimilarity({ refResponse, currResponse });

    if (Array.isArray(refDOM) && Array.isArray(currDOM)) {
      const DOMsimilarity = this.evaluateDOM({ refDOM: refDOM[refIdx], currDOM: currDOM[currIdx] });

      // if the DOM classes are not equal (over a certain threshold),
      // it means that we have received a 200 OK response using data extracted from a component,
      // which renders a different GUI element than what is done by a referenced component
      // We can leverage this finding to infer access control vulnerability
      if (DOMsimilarity.areDifferent && resSimilarity.areSimilar) {
        const similarity = { DOMsimilarity, resSimilarity };
        log({ module: "response evaluator", type: "warning", msg: "potential access control issue found" });
        emit({ type: events.REPORT, payload: { reference, candidate, similarity, ratio: 'potential access control vulnerability' } });
      }
    } else {
      // [TODO] sibling nodes with their own DOM elements
    }
    log({ module: "response evaluator", msg: "exit evaluation" });
  }


  responseSimilarity({ refResponse, currResponse }) {
    const compare = ['status', 'raw-type']; // shall we just compare the existing fields (?)
    const areFieldsEqual = compare.every(e => refResponse[e] === currResponse[e]);
    const refBodyLength = Number(refResponse['content-length']) || 0;
    const currBodyLength = Number(currResponse['content-length']) || 0;
    const isLengthSimilar = (refBodyLength && currBodyLength) ? this.checkIntSimilarity(refBodyLength, currBodyLength, config.resBodyThr) : true;

    const refBody = refResponse.body;
    const currBody = currResponse.body;
    const hasBody = !!refBody && !!currBody;

    const bodySimilarity = hasBody ? this.checkBodySimilarity(refBody, currBody) : {};

    return {
      areSimilar: areFieldsEqual && isLengthSimilar && (hasBody ? bodySimilarity.isSimilar : true),
      equalResponseFields: compare,
      bodyLength: { isLengthSimilar, refBodyLength, currBodyLength, threshold: config.resBodyThr },
      bodySimilarity,
      ratio: "the similarity is calculated on body length and body content (Object keys)",
    }
  }



  checkBodySimilarity(refBody, currBody) {
    const refKeys = this.extractKeyPaths(refBody);
    const currKeys = this.extractKeyPaths(currBody);

    // Calc similarity on the length of the sets of keys
    // We dont really care about the actual content, we just expect similar shapes
    const threshold = config.resBodyThr;
    const isSimilar = this.checkIntSimilarity(refKeys.length, currKeys.length, threshold);

    return {
      isSimilar,
      refKeys,
      currKeys,
      threshold,
    };
  }



  extractKeyPaths(obj, prefix = '') {
    let paths = [];

    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(path);

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        paths = paths.concat(this.extractKeyPaths(obj[key], path));
      }
    }

    return paths;
  }



  checkIntSimilarity(a, b, thr) {
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
      ratio: "the similarity is calculated on DOM classes chain. These originate from a common ancestor and end in two sibling nodes",
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