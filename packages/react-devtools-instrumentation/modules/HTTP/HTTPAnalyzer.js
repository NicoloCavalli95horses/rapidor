//===================
// Import
//===================
import { emit, eventBus, events } from '../../utils/eventBus.js';
import { log } from '../../utils/utils.js';
import { config } from '../../config.js';



//===================
// Const
//===================
const FILE_MIME_HINTS = [
  'json',
  'blob',
  'text',
  'image',
  'audio',
  'video',
  'pdf',
  'zip',
  'arraybuffer',
  'application',
  'octet-stream',
];


const FILE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'zip', 'rar', '7z',
  'mp4', 'mp3', 'avi',
  'css', 'js', 'json', 'xml', 'html',
  'woff', 'woff2', 'ttf', 'eot',
];


//===================
// Functions
//===================
export class analyzeHTTP {
  constructor() {
    this.segmentsHistory = [];
    this.segmentsHistoryKeys = new Set();
  }



  init() {
  }



  parseHTTP({ type = events.FETCH_EVENT, request, response }) {
    const urlObj = this.getURLObject(request?.uri);
    if (!urlObj || !this.isAllowed(urlObj)) { return; }

    // full path (hostname + port + protocol, more robust if we then will have to generate a cross-origin request)
    const fullPath = decodeURIComponent(urlObj.origin + urlObj.pathname);
    const properties = this.getProperties(urlObj);
    const fingerprint = this.getFingerprint(request);

    // query parameters
    const rawQueries = urlObj.search; // ?page=1order=asc...
    const paramsObj = this.searchParamsToObj(urlObj.searchParams); // { page:1,order:'asc' }
    const queryParams = paramsObj ? this.getParamsAnalysis({ params: paramsObj, fullPath, valuesToExclude: properties.map(p => p.value) }) : undefined;

    const analysis = {
      fullPath,
      rawQueries,
      toEvaluate: [...properties, ...queryParams]
    }

    emit({
      type: events.HTTP_EVENT, payload: {
        type,
        request: { ...request, analysis },
        response,
        doneOn: new Set(),
        ignore: request._requestId ? 1 : 0, // apparently, booleans are not valid keys in indexedDB https://stackoverflow.com/questions/13672906/indexeddb-boolean-index
        fingerprint,
      }
    });
  }



  getProperties(urlObj) {
    const properties = [];
    const pathname = urlObj.pathname;
    const hasTrailingSlash = pathname.endsWith('/');
    const segments = pathname.split('/').filter(Boolean); // ['api', 'item', 'id1'];
    const idx = this.getIndexOfSegment(segments);

    const property = this.getPropertyAt({ urlObj, segments, idx, hasTrailingSlash });
    properties.push(property);

    this.updateSegmentsHistory(segments);

    return properties;
  }



  // find the indices that vary over time while the others remain stable, considering past HTTP requests
  // returns the index of the segment to change, in the input array
  getIndexOfSegment(newSegments, segmentsHistory = this.segmentsHistory) {
    if (!segmentsHistory.length) {
      return newSegments.length - 1; // fallback
    }

    const candidateIndexes = new Set();

    for (const oldSegments of segmentsHistory) {
      const maxLength = Math.max(oldSegments.length, newSegments.length); // to compare all possible indexes
      const diffIndexes = [];

      for (let i = 0; i < maxLength; i++) {
        const a = oldSegments[i];
        const b = newSegments[i];

        if (a !== b) {
          diffIndexes.push(i);
        }
      }

      // Ideal scenario: just one difference
      if (diffIndexes.length === 1) {
        candidateIndexes.add(diffIndexes[0]);
      }
    }

    if (candidateIndexes.size === 1) {
      return [...candidateIndexes][0];
    }

    return newSegments.length - 1;
  }



  // Returns the segment of the URL to be fuzzed, considering a possible file extension
  getPropertyAt({ urlObj, segments, idx, hasTrailingSlash }) {
    if (idx < 0 || idx >= segments.length) {
      return { parts: [], value: undefined, index: -1 };
    }

    const segment = segments[idx];

    if (!segment) {
      return { parts: [], value: undefined, index: -1 };
    }

    // extension extraction
    const lastDot = segment.lastIndexOf('.');
    const hasExt = lastDot > 0;

    const value = hasExt ? segment.slice(0, lastDot) : segment;
    const ext = hasExt ? segment.slice(lastDot) : '';

    // path
    const before = segments.slice(0, idx);
    const after = segments.slice(idx + 1);

    const baseBefore = before.length ? before.join('/') + '/' : '';
    const baseAfter = after.length ? '/' + after.join('/') : '';

    const prefix = urlObj.origin + '/' + baseBefore;
    const suffix = (ext + baseAfter) + (hasTrailingSlash ? "/" : "");

    return {
      parts: [prefix, suffix],
      value,
      index: 1
    };
  }



  updateSegmentsHistory(segments) {
    const key = segments.join('/');

    if (this.segmentsHistoryKeys.has(key)) { return; }

    this.segmentsHistory.push([...segments]);
    this.segmentsHistoryKeys.add(key);

    if (this.segmentsHistory.length > config.maxSegmentsHistoryLength) {
      const removed = this.segmentsHistory.shift();
      this.segmentsHistoryKeys.delete(removed.join('/'));
    }
  }



  getParamsAnalysis({ params, fullPath, valuesToExclude = [] } = {}) {
    const result = [];
    for (const [key, value] of Object.entries(params)) {
      if (['true', 'false', ...valuesToExclude].includes(value)) { continue; }
      const parts = [`${fullPath}?${key}=`];
      result.push({ parts, value, index: 1 });
    }
    return result;
  }



  getFingerprint(request) {
    if (request) {
      const path = request.uri || request.url || request.href;
      const method = (request.verb || request.method).toLowerCase();
      return `${method}:${path}`;
    }
  }



  // we accept the same domain and all its subdomains
  isAllowed(obj) {
    if (!config.domainRequestOnly) { return true; }
    const receivedHost = obj.hostname;
    const currentHost = window.location.hostname;
    const baseDomain = this.getBaseDomain(currentHost);
    const toKeep = (receivedHost === baseDomain) || receivedHost.endsWith(`.${baseDomain}`);

    return toKeep;
  }



  getBaseDomain(hostname) {
    const parts = hostname.split('.');
    return parts.slice(-2).join('.');
  }



  getURLObject(uri) {
    if (!uri) { return; }

    try {
      return new URL(uri, window?.location?.href);
    } catch (e) {
      return;
    }
  }



  searchParamsToObj(searchParams) {
    const paramsMap = Array.from(searchParams).reduce((params, [key, val]) => params.set(key, val), new Map());
    return Object.fromEntries(paramsMap);
  }
}