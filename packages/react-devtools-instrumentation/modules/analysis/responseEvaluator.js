//===================
// Import
//===================
import {eventBus, events, emit} from '../../utils/eventBus.js';
import {filter} from 'rxjs/operators.js';
import {
  log,
  isPlainObject,
  recordMetric,
  metricKeys,
} from '../../utils/utils.js';
import {config} from '../../config.js';
import {sendToBridge} from '../../utils/clientToBridge.js';

//===================
// Functions
//===================
export class ResponseEvaluator {
  constructor() {
    // Similarity threshold in response keys, and within the body
    // more relaxed [0,1] more strict key's similarity
    this.responseBodyThr = 0.45;
    this.reportedId = new Set();
    this.totIdor = 0;
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.EVALUATE))
      .subscribe(e => this.handleEvent(e.payload));
  }

  async handleEvent(event) {
    log({module: 'response evaluator', msg: 'Starting evaluation...'});
    recordMetric({key: metricKeys.EVALUATIONS_PERFORMED});

    const {reference, candidate: current} = event;

    const httpResponses = this.handleResponseSimilarity(
      reference.response,
      current.response
    );
    const clientSideAuthZ = await this.assessAuthZ(
      reference.node.props,
      current.node.props
    );
    const canReport = httpResponses.areSimilar && clientSideAuthZ.isPremium;

    recordMetric({
      key: metricKeys.PROP_DIFFERENCES_FOUND,
      value: clientSideAuthZ.differences.length,
    });

    const id = await this.getReportId(current);

    if (config.verbose) {
      log({
        module: 'response evaluator',
        msg: {httpResponses, clientSideAuthZ, canReport},
      });
    }

    if (!canReport || !id) {
      log({module: 'response evaluator', msg: 'Nothing to report'});
      return;
    }

    this.totIdor++;
    recordMetric({key: metricKeys.VULNERABILITIES_REPORTED});

    emit({
      type: events.REPORT,
      payload: {
        id,
        reference,
        current,
        analysis: {clientSideAuthZ, httpResponses},
        description: 'potential access control vulnerability',
      },
    });

    log({
      module: 'response evaluator',
      type: 'warning',
      msg: `${this.totIdor} potential access control issue${this.totIdor > 1 ? 's' : ''} found`,
    });
  }

  // Differential analysis: compare reference props to current props
  // if there are differences for critical keys (eg. isPremium), return true (ie, currProps describes a premium item)
  // authorization-related keys are identified via
  async assessAuthZ(refProps, currProps) {
    const differences = this.compareObj(refProps, currProps);
    const payload = differences.flatMap(
      ({key, pathStr, current, reference}) => [key, pathStr, current, reference]
    );

    const isValidString = value =>
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 50 &&
      !value.includes(' ') &&
      !/^\d+$/.test(value) &&
      /^[a-zA-Z0-9_]+$/.test(value);

    const filteredPayload = [...new Set(payload.filter(isValidString))];

    const {results} = await sendToBridge({
      action: 'CLASSIFY_KEYS',
      payload: filteredPayload,
    });
    let hasSensitiveValues = false;

    if (results.length) {
      const sensitiveCount = results.filter(i => i?.isAuthZRelevant).length;
      recordMetric({
        key: metricKeys.SENSITIVE_KEYS_DETECTED,
        value: sensitiveCount,
      });
      hasSensitiveValues = sensitiveCount > 0;
    }

    // true when there are sensitive keys within the prop object, and the current value under test differs from the reference one
    const isPremium =
      differences.some(key => key.reference != key.current) &&
      hasSensitiveValues;

    return {isPremium, differences};
  }

  compareObj(a, b) {
    const visited = new WeakSet();
    const diffs = [];

    function compare(a, b, path = []) {
      if (a === b) {
        return;
      }

      // check different types
      if (typeof a !== typeof b) {
        const key = path.length ? path[path.length - 1] : '';
        diffs.push({
          path,
          reference: a,
          current: b,
          key,
          pathStr: path.join('.'),
        });
        return;
      }

      // check different primitives
      if (!isPlainObject(a) || !isPlainObject(b)) {
        const key = path.length ? path[path.length - 1] : '';
        diffs.push({
          path,
          reference: a,
          current: b,
          key: key,
          pathStr: path.join('.'),
        });
        return;
      }

      if (visited.has(a) || visited.has(b)) {
        return;
      }
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
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const id = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (!this.reportedId.has(id)) {
      this.reportedId.add(id);
      return id;
    }

    return null;
  }

  handleResponseSimilarity(reference, current) {
    // The new query parameters triggered client-side DOM changes
    if (reference.isClientSide && reference.dom) {
      const currentClientSideRes =
        current.dom ||
        (current.status === 200 && current.body?.length ? current.body : null);
      return this.getClientResponseSimilarity(
        reference.dom,
        currentClientSideRes
      );
    }

    // Compare server-side responses body
    return this.getServerResponseSimilarity(reference, current);
  }

  getClientResponseSimilarity(dom1, dom2) {
    return {
      areSimilar: this.checkIntSimilarity(dom1.length, dom2.length),
      description:
        'Original request was handled by the SPA routing system. This similarity refers to the two DOMs obtained from the original URL and the mutated one',
      bodyLength: {
        refDOMlength: dom1.length,
        currDOMLength: dom2.length,
        threshold: this.responseBodyThr,
      },
    };
  }

  getServerResponseSimilarity(refResponse, currResponse) {
    // 1. Compare response fields
    const {fields, areFieldsEqual} = this.areFieldsEqual(
      refResponse,
      currResponse
    );

    // 2. Compare response body length
    const {refBodyLength, currBodyLength, isBodyLengthSimilar} =
      this.getBodyLengthSimilarity(refResponse, currResponse);

    // 3. Compare response body shape
    const {refBodyKeys, currBodyKeys, isBodyShapeSimilar} =
      this.getBodyShapeSimilarity(refResponse, currResponse);

    return {
      areSimilar: areFieldsEqual && isBodyLengthSimilar && isBodyShapeSimilar,
      description:
        'the response similarity takes into account response fields similarity, body length and body content',
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
    };
  }

  getBodyShapeSimilarity(reference, current) {
    const refBodyKeys = this.extractKeyPaths({
      obj: reference?.body || {},
      depth: 1,
    });
    const currBodyKeys = this.extractKeyPaths({
      obj: current?.body || {},
      depth: 1,
    });

    // Calculate similarity on the length of the sets of keys
    // We dont care about the actual content, we just expect similar shapes
    const isBodyShapeSimilar = this.checkIntSimilarity(
      refBodyKeys.length,
      currBodyKeys.length
    );

    return {refBodyKeys, currBodyKeys, isBodyShapeSimilar};
  }

  // Returns a flat array of all the keys, including nested ones
  // Consider the path to improve matching efficacy
  extractKeyPaths({obj = {}, depth = Infinity, prefix = ''} = {}) {
    if (!obj || depth <= 0) {
      return [];
    }
    let paths = [];

    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(path);

      const value = obj[key];

      if (
        depth > 1 &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
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
    const isBodyLengthSimilar = this.checkIntSimilarity(
      refBodyLength,
      currBodyLength
    );

    return {refBodyLength, currBodyLength, isBodyLengthSimilar};
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

  checkIntSimilarity(a, b, thr = this.responseBodyThr) {
    if (a === 0 && b === 0) {
      return true;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) {
      return false;
    }
    const ratio = b / a;

    return ratio >= thr && ratio <= 1 / thr;
  }
}
