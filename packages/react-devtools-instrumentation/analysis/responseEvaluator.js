//===================
// Import
//===================
import { eventBus, events, emit } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../utils.js";


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


  handleEvent(event) {
    log({ module: "response evaluator", msg: "starting evaluation..." });
    const { reference, candidate } = event;
    const refIdx = reference.node.siblingIdx;
    const currIdx = candidate.node.siblingIdx;

    // [TODO] the ancestor is common but we have two DOM objects in reference and candidate node
    // - is this always the case or we may have sibling nodes with their own DOM elements?
    const DOM = reference.node.DOM;
    const DOMchildren = DOM?.DOMchildren;

    if (Array.isArray(DOMchildren)) {
      const refDOM = DOMchildren[refIdx];
      const currDOM = DOMchildren[currIdx];
      const similarity = this.evaluateDOM({ refDOM, currDOM });

      // if DOM classes are not equal (over a certain threshold)
      // it means we received a 200 OK response using data extracted from a component
      // who renders a different GUI compared to a reference component
      // We can leverage this finding to infer IDOR vulnerability

      console.log(similarity)
      if (similarity.jaccard <= 0.5) {
        alert('IDOR found!', event);
      }
    }
  }



  evaluateDOM({ refDOM, currDOM }) {
    const similarity = { value: null };
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