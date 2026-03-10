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
    const DOM = reference.node.DOM;
    const DOMchildren = DOM?.DOMchildren;
    const refResponse = reference.response;
    const currResponse = candidate.response;

    const resSimilarity = this.responseSimilarity({ refResponse, currResponse });

    if (Array.isArray(DOMchildren)) {
      const refDOM = DOMchildren[refIdx];
      const currDOM = DOMchildren[currIdx];
      const DOMsimilarity = this.evaluateDOM({ refDOM, currDOM });

      // if the DOM classes are not equal (over a certain threshold),
      // it means that we have received a 200 OK response using data extracted from a component,
      // which renders a different GUI element than what is done by a referenced component
      // We can leverage this finding to infer access control vulnerability
      if (DOMsimilarity.jaccard <= config.jaccardThr && resSimilarity.result) {
        log({ module: "response evaluator", type: "warning", msg: "potential access control issue found" });
        const similarity = { DOMsimilarity, resSimilarity }
        emit({ type: events.REPORT, payload: { reference, candidate, similarity, ratio: 'potential access control vulnerability' } });
      }
    } else {
      // [TODO] sibling nodes with their own DOM elements
    }
  }


  responseSimilarity({ refResponse, currResponse }) {
    const compare = ['status', 'content-type', 'raw-type'];
    const areFieldsEqual = compare.every(e => refResponse[e] === currResponse[e]);
    const refBodyLength = Number(refResponse['content-length']);
    const currBodyLength = Number(currResponse['content-length']);
    const isLengthSimilar = this.checkBodyLength(refBodyLength, currBodyLength);

    // [TODO] calc response body similarity
    const result = areFieldsEqual && isLengthSimilar;

    return result ? {
      result,
      equalFields: compare,
      bodyLength: { isLengthSimilar, refBodyLength, currBodyLength },
      bodyContent: { } // [TODO]
    } : {}
  }



  checkBodyLength(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) { return false; }
    const thr = config.HTTPResBodyLengthDiffThr;
    const ratio = b / a;
    return ratio >= thr && ratio <= 1 / thr;
  }



  evaluateDOM({ refDOM, currDOM }) {
    const similarity = { ratio: "the similarity is calculated on DOM classes chain. These originate from a common ancestor and end in two sibling nodes" };
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

    similarity.jaccard = this.jaccardMultiset(refClasses, currClasses);
    similarity.orderSimilarity = this.orderedSimilarity(refClasses, currClasses)
    return similarity;
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

    return union === 0 ? 1 : intersection / union;
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