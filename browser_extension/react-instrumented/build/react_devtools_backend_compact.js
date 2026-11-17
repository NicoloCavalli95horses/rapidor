/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "../../node_modules/compare-versions/lib/esm/index.js":
/*!************************************************************!*\
  !*** ../../node_modules/compare-versions/lib/esm/index.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "compare": () => (/* binding */ compare),
/* harmony export */   "compareVersions": () => (/* binding */ compareVersions),
/* harmony export */   "satisfies": () => (/* binding */ satisfies),
/* harmony export */   "validate": () => (/* binding */ validate)
/* harmony export */ });
const compareVersions = (v1, v2) => {
  const n1 = validateAndParse(v1);
  const n2 = validateAndParse(v2);
  const p1 = n1.pop();
  const p2 = n2.pop();
  const r = compareSegments(n1, n2);
  if (r !== 0) return r;
  if (p1 && p2) {
    return compareSegments(p1.split('.'), p2.split('.'));
  } else if (p1 || p2) {
    return p1 ? -1 : 1;
  }
  return 0;
};
const validate = version => typeof version === 'string' && /^[v\d]/.test(version) && semver.test(version);
const compare = (v1, v2, operator) => {
  assertValidOperator(operator);
  const res = compareVersions(v1, v2);
  return operatorResMap[operator].includes(res);
};
const satisfies = (version, range) => {
  const m = range.match(/^([<>=~^]+)/);
  const op = m ? m[1] : '=';
  if (op !== '^' && op !== '~') return compare(version, range, op);
  const [v1, v2, v3,, vp] = validateAndParse(version);
  const [r1, r2, r3,, rp] = validateAndParse(range);
  const v = [v1, v2, v3];
  const r = [r1, r2 !== null && r2 !== void 0 ? r2 : 'x', r3 !== null && r3 !== void 0 ? r3 : 'x'];
  if (rp) {
    if (!vp) return false;
    if (compareSegments(v, r) !== 0) return false;
    if (compareSegments(vp.split('.'), rp.split('.')) === -1) return false;
  }
  const nonZero = r.findIndex(v => v !== '0') + 1;
  const i = op === '~' ? 2 : nonZero > 1 ? nonZero : 1;
  if (compareSegments(v.slice(0, i), r.slice(0, i)) !== 0) return false;
  if (compareSegments(v.slice(i), r.slice(i)) === -1) return false;
  return true;
};
const semver = /^[v^~<>=]*?(\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+))?(?:-([\da-z\-]+(?:\.[\da-z\-]+)*))?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;
const validateAndParse = version => {
  if (typeof version !== 'string') {
    throw new TypeError('Invalid argument expected string');
  }
  const match = version.match(semver);
  if (!match) {
    throw new Error(`Invalid argument not valid semver ('${version}' received)`);
  }
  match.shift();
  return match;
};
const isWildcard = s => s === '*' || s === 'x' || s === 'X';
const tryParse = v => {
  const n = parseInt(v, 10);
  return isNaN(n) ? v : n;
};
const forceType = (a, b) => typeof a !== typeof b ? [String(a), String(b)] : [a, b];
const compareStrings = (a, b) => {
  if (isWildcard(a) || isWildcard(b)) return 0;
  const [ap, bp] = forceType(tryParse(a), tryParse(b));
  if (ap > bp) return 1;
  if (ap < bp) return -1;
  return 0;
};
const compareSegments = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const r = compareStrings(a[i] || '0', b[i] || '0');
    if (r !== 0) return r;
  }
  return 0;
};
const operatorResMap = {
  '>': [1],
  '>=': [0, 1],
  '=': [0],
  '<=': [-1, 0],
  '<': [-1]
};
const allowedOperators = Object.keys(operatorResMap);
const assertValidOperator = op => {
  if (typeof op !== 'string') {
    throw new TypeError(`Invalid operator type, expected string but got ${typeof op}`);
  }
  if (allowedOperators.indexOf(op) === -1) {
    throw new Error(`Invalid operator, expected one of ${allowedOperators.join('|')}`);
  }
};

/***/ }),

/***/ "../../node_modules/lru-cache/index.js":
/*!*********************************************!*\
  !*** ../../node_modules/lru-cache/index.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


const Yallist = __webpack_require__(/*! yallist */ "../../node_modules/yallist/yallist.js");
const MAX = Symbol('max');
const LENGTH = Symbol('length');
const LENGTH_CALCULATOR = Symbol('lengthCalculator');
const ALLOW_STALE = Symbol('allowStale');
const MAX_AGE = Symbol('maxAge');
const DISPOSE = Symbol('dispose');
const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet');
const LRU_LIST = Symbol('lruList');
const CACHE = Symbol('cache');
const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet');
const naiveLength = () => 1;
class LRUCache {
  constructor(options) {
    if (typeof options === 'number') options = {
      max: options
    };
    if (!options) options = {};
    if (options.max && (typeof options.max !== 'number' || options.max < 0)) throw new TypeError('max must be a non-negative number');
    const max = this[MAX] = options.max || Infinity;
    const lc = options.length || naiveLength;
    this[LENGTH_CALCULATOR] = typeof lc !== 'function' ? naiveLength : lc;
    this[ALLOW_STALE] = options.stale || false;
    if (options.maxAge && typeof options.maxAge !== 'number') throw new TypeError('maxAge must be a number');
    this[MAX_AGE] = options.maxAge || 0;
    this[DISPOSE] = options.dispose;
    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false;
    this.reset();
  }
  set max(mL) {
    if (typeof mL !== 'number' || mL < 0) throw new TypeError('max must be a non-negative number');
    this[MAX] = mL || Infinity;
    trim(this);
  }
  get max() {
    return this[MAX];
  }
  set allowStale(allowStale) {
    this[ALLOW_STALE] = !!allowStale;
  }
  get allowStale() {
    return this[ALLOW_STALE];
  }
  set maxAge(mA) {
    if (typeof mA !== 'number') throw new TypeError('maxAge must be a non-negative number');
    this[MAX_AGE] = mA;
    trim(this);
  }
  get maxAge() {
    return this[MAX_AGE];
  }
  set lengthCalculator(lC) {
    if (typeof lC !== 'function') lC = naiveLength;
    if (lC !== this[LENGTH_CALCULATOR]) {
      this[LENGTH_CALCULATOR] = lC;
      this[LENGTH] = 0;
      this[LRU_LIST].forEach(hit => {
        hit.length = this[LENGTH_CALCULATOR](hit.value, hit.key);
        this[LENGTH] += hit.length;
      });
    }
    trim(this);
  }
  get lengthCalculator() {
    return this[LENGTH_CALCULATOR];
  }
  get length() {
    return this[LENGTH];
  }
  get itemCount() {
    return this[LRU_LIST].length;
  }
  rforEach(fn, thisp) {
    thisp = thisp || this;
    for (let walker = this[LRU_LIST].tail; walker !== null;) {
      const prev = walker.prev;
      forEachStep(this, fn, walker, thisp);
      walker = prev;
    }
  }
  forEach(fn, thisp) {
    thisp = thisp || this;
    for (let walker = this[LRU_LIST].head; walker !== null;) {
      const next = walker.next;
      forEachStep(this, fn, walker, thisp);
      walker = next;
    }
  }
  keys() {
    return this[LRU_LIST].toArray().map(k => k.key);
  }
  values() {
    return this[LRU_LIST].toArray().map(k => k.value);
  }
  reset() {
    if (this[DISPOSE] && this[LRU_LIST] && this[LRU_LIST].length) {
      this[LRU_LIST].forEach(hit => this[DISPOSE](hit.key, hit.value));
    }
    this[CACHE] = new Map();
    this[LRU_LIST] = new Yallist();
    this[LENGTH] = 0;
  }
  dump() {
    return this[LRU_LIST].map(hit => isStale(this, hit) ? false : {
      k: hit.key,
      v: hit.value,
      e: hit.now + (hit.maxAge || 0)
    }).toArray().filter(h => h);
  }
  dumpLru() {
    return this[LRU_LIST];
  }
  set(key, value, maxAge) {
    maxAge = maxAge || this[MAX_AGE];
    if (maxAge && typeof maxAge !== 'number') throw new TypeError('maxAge must be a number');
    const now = maxAge ? Date.now() : 0;
    const len = this[LENGTH_CALCULATOR](value, key);
    if (this[CACHE].has(key)) {
      if (len > this[MAX]) {
        del(this, this[CACHE].get(key));
        return false;
      }
      const node = this[CACHE].get(key);
      const item = node.value;
      if (this[DISPOSE]) {
        if (!this[NO_DISPOSE_ON_SET]) this[DISPOSE](key, item.value);
      }
      item.now = now;
      item.maxAge = maxAge;
      item.value = value;
      this[LENGTH] += len - item.length;
      item.length = len;
      this.get(key);
      trim(this);
      return true;
    }
    const hit = new Entry(key, value, len, now, maxAge);
    if (hit.length > this[MAX]) {
      if (this[DISPOSE]) this[DISPOSE](key, value);
      return false;
    }
    this[LENGTH] += hit.length;
    this[LRU_LIST].unshift(hit);
    this[CACHE].set(key, this[LRU_LIST].head);
    trim(this);
    return true;
  }
  has(key) {
    if (!this[CACHE].has(key)) return false;
    const hit = this[CACHE].get(key).value;
    return !isStale(this, hit);
  }
  get(key) {
    return get(this, key, true);
  }
  peek(key) {
    return get(this, key, false);
  }
  pop() {
    const node = this[LRU_LIST].tail;
    if (!node) return null;
    del(this, node);
    return node.value;
  }
  del(key) {
    del(this, this[CACHE].get(key));
  }
  load(arr) {
    this.reset();
    const now = Date.now();
    for (let l = arr.length - 1; l >= 0; l--) {
      const hit = arr[l];
      const expiresAt = hit.e || 0;
      if (expiresAt === 0) this.set(hit.k, hit.v);else {
        const maxAge = expiresAt - now;
        if (maxAge > 0) {
          this.set(hit.k, hit.v, maxAge);
        }
      }
    }
  }
  prune() {
    this[CACHE].forEach((value, key) => get(this, key, false));
  }
}
const get = (self, key, doUse) => {
  const node = self[CACHE].get(key);
  if (node) {
    const hit = node.value;
    if (isStale(self, hit)) {
      del(self, node);
      if (!self[ALLOW_STALE]) return undefined;
    } else {
      if (doUse) {
        if (self[UPDATE_AGE_ON_GET]) node.value.now = Date.now();
        self[LRU_LIST].unshiftNode(node);
      }
    }
    return hit.value;
  }
};
const isStale = (self, hit) => {
  if (!hit || !hit.maxAge && !self[MAX_AGE]) return false;
  const diff = Date.now() - hit.now;
  return hit.maxAge ? diff > hit.maxAge : self[MAX_AGE] && diff > self[MAX_AGE];
};
const trim = self => {
  if (self[LENGTH] > self[MAX]) {
    for (let walker = self[LRU_LIST].tail; self[LENGTH] > self[MAX] && walker !== null;) {
      const prev = walker.prev;
      del(self, walker);
      walker = prev;
    }
  }
};
const del = (self, node) => {
  if (node) {
    const hit = node.value;
    if (self[DISPOSE]) self[DISPOSE](hit.key, hit.value);
    self[LENGTH] -= hit.length;
    self[CACHE].delete(hit.key);
    self[LRU_LIST].removeNode(node);
  }
};
class Entry {
  constructor(key, value, length, now, maxAge) {
    this.key = key;
    this.value = value;
    this.length = length;
    this.now = now;
    this.maxAge = maxAge || 0;
  }
}
const forEachStep = (self, fn, node, thisp) => {
  let hit = node.value;
  if (isStale(self, hit)) {
    del(self, node);
    if (!self[ALLOW_STALE]) hit = undefined;
  }
  if (hit) fn.call(thisp, hit.value, hit.key, self);
};
module.exports = LRUCache;

/***/ }),

/***/ "../../node_modules/process/browser.js":
/*!*********************************************!*\
  !*** ../../node_modules/process/browser.js ***!
  \*********************************************/
/***/ ((module) => {

var process = module.exports = {};
var cachedSetTimeout;
var cachedClearTimeout;
function defaultSetTimout() {
  throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout() {
  throw new Error('clearTimeout has not been defined');
}
(function () {
  try {
    if (typeof setTimeout === 'function') {
      cachedSetTimeout = setTimeout;
    } else {
      cachedSetTimeout = defaultSetTimout;
    }
  } catch (e) {
    cachedSetTimeout = defaultSetTimout;
  }
  try {
    if (typeof clearTimeout === 'function') {
      cachedClearTimeout = clearTimeout;
    } else {
      cachedClearTimeout = defaultClearTimeout;
    }
  } catch (e) {
    cachedClearTimeout = defaultClearTimeout;
  }
})();
function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    return setTimeout(fun, 0);
  }
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }
  try {
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e) {
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    return clearTimeout(marker);
  }
  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }
  try {
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      return cachedClearTimeout.call(null, marker);
    } catch (e) {
      return cachedClearTimeout.call(this, marker);
    }
  }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }
  draining = false;
  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }
  if (queue.length) {
    drainQueue();
  }
}
function drainQueue() {
  if (draining) {
    return;
  }
  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;
  while (len) {
    currentQueue = queue;
    queue = [];
    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }
    queueIndex = -1;
    len = queue.length;
  }
  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}
process.nextTick = function (fun) {
  var args = new Array(arguments.length - 1);
  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }
  queue.push(new Item(fun, args));
  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
};
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
Item.prototype.run = function () {
  this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = '';
process.versions = {};
function noop() {}
process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;
process.listeners = function (name) {
  return [];
};
process.binding = function (name) {
  throw new Error('process.binding is not supported');
};
process.cwd = function () {
  return '/';
};
process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};
process.umask = function () {
  return 0;
};

/***/ }),

/***/ "../../node_modules/yallist/iterator.js":
/*!**********************************************!*\
  !*** ../../node_modules/yallist/iterator.js ***!
  \**********************************************/
/***/ ((module) => {

"use strict";


module.exports = function (Yallist) {
  Yallist.prototype[Symbol.iterator] = function* () {
    for (let walker = this.head; walker; walker = walker.next) {
      yield walker.value;
    }
  };
};

/***/ }),

/***/ "../../node_modules/yallist/yallist.js":
/*!*********************************************!*\
  !*** ../../node_modules/yallist/yallist.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


module.exports = Yallist;
Yallist.Node = Node;
Yallist.create = Yallist;
function Yallist(list) {
  var self = this;
  if (!(self instanceof Yallist)) {
    self = new Yallist();
  }
  self.tail = null;
  self.head = null;
  self.length = 0;
  if (list && typeof list.forEach === 'function') {
    list.forEach(function (item) {
      self.push(item);
    });
  } else if (arguments.length > 0) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      self.push(arguments[i]);
    }
  }
  return self;
}
Yallist.prototype.removeNode = function (node) {
  if (node.list !== this) {
    throw new Error('removing node which does not belong to this list');
  }
  var next = node.next;
  var prev = node.prev;
  if (next) {
    next.prev = prev;
  }
  if (prev) {
    prev.next = next;
  }
  if (node === this.head) {
    this.head = next;
  }
  if (node === this.tail) {
    this.tail = prev;
  }
  node.list.length--;
  node.next = null;
  node.prev = null;
  node.list = null;
  return next;
};
Yallist.prototype.unshiftNode = function (node) {
  if (node === this.head) {
    return;
  }
  if (node.list) {
    node.list.removeNode(node);
  }
  var head = this.head;
  node.list = this;
  node.next = head;
  if (head) {
    head.prev = node;
  }
  this.head = node;
  if (!this.tail) {
    this.tail = node;
  }
  this.length++;
};
Yallist.prototype.pushNode = function (node) {
  if (node === this.tail) {
    return;
  }
  if (node.list) {
    node.list.removeNode(node);
  }
  var tail = this.tail;
  node.list = this;
  node.prev = tail;
  if (tail) {
    tail.next = node;
  }
  this.tail = node;
  if (!this.head) {
    this.head = node;
  }
  this.length++;
};
Yallist.prototype.push = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    push(this, arguments[i]);
  }
  return this.length;
};
Yallist.prototype.unshift = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    unshift(this, arguments[i]);
  }
  return this.length;
};
Yallist.prototype.pop = function () {
  if (!this.tail) {
    return undefined;
  }
  var res = this.tail.value;
  this.tail = this.tail.prev;
  if (this.tail) {
    this.tail.next = null;
  } else {
    this.head = null;
  }
  this.length--;
  return res;
};
Yallist.prototype.shift = function () {
  if (!this.head) {
    return undefined;
  }
  var res = this.head.value;
  this.head = this.head.next;
  if (this.head) {
    this.head.prev = null;
  } else {
    this.tail = null;
  }
  this.length--;
  return res;
};
Yallist.prototype.forEach = function (fn, thisp) {
  thisp = thisp || this;
  for (var walker = this.head, i = 0; walker !== null; i++) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.next;
  }
};
Yallist.prototype.forEachReverse = function (fn, thisp) {
  thisp = thisp || this;
  for (var walker = this.tail, i = this.length - 1; walker !== null; i--) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.prev;
  }
};
Yallist.prototype.get = function (n) {
  for (var i = 0, walker = this.head; walker !== null && i < n; i++) {
    walker = walker.next;
  }
  if (i === n && walker !== null) {
    return walker.value;
  }
};
Yallist.prototype.getReverse = function (n) {
  for (var i = 0, walker = this.tail; walker !== null && i < n; i++) {
    walker = walker.prev;
  }
  if (i === n && walker !== null) {
    return walker.value;
  }
};
Yallist.prototype.map = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();
  for (var walker = this.head; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.next;
  }
  return res;
};
Yallist.prototype.mapReverse = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();
  for (var walker = this.tail; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.prev;
  }
  return res;
};
Yallist.prototype.reduce = function (fn, initial) {
  var acc;
  var walker = this.head;
  if (arguments.length > 1) {
    acc = initial;
  } else if (this.head) {
    walker = this.head.next;
    acc = this.head.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }
  for (var i = 0; walker !== null; i++) {
    acc = fn(acc, walker.value, i);
    walker = walker.next;
  }
  return acc;
};
Yallist.prototype.reduceReverse = function (fn, initial) {
  var acc;
  var walker = this.tail;
  if (arguments.length > 1) {
    acc = initial;
  } else if (this.tail) {
    walker = this.tail.prev;
    acc = this.tail.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }
  for (var i = this.length - 1; walker !== null; i--) {
    acc = fn(acc, walker.value, i);
    walker = walker.prev;
  }
  return acc;
};
Yallist.prototype.toArray = function () {
  var arr = new Array(this.length);
  for (var i = 0, walker = this.head; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.next;
  }
  return arr;
};
Yallist.prototype.toArrayReverse = function () {
  var arr = new Array(this.length);
  for (var i = 0, walker = this.tail; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.prev;
  }
  return arr;
};
Yallist.prototype.slice = function (from, to) {
  to = to || this.length;
  if (to < 0) {
    to += this.length;
  }
  from = from || 0;
  if (from < 0) {
    from += this.length;
  }
  var ret = new Yallist();
  if (to < from || to < 0) {
    return ret;
  }
  if (from < 0) {
    from = 0;
  }
  if (to > this.length) {
    to = this.length;
  }
  for (var i = 0, walker = this.head; walker !== null && i < from; i++) {
    walker = walker.next;
  }
  for (; walker !== null && i < to; i++, walker = walker.next) {
    ret.push(walker.value);
  }
  return ret;
};
Yallist.prototype.sliceReverse = function (from, to) {
  to = to || this.length;
  if (to < 0) {
    to += this.length;
  }
  from = from || 0;
  if (from < 0) {
    from += this.length;
  }
  var ret = new Yallist();
  if (to < from || to < 0) {
    return ret;
  }
  if (from < 0) {
    from = 0;
  }
  if (to > this.length) {
    to = this.length;
  }
  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
    walker = walker.prev;
  }
  for (; walker !== null && i > from; i--, walker = walker.prev) {
    ret.push(walker.value);
  }
  return ret;
};
Yallist.prototype.splice = function (start, deleteCount) {
  if (start > this.length) {
    start = this.length - 1;
  }
  if (start < 0) {
    start = this.length + start;
  }
  for (var i = 0, walker = this.head; walker !== null && i < start; i++) {
    walker = walker.next;
  }
  var ret = [];
  for (var i = 0; walker && i < deleteCount; i++) {
    ret.push(walker.value);
    walker = this.removeNode(walker);
  }
  if (walker === null) {
    walker = this.tail;
  }
  if (walker !== this.head && walker !== this.tail) {
    walker = walker.prev;
  }
  for (var i = 2; i < arguments.length; i++) {
    walker = insert(this, walker, arguments[i]);
  }
  return ret;
};
Yallist.prototype.reverse = function () {
  var head = this.head;
  var tail = this.tail;
  for (var walker = head; walker !== null; walker = walker.prev) {
    var p = walker.prev;
    walker.prev = walker.next;
    walker.next = p;
  }
  this.head = tail;
  this.tail = head;
  return this;
};
function insert(self, node, value) {
  var inserted = node === self.head ? new Node(value, null, node, self) : new Node(value, node, node.next, self);
  if (inserted.next === null) {
    self.tail = inserted;
  }
  if (inserted.prev === null) {
    self.head = inserted;
  }
  self.length++;
  return inserted;
}
function push(self, item) {
  self.tail = new Node(item, self.tail, null, self);
  if (!self.head) {
    self.head = self.tail;
  }
  self.length++;
}
function unshift(self, item) {
  self.head = new Node(item, null, self.head, self);
  if (!self.tail) {
    self.tail = self.head;
  }
  self.length++;
}
function Node(value, prev, next, list) {
  if (!(this instanceof Node)) {
    return new Node(value, prev, next, list);
  }
  this.list = list;
  this.value = value;
  if (prev) {
    prev.next = this;
    this.prev = prev;
  } else {
    this.prev = null;
  }
  if (next) {
    next.prev = this;
    this.next = next;
  } else {
    this.next = null;
  }
}
try {
  __webpack_require__(/*! ./iterator.js */ "../../node_modules/yallist/iterator.js")(Yallist);
} catch (er) {}

/***/ }),

/***/ "./src/utils.js":
/*!**********************!*\
  !*** ./src/utils.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COMPACT_VERSION_NAME": () => (/* binding */ COMPACT_VERSION_NAME),
/* harmony export */   "EXTENSION_CONTAINED_VERSIONS": () => (/* binding */ EXTENSION_CONTAINED_VERSIONS),
/* harmony export */   "getBrowserTheme": () => (/* binding */ getBrowserTheme)
/* harmony export */ });
function getBrowserTheme() {
  if (true) {
    return chrome.devtools.panels.themeName === 'dark' ? 'dark' : 'light';
  } else {}
}
const COMPACT_VERSION_NAME = 'compact';
const EXTENSION_CONTAINED_VERSIONS = [COMPACT_VERSION_NAME];

/***/ }),

/***/ "../react-devtools-shared/src/backend/NativeStyleEditor/resolveBoxStyle.js":
/*!*********************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/NativeStyleEditor/resolveBoxStyle.js ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ resolveBoxStyle)
/* harmony export */ });
function resolveBoxStyle(prefix, style) {
  let hasParts = false;
  const result = {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0
  };
  const styleForAll = style[prefix];
  if (styleForAll != null) {
    for (const key of Object.keys(result)) {
      result[key] = styleForAll;
    }
    hasParts = true;
  }
  const styleForHorizontal = style[prefix + 'Horizontal'];
  if (styleForHorizontal != null) {
    result.left = styleForHorizontal;
    result.right = styleForHorizontal;
    hasParts = true;
  } else {
    const styleForLeft = style[prefix + 'Left'];
    if (styleForLeft != null) {
      result.left = styleForLeft;
      hasParts = true;
    }
    const styleForRight = style[prefix + 'Right'];
    if (styleForRight != null) {
      result.right = styleForRight;
      hasParts = true;
    }
    const styleForEnd = style[prefix + 'End'];
    if (styleForEnd != null) {
      result.right = styleForEnd;
      hasParts = true;
    }
    const styleForStart = style[prefix + 'Start'];
    if (styleForStart != null) {
      result.left = styleForStart;
      hasParts = true;
    }
  }
  const styleForVertical = style[prefix + 'Vertical'];
  if (styleForVertical != null) {
    result.bottom = styleForVertical;
    result.top = styleForVertical;
    hasParts = true;
  } else {
    const styleForBottom = style[prefix + 'Bottom'];
    if (styleForBottom != null) {
      result.bottom = styleForBottom;
      hasParts = true;
    }
    const styleForTop = style[prefix + 'Top'];
    if (styleForTop != null) {
      result.top = styleForTop;
      hasParts = true;
    }
  }
  return hasParts ? result : null;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/NativeStyleEditor/setupNativeStyleEditor.js":
/*!****************************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/NativeStyleEditor/setupNativeStyleEditor.js ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ setupNativeStyleEditor)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_backend_agent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/backend/agent */ "../react-devtools-shared/src/backend/agent.js");
/* harmony import */ var _resolveBoxStyle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./resolveBoxStyle */ "../react-devtools-shared/src/backend/NativeStyleEditor/resolveBoxStyle.js");
/* harmony import */ var react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-devtools-shared/src/isArray */ "../react-devtools-shared/src/isArray.js");



function setupNativeStyleEditor(bridge, agent, resolveNativeStyle, validAttributes) {
  bridge.addListener('NativeStyleEditor_measure', ({
    id,
    rendererID
  }) => {
    measureStyle(agent, bridge, resolveNativeStyle, id, rendererID);
  });
  bridge.addListener('NativeStyleEditor_renameAttribute', ({
    id,
    rendererID,
    oldName,
    newName,
    value
  }) => {
    renameStyle(agent, id, rendererID, oldName, newName, value);
    setTimeout(() => measureStyle(agent, bridge, resolveNativeStyle, id, rendererID));
  });
  bridge.addListener('NativeStyleEditor_setValue', ({
    id,
    rendererID,
    name,
    value
  }) => {
    setStyle(agent, id, rendererID, name, value);
    setTimeout(() => measureStyle(agent, bridge, resolveNativeStyle, id, rendererID));
  });
  bridge.send('isNativeStyleEditorSupported', {
    isSupported: true,
    validAttributes
  });
}
const EMPTY_BOX_STYLE = {
  top: 0,
  left: 0,
  right: 0,
  bottom: 0
};
const componentIDToStyleOverrides = new Map();
function measureStyle(agent, bridge, resolveNativeStyle, id, rendererID) {
  const data = agent.getInstanceAndStyle({
    id,
    rendererID
  });
  if (!data || !data.style) {
    bridge.send('NativeStyleEditor_styleAndLayout', {
      id,
      layout: null,
      style: null
    });
    return;
  }
  const {
    instance,
    style
  } = data;
  let resolvedStyle = resolveNativeStyle(style);
  const styleOverrides = componentIDToStyleOverrides.get(id);
  if (styleOverrides != null) {
    resolvedStyle = Object.assign({}, resolvedStyle, styleOverrides);
  }
  if (!instance || typeof instance.measure !== 'function') {
    bridge.send('NativeStyleEditor_styleAndLayout', {
      id,
      layout: null,
      style: resolvedStyle || null
    });
    return;
  }
  instance.measure((x, y, width, height, left, top) => {
    if (typeof x !== 'number') {
      bridge.send('NativeStyleEditor_styleAndLayout', {
        id,
        layout: null,
        style: resolvedStyle || null
      });
      return;
    }
    const margin = resolvedStyle != null && (0,_resolveBoxStyle__WEBPACK_IMPORTED_MODULE_1__["default"])('margin', resolvedStyle) || EMPTY_BOX_STYLE;
    const padding = resolvedStyle != null && (0,_resolveBoxStyle__WEBPACK_IMPORTED_MODULE_1__["default"])('padding', resolvedStyle) || EMPTY_BOX_STYLE;
    bridge.send('NativeStyleEditor_styleAndLayout', {
      id,
      layout: {
        x,
        y,
        width,
        height,
        left,
        top,
        margin,
        padding
      },
      style: resolvedStyle || null
    });
  });
}
function shallowClone(object) {
  const cloned = {};
  for (const n in object) {
    cloned[n] = object[n];
  }
  return cloned;
}
function renameStyle(agent, id, rendererID, oldName, newName, value) {
  const data = agent.getInstanceAndStyle({
    id,
    rendererID
  });
  if (!data || !data.style) {
    return;
  }
  const {
    instance,
    style
  } = data;
  const newStyle = newName ? {
    [oldName]: undefined,
    [newName]: value
  } : {
    [oldName]: undefined
  };
  let customStyle;
  if (instance !== null && typeof instance.setNativeProps === 'function') {
    const styleOverrides = componentIDToStyleOverrides.get(id);
    if (!styleOverrides) {
      componentIDToStyleOverrides.set(id, newStyle);
    } else {
      Object.assign(styleOverrides, newStyle);
    }
    instance.setNativeProps({
      style: newStyle
    });
  } else if ((0,react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_2__["default"])(style)) {
    const lastIndex = style.length - 1;
    if (typeof style[lastIndex] === 'object' && !(0,react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_2__["default"])(style[lastIndex])) {
      customStyle = shallowClone(style[lastIndex]);
      delete customStyle[oldName];
      if (newName) {
        customStyle[newName] = value;
      } else {
        customStyle[oldName] = undefined;
      }
      agent.overrideValueAtPath({
        type: 'props',
        id,
        rendererID,
        path: ['style', lastIndex],
        value: customStyle
      });
    } else {
      agent.overrideValueAtPath({
        type: 'props',
        id,
        rendererID,
        path: ['style'],
        value: style.concat([newStyle])
      });
    }
  } else if (typeof style === 'object') {
    customStyle = shallowClone(style);
    delete customStyle[oldName];
    if (newName) {
      customStyle[newName] = value;
    } else {
      customStyle[oldName] = undefined;
    }
    agent.overrideValueAtPath({
      type: 'props',
      id,
      rendererID,
      path: ['style'],
      value: customStyle
    });
  } else {
    agent.overrideValueAtPath({
      type: 'props',
      id,
      rendererID,
      path: ['style'],
      value: [style, newStyle]
    });
  }
  agent.emit('hideNativeHighlight');
}
function setStyle(agent, id, rendererID, name, value) {
  const data = agent.getInstanceAndStyle({
    id,
    rendererID
  });
  if (!data || !data.style) {
    return;
  }
  const {
    instance,
    style
  } = data;
  const newStyle = {
    [name]: value
  };
  if (instance !== null && typeof instance.setNativeProps === 'function') {
    const styleOverrides = componentIDToStyleOverrides.get(id);
    if (!styleOverrides) {
      componentIDToStyleOverrides.set(id, newStyle);
    } else {
      Object.assign(styleOverrides, newStyle);
    }
    instance.setNativeProps({
      style: newStyle
    });
  } else if ((0,react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_2__["default"])(style)) {
    const lastLength = style.length - 1;
    if (typeof style[lastLength] === 'object' && !(0,react_devtools_shared_src_isArray__WEBPACK_IMPORTED_MODULE_2__["default"])(style[lastLength])) {
      agent.overrideValueAtPath({
        type: 'props',
        id,
        rendererID,
        path: ['style', lastLength, name],
        value
      });
    } else {
      agent.overrideValueAtPath({
        type: 'props',
        id,
        rendererID,
        path: ['style'],
        value: style.concat([newStyle])
      });
    }
  } else {
    agent.overrideValueAtPath({
      type: 'props',
      id,
      rendererID,
      path: ['style'],
      value: [style, newStyle]
    });
  }
  agent.emit('hideNativeHighlight');
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/agent.js":
/*!*****************************************************!*\
  !*** ../react-devtools-shared/src/backend/agent.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Agent)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../events */ "../react-devtools-shared/src/events.js");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../constants */ "../react-devtools-shared/src/constants.js");
/* harmony import */ var _views_Highlighter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./views/Highlighter */ "../react-devtools-shared/src/backend/views/Highlighter/index.js");
/* harmony import */ var _views_TraceUpdates__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./views/TraceUpdates */ "../react-devtools-shared/src/backend/views/TraceUpdates/index.js");
/* harmony import */ var react_devtools_shared_src_bridge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-devtools-shared/src/bridge */ "../react-devtools-shared/src/bridge.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./utils */ "../react-devtools-shared/src/backend/utils/index.js");
/* harmony import */ var _storage__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../storage */ "../react-devtools-shared/src/storage.js");
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }







const debug = (methodName, ...args) => {
  if (_constants__WEBPACK_IMPORTED_MODULE_1__.__DEBUG__) {
    console.log(`%cAgent %c${methodName}`, 'color: purple; font-weight: bold;', 'font-weight: bold;', ...args);
  }
};
function createEmptyInspectedScreen(arbitraryRootID, type) {
  const suspendedBy = {
    cleaned: [],
    data: [],
    unserializable: []
  };
  return {
    id: arbitraryRootID,
    type: type,
    isErrored: false,
    errors: [],
    warnings: [],
    suspendedBy,
    suspendedByRange: null,
    unknownSuspenders: _constants__WEBPACK_IMPORTED_MODULE_1__.UNKNOWN_SUSPENDERS_NONE,
    rootType: null,
    plugins: {
      stylex: null
    },
    nativeTag: null,
    env: null,
    source: null,
    stack: null,
    rendererPackageName: null,
    rendererVersion: null,
    key: null,
    canEditFunctionProps: false,
    canEditHooks: false,
    canEditFunctionPropsDeletePaths: false,
    canEditFunctionPropsRenamePaths: false,
    canEditHooksAndDeletePaths: false,
    canEditHooksAndRenamePaths: false,
    canToggleError: false,
    canToggleSuspense: false,
    isSuspended: false,
    hasLegacyContext: false,
    context: null,
    hooks: null,
    props: null,
    state: null,
    owners: null
  };
}
function mergeRoots(left, right, suspendedByOffset) {
  const leftSuspendedByRange = left.suspendedByRange;
  const rightSuspendedByRange = right.suspendedByRange;
  if (right.isErrored) {
    left.isErrored = true;
  }
  for (let i = 0; i < right.errors.length; i++) {
    left.errors.push(right.errors[i]);
  }
  for (let i = 0; i < right.warnings.length; i++) {
    left.warnings.push(right.warnings[i]);
  }
  const leftSuspendedBy = left.suspendedBy;
  const {
    data,
    cleaned,
    unserializable
  } = right.suspendedBy;
  const leftSuspendedByData = leftSuspendedBy.data;
  const rightSuspendedByData = data;
  for (let i = 0; i < rightSuspendedByData.length; i++) {
    leftSuspendedByData.push(rightSuspendedByData[i]);
  }
  for (let i = 0; i < cleaned.length; i++) {
    leftSuspendedBy.cleaned.push([suspendedByOffset + cleaned[i][0]].concat(cleaned[i].slice(1)));
  }
  for (let i = 0; i < unserializable.length; i++) {
    leftSuspendedBy.unserializable.push([suspendedByOffset + unserializable[i][0]].concat(unserializable[i].slice(1)));
  }
  if (rightSuspendedByRange !== null) {
    if (leftSuspendedByRange === null) {
      left.suspendedByRange = [rightSuspendedByRange[0], rightSuspendedByRange[1]];
    } else {
      if (rightSuspendedByRange[0] < leftSuspendedByRange[0]) {
        leftSuspendedByRange[0] = rightSuspendedByRange[0];
      }
      if (rightSuspendedByRange[1] > leftSuspendedByRange[1]) {
        leftSuspendedByRange[1] = rightSuspendedByRange[1];
      }
    }
  }
}
class Agent extends _events__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor(bridge, isProfiling = false, onReloadAndProfile) {
    super();
    _defineProperty(this, "_isProfiling", false);
    _defineProperty(this, "_rendererInterfaces", {});
    _defineProperty(this, "_persistedSelection", null);
    _defineProperty(this, "_persistedSelectionMatch", null);
    _defineProperty(this, "_traceUpdatesEnabled", false);
    _defineProperty(this, "clearErrorsAndWarnings", ({
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}"`);
      } else {
        renderer.clearErrorsAndWarnings();
      }
    });
    _defineProperty(this, "clearErrorsForElementID", ({
      id,
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}"`);
      } else {
        renderer.clearErrorsForElementID(id);
      }
    });
    _defineProperty(this, "clearWarningsForElementID", ({
      id,
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}"`);
      } else {
        renderer.clearWarningsForElementID(id);
      }
    });
    _defineProperty(this, "copyElementPath", ({
      id,
      path,
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        const value = renderer.getSerializedElementValueByPath(id, path);
        if (value != null) {
          this._bridge.send('saveToClipboard', value);
        } else {
          console.warn(`Unable to obtain serialized value for element "${id}"`);
        }
      }
    });
    _defineProperty(this, "deletePath", ({
      hookID,
      id,
      path,
      rendererID,
      type
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        renderer.deletePath(type, id, hookID, path);
      }
    });
    _defineProperty(this, "getBackendVersion", () => {
      const version = "8.0.0-4b1a608960";
      if (version) {
        this._bridge.send('backendVersion', version);
      }
    });
    _defineProperty(this, "getBridgeProtocol", () => {
      this._bridge.send('bridgeProtocol', react_devtools_shared_src_bridge__WEBPACK_IMPORTED_MODULE_4__.currentBridgeProtocol);
    });
    _defineProperty(this, "getProfilingData", ({
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}"`);
      }
      this._bridge.send('profilingData', renderer.getProfilingData());
    });
    _defineProperty(this, "getProfilingStatus", () => {
      this._bridge.send('profilingStatus', this._isProfiling);
    });
    _defineProperty(this, "getOwnersList", ({
      id,
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        const owners = renderer.getOwnersList(id);
        this._bridge.send('ownersList', {
          id,
          owners
        });
      }
    });
    _defineProperty(this, "inspectElement", ({
      forceFullData,
      id,
      path,
      rendererID,
      requestID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        this._bridge.send('inspectedElement', renderer.inspectElement(requestID, id, path, forceFullData));
        if (this._persistedSelectionMatch === null || this._persistedSelectionMatch.id !== id) {
          this._persistedSelection = null;
          this._persistedSelectionMatch = null;
          renderer.setTrackedPath(null);
          this._lastSelectedElementID = id;
          this._lastSelectedRendererID = rendererID;
          if (!this._persistSelectionTimerScheduled) {
            this._persistSelectionTimerScheduled = true;
            setTimeout(this._persistSelection, 1000);
          }
        }
      }
    });
    _defineProperty(this, "inspectScreen", ({
      requestID,
      id,
      forceFullData,
      path: screenPath
    }) => {
      let inspectedScreen = null;
      let found = false;
      let suspendedByOffset = 0;
      let suspendedByPathIndex = null;
      let rendererPath = null;
      if (screenPath !== null && screenPath.length > 1) {
        const secondaryCategory = screenPath[0];
        if (secondaryCategory !== 'suspendedBy') {
          throw new Error('Only hydrating suspendedBy paths is supported. This is a bug.');
        }
        if (typeof screenPath[1] !== 'number') {
          throw new Error(`Expected suspendedBy index to be a number. Received '${screenPath[1]}' instead. This is a bug.`);
        }
        suspendedByPathIndex = screenPath[1];
        rendererPath = screenPath.slice(2);
      }
      for (const rendererID in this._rendererInterfaces) {
        const renderer = this._rendererInterfaces[rendererID];
        let path = null;
        if (suspendedByPathIndex !== null && rendererPath !== null) {
          const suspendedByPathRendererIndex = suspendedByPathIndex - suspendedByOffset;
          const rendererHasRequestedSuspendedByPath = renderer.getElementAttributeByPath(id, ['suspendedBy', suspendedByPathRendererIndex]) !== undefined;
          if (rendererHasRequestedSuspendedByPath) {
            path = ['suspendedBy', suspendedByPathRendererIndex].concat(rendererPath);
          }
        }
        const inspectedRootsPayload = renderer.inspectElement(requestID, id, path, forceFullData);
        switch (inspectedRootsPayload.type) {
          case 'hydrated-path':
            inspectedRootsPayload.path[1] += suspendedByOffset;
            if (inspectedRootsPayload.value !== null) {
              for (let i = 0; i < inspectedRootsPayload.value.cleaned.length; i++) {
                inspectedRootsPayload.value.cleaned[i][1] += suspendedByOffset;
              }
            }
            this._bridge.send('inspectedScreen', inspectedRootsPayload);
            return;
          case 'full-data':
            const inspectedRoots = inspectedRootsPayload.value;
            if (inspectedScreen === null) {
              inspectedScreen = createEmptyInspectedScreen(inspectedRoots.id, inspectedRoots.type);
            }
            mergeRoots(inspectedScreen, inspectedRoots, suspendedByOffset);
            const dehydratedSuspendedBy = inspectedRoots.suspendedBy;
            const suspendedBy = dehydratedSuspendedBy.data;
            suspendedByOffset += suspendedBy.length;
            found = true;
            break;
          case 'no-change':
            found = true;
            const rootsSuspendedBy = renderer.getElementAttributeByPath(id, ['suspendedBy']);
            suspendedByOffset += rootsSuspendedBy.length;
            break;
          case 'not-found':
            break;
          case 'error':
            this._bridge.send('inspectedScreen', inspectedRootsPayload);
            return;
        }
      }
      if (inspectedScreen === null) {
        if (found) {
          this._bridge.send('inspectedScreen', {
            type: 'no-change',
            responseID: requestID,
            id
          });
        } else {
          this._bridge.send('inspectedScreen', {
            type: 'not-found',
            responseID: requestID,
            id
          });
        }
      } else {
        this._bridge.send('inspectedScreen', {
          type: 'full-data',
          responseID: requestID,
          id,
          value: inspectedScreen
        });
      }
    });
    _defineProperty(this, "logElementToConsole", ({
      id,
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        renderer.logElementToConsole(id);
      }
    });
    _defineProperty(this, "overrideError", ({
      id,
      rendererID,
      forceError
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        renderer.overrideError(id, forceError);
      }
    });
    _defineProperty(this, "overrideSuspense", ({
      id,
      rendererID,
      forceFallback
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        renderer.overrideSuspense(id, forceFallback);
      }
    });
    _defineProperty(this, "overrideSuspenseMilestone", ({
      rendererID,
      suspendedSet
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer.supportsTogglingSuspense) {
        renderer.overrideSuspenseMilestone(suspendedSet);
      }
    });
    _defineProperty(this, "overrideValueAtPath", ({
      hookID,
      id,
      path,
      rendererID,
      type,
      value
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        renderer.overrideValueAtPath(type, id, hookID, path, value);
      }
    });
    _defineProperty(this, "overrideContext", ({
      id,
      path,
      rendererID,
      wasForwarded,
      value
    }) => {
      if (!wasForwarded) {
        this.overrideValueAtPath({
          id,
          path,
          rendererID,
          type: 'context',
          value
        });
      }
    });
    _defineProperty(this, "overrideHookState", ({
      id,
      hookID,
      path,
      rendererID,
      wasForwarded,
      value
    }) => {
      if (!wasForwarded) {
        this.overrideValueAtPath({
          id,
          path,
          rendererID,
          type: 'hooks',
          value
        });
      }
    });
    _defineProperty(this, "overrideProps", ({
      id,
      path,
      rendererID,
      wasForwarded,
      value
    }) => {
      if (!wasForwarded) {
        this.overrideValueAtPath({
          id,
          path,
          rendererID,
          type: 'props',
          value
        });
      }
    });
    _defineProperty(this, "overrideState", ({
      id,
      path,
      rendererID,
      wasForwarded,
      value
    }) => {
      if (!wasForwarded) {
        this.overrideValueAtPath({
          id,
          path,
          rendererID,
          type: 'state',
          value
        });
      }
    });
    _defineProperty(this, "onReloadAndProfileSupportedByHost", () => {
      this._bridge.send('isReloadAndProfileSupportedByBackend', true);
    });
    _defineProperty(this, "reloadAndProfile", ({
      recordChangeDescriptions
    }) => {
      if (typeof this._onReloadAndProfile === 'function') {
        this._onReloadAndProfile(recordChangeDescriptions);
      }
      this._bridge.send('reloadAppForProfiling');
    });
    _defineProperty(this, "renamePath", ({
      hookID,
      id,
      newPath,
      oldPath,
      rendererID,
      type
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        renderer.renamePath(type, id, hookID, oldPath, newPath);
      }
    });
    _defineProperty(this, "setTraceUpdatesEnabled", traceUpdatesEnabled => {
      this._traceUpdatesEnabled = traceUpdatesEnabled;
      (0,_views_TraceUpdates__WEBPACK_IMPORTED_MODULE_3__.toggleEnabled)(traceUpdatesEnabled);
      for (const rendererID in this._rendererInterfaces) {
        const renderer = this._rendererInterfaces[rendererID];
        renderer.setTraceUpdatesEnabled(traceUpdatesEnabled);
      }
    });
    _defineProperty(this, "syncSelectionFromBuiltinElementsPanel", () => {
      const target = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0;
      this.selectNode(target == null ? null : target);
    });
    _defineProperty(this, "shutdown", () => {
      this.emit('shutdown');
      this._bridge.removeAllListeners();
      this.removeAllListeners();
    });
    _defineProperty(this, "startProfiling", ({
      recordChangeDescriptions
    }) => {
      this._isProfiling = true;
      for (const rendererID in this._rendererInterfaces) {
        const renderer = this._rendererInterfaces[rendererID];
        renderer.startProfiling(recordChangeDescriptions);
      }
      this._bridge.send('profilingStatus', this._isProfiling);
    });
    _defineProperty(this, "stopProfiling", () => {
      this._isProfiling = false;
      for (const rendererID in this._rendererInterfaces) {
        const renderer = this._rendererInterfaces[rendererID];
        renderer.stopProfiling();
      }
      this._bridge.send('profilingStatus', this._isProfiling);
    });
    _defineProperty(this, "stopInspectingNative", selected => {
      this._bridge.send('stopInspectingHost', selected);
    });
    _defineProperty(this, "storeAsGlobal", ({
      count,
      id,
      path,
      rendererID
    }) => {
      const renderer = this._rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      } else {
        renderer.storeAsGlobal(id, path, count);
      }
    });
    _defineProperty(this, "updateHookSettings", settings => {
      this.emit('updateHookSettings', settings);
    });
    _defineProperty(this, "getHookSettings", () => {
      this.emit('getHookSettings');
    });
    _defineProperty(this, "onHookSettings", settings => {
      this._bridge.send('hookSettings', settings);
    });
    _defineProperty(this, "updateComponentFilters", componentFilters => {
      for (const rendererIDString in this._rendererInterfaces) {
        const rendererID = +rendererIDString;
        const renderer = this._rendererInterfaces[rendererID];
        if (this._lastSelectedRendererID === rendererID) {
          const path = renderer.getPathForElement(this._lastSelectedElementID);
          if (path !== null) {
            renderer.setTrackedPath(path);
            this._persistedSelection = {
              rendererID,
              path
            };
          }
        }
        renderer.updateComponentFilters(componentFilters);
      }
      const target = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0;
      if (target != null) {
        this.selectNode(target);
      }
    });
    _defineProperty(this, "getEnvironmentNames", () => {
      let accumulatedNames = null;
      for (const rendererID in this._rendererInterfaces) {
        const renderer = this._rendererInterfaces[+rendererID];
        const names = renderer.getEnvironmentNames();
        if (accumulatedNames === null) {
          accumulatedNames = names;
        } else {
          for (let i = 0; i < names.length; i++) {
            if (accumulatedNames.indexOf(names[i]) === -1) {
              accumulatedNames.push(names[i]);
            }
          }
        }
      }
      this._bridge.send('environmentNames', accumulatedNames || []);
    });
    _defineProperty(this, "onTraceUpdates", nodes => {
      this.emit('traceUpdates', nodes);
    });
    _defineProperty(this, "onFastRefreshScheduled", () => {
      if (_constants__WEBPACK_IMPORTED_MODULE_1__.__DEBUG__) {
        debug('onFastRefreshScheduled');
      }
      this._bridge.send('fastRefreshScheduled');
    });
    _defineProperty(this, "onHookOperations", operations => {
      if (_constants__WEBPACK_IMPORTED_MODULE_1__.__DEBUG__) {
        debug('onHookOperations', `(${operations.length}) [${operations.join(', ')}]`);
      }
      this._bridge.send('operations', operations);
      if (this._persistedSelection !== null) {
        const rendererID = operations[0];
        if (this._persistedSelection.rendererID === rendererID) {
          const renderer = this._rendererInterfaces[rendererID];
          if (renderer == null) {
            console.warn(`Invalid renderer id "${rendererID}"`);
          } else {
            const prevMatch = this._persistedSelectionMatch;
            const nextMatch = renderer.getBestMatchForTrackedPath();
            this._persistedSelectionMatch = nextMatch;
            const prevMatchID = prevMatch !== null ? prevMatch.id : null;
            const nextMatchID = nextMatch !== null ? nextMatch.id : null;
            if (prevMatchID !== nextMatchID) {
              if (nextMatchID !== null) {
                this._bridge.send('selectElement', nextMatchID);
              }
            }
            if (nextMatch !== null && nextMatch.isFullMatch) {
              this._persistedSelection = null;
              this._persistedSelectionMatch = null;
              renderer.setTrackedPath(null);
            }
          }
        }
      }
    });
    _defineProperty(this, "getIfHasUnsupportedRendererVersion", () => {
      this.emit('getIfHasUnsupportedRendererVersion');
    });
    _defineProperty(this, "_persistSelectionTimerScheduled", false);
    _defineProperty(this, "_lastSelectedRendererID", -1);
    _defineProperty(this, "_lastSelectedElementID", -1);
    _defineProperty(this, "_persistSelection", () => {
      this._persistSelectionTimerScheduled = false;
      const rendererID = this._lastSelectedRendererID;
      const id = this._lastSelectedElementID;
      const renderer = this._rendererInterfaces[rendererID];
      const path = renderer != null ? renderer.getPathForElement(id) : null;
      if (path !== null) {
        (0,_storage__WEBPACK_IMPORTED_MODULE_6__.sessionStorageSetItem)(_constants__WEBPACK_IMPORTED_MODULE_1__.SESSION_STORAGE_LAST_SELECTION_KEY, JSON.stringify({
          rendererID,
          path
        }));
      } else {
        (0,_storage__WEBPACK_IMPORTED_MODULE_6__.sessionStorageRemoveItem)(_constants__WEBPACK_IMPORTED_MODULE_1__.SESSION_STORAGE_LAST_SELECTION_KEY);
      }
    });
    this._isProfiling = isProfiling;
    this._onReloadAndProfile = onReloadAndProfile;
    const persistedSelectionString = (0,_storage__WEBPACK_IMPORTED_MODULE_6__.sessionStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_1__.SESSION_STORAGE_LAST_SELECTION_KEY);
    if (persistedSelectionString != null) {
      this._persistedSelection = JSON.parse(persistedSelectionString);
    }
    this._bridge = bridge;
    bridge.addListener('clearErrorsAndWarnings', this.clearErrorsAndWarnings);
    bridge.addListener('clearErrorsForElementID', this.clearErrorsForElementID);
    bridge.addListener('clearWarningsForElementID', this.clearWarningsForElementID);
    bridge.addListener('copyElementPath', this.copyElementPath);
    bridge.addListener('deletePath', this.deletePath);
    bridge.addListener('getBackendVersion', this.getBackendVersion);
    bridge.addListener('getBridgeProtocol', this.getBridgeProtocol);
    bridge.addListener('getProfilingData', this.getProfilingData);
    bridge.addListener('getProfilingStatus', this.getProfilingStatus);
    bridge.addListener('getOwnersList', this.getOwnersList);
    bridge.addListener('inspectElement', this.inspectElement);
    bridge.addListener('inspectScreen', this.inspectScreen);
    bridge.addListener('logElementToConsole', this.logElementToConsole);
    bridge.addListener('overrideError', this.overrideError);
    bridge.addListener('overrideSuspense', this.overrideSuspense);
    bridge.addListener('overrideSuspenseMilestone', this.overrideSuspenseMilestone);
    bridge.addListener('overrideValueAtPath', this.overrideValueAtPath);
    bridge.addListener('reloadAndProfile', this.reloadAndProfile);
    bridge.addListener('renamePath', this.renamePath);
    bridge.addListener('setTraceUpdatesEnabled', this.setTraceUpdatesEnabled);
    bridge.addListener('startProfiling', this.startProfiling);
    bridge.addListener('stopProfiling', this.stopProfiling);
    bridge.addListener('storeAsGlobal', this.storeAsGlobal);
    bridge.addListener('syncSelectionFromBuiltinElementsPanel', this.syncSelectionFromBuiltinElementsPanel);
    bridge.addListener('shutdown', this.shutdown);
    bridge.addListener('updateHookSettings', this.updateHookSettings);
    bridge.addListener('getHookSettings', this.getHookSettings);
    bridge.addListener('updateComponentFilters', this.updateComponentFilters);
    bridge.addListener('getEnvironmentNames', this.getEnvironmentNames);
    bridge.addListener('getIfHasUnsupportedRendererVersion', this.getIfHasUnsupportedRendererVersion);
    bridge.addListener('overrideContext', this.overrideContext);
    bridge.addListener('overrideHookState', this.overrideHookState);
    bridge.addListener('overrideProps', this.overrideProps);
    bridge.addListener('overrideState', this.overrideState);
    (0,_views_Highlighter__WEBPACK_IMPORTED_MODULE_2__["default"])(bridge, this);
    (0,_views_TraceUpdates__WEBPACK_IMPORTED_MODULE_3__.initialize)(this);
    bridge.send('backendInitialized');
    if (this._isProfiling) {
      bridge.send('profilingStatus', true);
    }
  }
  get rendererInterfaces() {
    return this._rendererInterfaces;
  }
  getInstanceAndStyle({
    id,
    rendererID
  }) {
    const renderer = this._rendererInterfaces[rendererID];
    if (renderer == null) {
      console.warn(`Invalid renderer id "${rendererID}"`);
      return null;
    }
    return renderer.getInstanceAndStyle(id);
  }
  getIDForHostInstance(target, onlySuspenseNodes) {
    if ((0,_utils__WEBPACK_IMPORTED_MODULE_5__.isReactNativeEnvironment)() || typeof target.nodeType !== 'number') {
      for (const rendererID in this._rendererInterfaces) {
        const renderer = this._rendererInterfaces[rendererID];
        try {
          const id = onlySuspenseNodes ? renderer.getSuspenseNodeIDForHostInstance(target) : renderer.getElementIDForHostInstance(target);
          if (id !== null) {
            return {
              id: id,
              rendererID: +rendererID
            };
          }
        } catch (error) {}
      }
      return null;
    } else {
      let bestMatch = null;
      let bestRenderer = null;
      let bestRendererID = 0;
      for (const rendererID in this._rendererInterfaces) {
        const renderer = this._rendererInterfaces[rendererID];
        const nearestNode = renderer.getNearestMountedDOMNode(target);
        if (nearestNode !== null) {
          if (nearestNode === target) {
            bestMatch = nearestNode;
            bestRenderer = renderer;
            bestRendererID = +rendererID;
            break;
          }
          if (bestMatch === null || bestMatch.contains(nearestNode)) {
            bestMatch = nearestNode;
            bestRenderer = renderer;
            bestRendererID = +rendererID;
          }
        }
      }
      if (bestRenderer != null && bestMatch != null) {
        try {
          const id = onlySuspenseNodes ? bestRenderer.getSuspenseNodeIDForHostInstance(bestMatch) : bestRenderer.getElementIDForHostInstance(bestMatch);
          if (id !== null) {
            return {
              id,
              rendererID: bestRendererID
            };
          }
        } catch (error) {}
      }
      return null;
    }
  }
  getComponentNameForHostInstance(target) {
    const match = this.getIDForHostInstance(target);
    if (match !== null) {
      const renderer = this._rendererInterfaces[match.rendererID];
      return renderer.getDisplayNameForElementID(match.id);
    }
    return null;
  }
  selectNode(target) {
    const match = target !== null ? this.getIDForHostInstance(target) : null;
    this._bridge.send('selectElement', match !== null ? match.id : null);
  }
  registerRendererInterface(rendererID, rendererInterface) {
    this._rendererInterfaces[rendererID] = rendererInterface;
    rendererInterface.setTraceUpdatesEnabled(this._traceUpdatesEnabled);
    const selection = this._persistedSelection;
    if (selection !== null && selection.rendererID === rendererID) {
      rendererInterface.setTrackedPath(selection.path);
    }
  }
  onUnsupportedRenderer() {
    this._bridge.send('unsupportedRendererVersion');
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/index.js":
/*!*****************************************************!*\
  !*** ../react-devtools-shared/src/backend/index.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "initBackend": () => (/* binding */ initBackend)
/* harmony export */ });
/* harmony import */ var _agent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./agent */ "../react-devtools-shared/src/backend/agent.js");

function initBackend(hook, agent, global, isReloadAndProfileSupported) {
  if (hook == null) {
    return () => {};
  }
  function registerRendererInterface(id, rendererInterface) {
    agent.registerRendererInterface(id, rendererInterface);
    rendererInterface.flushInitialOperations();
  }
  const subs = [hook.sub('renderer-attached', ({
    id,
    rendererInterface
  }) => {
    registerRendererInterface(id, rendererInterface);
  }), hook.sub('unsupported-renderer-version', () => {
    agent.onUnsupportedRenderer();
  }), hook.sub('fastRefreshScheduled', agent.onFastRefreshScheduled), hook.sub('operations', agent.onHookOperations), hook.sub('traceUpdates', agent.onTraceUpdates), hook.sub('settingsInitialized', agent.onHookSettings)];
  agent.addListener('getIfHasUnsupportedRendererVersion', () => {
    if (hook.hasUnsupportedRendererAttached) {
      agent.onUnsupportedRenderer();
    }
  });
  hook.rendererInterfaces.forEach((rendererInterface, id) => {
    registerRendererInterface(id, rendererInterface);
  });
  hook.emit('react-devtools', agent);
  hook.reactDevtoolsAgent = agent;
  const onAgentShutdown = () => {
    subs.forEach(fn => fn());
    hook.rendererInterfaces.forEach(rendererInterface => {
      rendererInterface.cleanup();
    });
    hook.reactDevtoolsAgent = null;
  };
  agent.addListener('shutdown', onAgentShutdown);
  agent.addListener('updateHookSettings', settings => {
    hook.settings = settings;
  });
  agent.addListener('getHookSettings', () => {
    if (hook.settings != null) {
      agent.onHookSettings(hook.settings);
    }
  });
  if (isReloadAndProfileSupported) {
    agent.onReloadAndProfileSupportedByHost();
  }
  return () => {
    subs.forEach(fn => fn());
  };
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/utils/formatConsoleArguments.js":
/*!****************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/utils/formatConsoleArguments.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ formatConsoleArguments)
/* harmony export */ });
function formatConsoleArguments(maybeMessage, ...inputArgs) {
  if (inputArgs.length === 0 || typeof maybeMessage !== 'string') {
    return [maybeMessage, ...inputArgs];
  }
  const args = inputArgs.slice();
  let template = '';
  let argumentsPointer = 0;
  for (let i = 0; i < maybeMessage.length; ++i) {
    const currentChar = maybeMessage[i];
    if (currentChar !== '%') {
      template += currentChar;
      continue;
    }
    const nextChar = maybeMessage[i + 1];
    ++i;
    switch (nextChar) {
      case 'c':
      case 'O':
      case 'o':
        {
          ++argumentsPointer;
          template += `%${nextChar}`;
          break;
        }
      case 'd':
      case 'i':
        {
          if (argumentsPointer >= args.length) {
            template += `%${nextChar}`;
            break;
          }
          const [arg] = args.splice(argumentsPointer, 1);
          template += parseInt(arg, 10).toString();
          break;
        }
      case 'f':
        {
          if (argumentsPointer >= args.length) {
            template += `%${nextChar}`;
            break;
          }
          const [arg] = args.splice(argumentsPointer, 1);
          template += parseFloat(arg).toString();
          break;
        }
      case 's':
        {
          if (argumentsPointer >= args.length) {
            template += `%${nextChar}`;
            break;
          }
          const [arg] = args.splice(argumentsPointer, 1);
          template += String(arg);
          break;
        }
      default:
        if (nextChar === undefined) {
          template += '%';
        } else {
          template += `%${nextChar}`;
        }
    }
  }
  return [template, ...args];
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/utils/formatWithStyles.js":
/*!**********************************************************************!*\
  !*** ../react-devtools-shared/src/backend/utils/formatWithStyles.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ formatWithStyles)
/* harmony export */ });
function formatWithStyles(inputArgs, style) {
  if (inputArgs === undefined || inputArgs === null || inputArgs.length === 0 || typeof inputArgs[0] === 'string' && inputArgs[0].match(/([^%]|^)(%c)/g) || style === undefined) {
    return inputArgs;
  }
  const REGEXP = /([^%]|^)((%%)*)(%([oOdisf]))/g;
  if (typeof inputArgs[0] === 'string' && inputArgs[0].match(REGEXP)) {
    return [`%c${inputArgs[0]}`, style, ...inputArgs.slice(1)];
  } else {
    const firstArg = inputArgs.reduce((formatStr, elem, i) => {
      if (i > 0) {
        formatStr += ' ';
      }
      switch (typeof elem) {
        case 'string':
        case 'boolean':
        case 'symbol':
          return formatStr += '%s';
        case 'number':
          const formatting = Number.isInteger(elem) ? '%i' : '%f';
          return formatStr += formatting;
        default:
          return formatStr += '%o';
      }
    }, '%c');
    return [firstArg, style, ...inputArgs];
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/utils/index.js":
/*!***********************************************************!*\
  !*** ../react-devtools-shared/src/backend/utils/index.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "cleanForBridge": () => (/* binding */ cleanForBridge),
/* harmony export */   "copyWithDelete": () => (/* binding */ copyWithDelete),
/* harmony export */   "copyWithRename": () => (/* binding */ copyWithRename),
/* harmony export */   "copyWithSet": () => (/* binding */ copyWithSet),
/* harmony export */   "formatConsoleArguments": () => (/* reexport safe */ _formatConsoleArguments__WEBPACK_IMPORTED_MODULE_3__["default"]),
/* harmony export */   "formatConsoleArgumentsToSingleString": () => (/* binding */ formatConsoleArgumentsToSingleString),
/* harmony export */   "formatDurationToMicrosecondsGranularity": () => (/* binding */ formatDurationToMicrosecondsGranularity),
/* harmony export */   "formatWithStyles": () => (/* reexport safe */ _formatWithStyles__WEBPACK_IMPORTED_MODULE_2__["default"]),
/* harmony export */   "getEffectDurations": () => (/* binding */ getEffectDurations),
/* harmony export */   "gt": () => (/* binding */ gt),
/* harmony export */   "gte": () => (/* binding */ gte),
/* harmony export */   "hasAssignedBackend": () => (/* binding */ hasAssignedBackend),
/* harmony export */   "isReactNativeEnvironment": () => (/* binding */ isReactNativeEnvironment),
/* harmony export */   "isSynchronousXHRSupported": () => (/* binding */ isSynchronousXHRSupported),
/* harmony export */   "serializeToString": () => (/* binding */ serializeToString)
/* harmony export */ });
/* harmony import */ var compare_versions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! compare-versions */ "../../node_modules/compare-versions/lib/esm/index.js");
/* harmony import */ var react_devtools_shared_src_hydration__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/hydration */ "../react-devtools-shared/src/hydration.js");
/* harmony import */ var shared_isArray__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! shared/isArray */ "../shared/isArray.js");
/* harmony import */ var _formatWithStyles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./formatWithStyles */ "../react-devtools-shared/src/backend/utils/formatWithStyles.js");
/* harmony import */ var _formatConsoleArguments__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./formatConsoleArguments */ "../react-devtools-shared/src/backend/utils/formatConsoleArguments.js");





const FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER = '999.9.9';
function hasAssignedBackend(version) {
  if (version == null || version === '') {
    return false;
  }
  return gte(version, FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER);
}
function cleanForBridge(data, isPathAllowed, path = []) {
  if (data !== null) {
    const cleanedPaths = [];
    const unserializablePaths = [];
    const cleanedData = (0,react_devtools_shared_src_hydration__WEBPACK_IMPORTED_MODULE_0__.dehydrate)(data, cleanedPaths, unserializablePaths, path, isPathAllowed);
    return {
      data: cleanedData,
      cleaned: cleanedPaths,
      unserializable: unserializablePaths
    };
  } else {
    return null;
  }
}
function copyWithDelete(obj, path, index = 0) {
  const key = path[index];
  const updated = (0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(obj) ? obj.slice() : {
    ...obj
  };
  if (index + 1 === path.length) {
    if ((0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(updated)) {
      updated.splice(key, 1);
    } else {
      delete updated[key];
    }
  } else {
    updated[key] = copyWithDelete(obj[key], path, index + 1);
  }
  return updated;
}
function copyWithRename(obj, oldPath, newPath, index = 0) {
  const oldKey = oldPath[index];
  const updated = (0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(obj) ? obj.slice() : {
    ...obj
  };
  if (index + 1 === oldPath.length) {
    const newKey = newPath[index];
    updated[newKey] = updated[oldKey];
    if ((0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(updated)) {
      updated.splice(oldKey, 1);
    } else {
      delete updated[oldKey];
    }
  } else {
    updated[oldKey] = copyWithRename(obj[oldKey], oldPath, newPath, index + 1);
  }
  return updated;
}
function copyWithSet(obj, path, value, index = 0) {
  if (index >= path.length) {
    return value;
  }
  const key = path[index];
  const updated = (0,shared_isArray__WEBPACK_IMPORTED_MODULE_1__["default"])(obj) ? obj.slice() : {
    ...obj
  };
  updated[key] = copyWithSet(obj[key], path, value, index + 1);
  return updated;
}
function getEffectDurations(root) {
  let effectDuration = null;
  let passiveEffectDuration = null;
  const hostRoot = root.current;
  if (hostRoot != null) {
    const stateNode = hostRoot.stateNode;
    if (stateNode != null) {
      effectDuration = stateNode.effectDuration != null ? stateNode.effectDuration : null;
      passiveEffectDuration = stateNode.passiveEffectDuration != null ? stateNode.passiveEffectDuration : null;
    }
  }
  return {
    effectDuration,
    passiveEffectDuration
  };
}
function serializeToString(data) {
  if (data === undefined) {
    return 'undefined';
  }
  if (typeof data === 'function') {
    return data.toString();
  }
  const cache = new Set();
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return;
      }
      cache.add(value);
    }
    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }
    return value;
  }, 2);
}
function safeToString(val) {
  try {
    return String(val);
  } catch (err) {
    if (typeof val === 'object') {
      return '[object Object]';
    }
    throw err;
  }
}
function formatConsoleArgumentsToSingleString(maybeMessage, ...inputArgs) {
  const args = inputArgs.slice();
  let formatted = safeToString(maybeMessage);
  if (typeof maybeMessage === 'string') {
    if (args.length) {
      const REGEXP = /(%?)(%([jdisf]))/g;
      formatted = formatted.replace(REGEXP, (match, escaped, ptn, flag) => {
        if (escaped || args.length === 0) {
          return match;
        }
        let arg = args.shift();
        switch (flag) {
          case 's':
            arg += '';
            break;
          case 'd':
          case 'i':
            arg = parseInt(arg, 10).toString();
            break;
          case 'f':
            arg = parseFloat(arg).toString();
            break;
        }
        return arg;
      });
    }
  }
  if (args.length) {
    for (let i = 0; i < args.length; i++) {
      formatted += ' ' + safeToString(args[i]);
    }
  }
  formatted = formatted.replace(/%{2,2}/g, '%');
  return String(formatted);
}
function isSynchronousXHRSupported() {
  return !!(window.document && window.document.featurePolicy && window.document.featurePolicy.allowsFeature('sync-xhr'));
}
function gt(a = '', b = '') {
  return (0,compare_versions__WEBPACK_IMPORTED_MODULE_4__.compareVersions)(a, b) === 1;
}
function gte(a = '', b = '') {
  return (0,compare_versions__WEBPACK_IMPORTED_MODULE_4__.compareVersions)(a, b) > -1;
}
const isReactNativeEnvironment = () => {
  return window.document == null;
};
function formatDurationToMicrosecondsGranularity(duration) {
  return Math.round(duration * 1000) / 1000;
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/views/Highlighter/Highlighter.js":
/*!*****************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/views/Highlighter/Highlighter.js ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "hideOverlay": () => (/* binding */ hideOverlay),
/* harmony export */   "showOverlay": () => (/* binding */ showOverlay)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");
/* harmony import */ var _Overlay__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Overlay */ "../react-devtools-shared/src/backend/views/Highlighter/Overlay.js");


const SHOW_DURATION = 2000;
let timeoutID = null;
let overlay = null;
function hideOverlayNative(agent) {
  agent.emit('hideNativeHighlight');
}
function hideOverlayWeb() {
  timeoutID = null;
  if (overlay !== null) {
    overlay.remove();
    overlay = null;
  }
}
function hideOverlay(agent) {
  return (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_0__.isReactNativeEnvironment)() ? hideOverlayNative(agent) : hideOverlayWeb();
}
function showOverlayNative(elements, agent) {
  agent.emit('showNativeHighlight', elements);
}
function showOverlayWeb(elements, componentName, agent, hideAfterTimeout) {
  if (timeoutID !== null) {
    clearTimeout(timeoutID);
  }
  if (overlay === null) {
    overlay = new _Overlay__WEBPACK_IMPORTED_MODULE_1__["default"](agent);
  }
  overlay.inspect(elements, componentName);
  if (hideAfterTimeout) {
    timeoutID = setTimeout(() => hideOverlay(agent), SHOW_DURATION);
  }
}
function showOverlay(elements, componentName, agent, hideAfterTimeout) {
  return (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_0__.isReactNativeEnvironment)() ? showOverlayNative(elements, agent) : showOverlayWeb(elements, componentName, agent, hideAfterTimeout);
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/views/Highlighter/Overlay.js":
/*!*************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/views/Highlighter/Overlay.js ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Overlay)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils */ "../react-devtools-shared/src/backend/views/utils.js");

const assign = Object.assign;
class OverlayRect {
  constructor(doc, container) {
    this.node = doc.createElement('div');
    this.border = doc.createElement('div');
    this.padding = doc.createElement('div');
    this.content = doc.createElement('div');
    this.border.style.borderColor = overlayStyles.border;
    this.padding.style.borderColor = overlayStyles.padding;
    this.content.style.backgroundColor = overlayStyles.background;
    assign(this.node.style, {
      borderColor: overlayStyles.margin,
      pointerEvents: 'none',
      position: 'fixed'
    });
    this.node.style.zIndex = '10000000';
    this.node.appendChild(this.border);
    this.border.appendChild(this.padding);
    this.padding.appendChild(this.content);
    container.appendChild(this.node);
  }
  remove() {
    if (this.node.parentNode) {
      this.node.parentNode.removeChild(this.node);
    }
  }
  update(box, dims) {
    boxWrap(dims, 'margin', this.node);
    boxWrap(dims, 'border', this.border);
    boxWrap(dims, 'padding', this.padding);
    assign(this.content.style, {
      height: box.height - dims.borderTop - dims.borderBottom - dims.paddingTop - dims.paddingBottom + 'px',
      width: box.width - dims.borderLeft - dims.borderRight - dims.paddingLeft - dims.paddingRight + 'px'
    });
    assign(this.node.style, {
      top: box.top - dims.marginTop + 'px',
      left: box.left - dims.marginLeft + 'px'
    });
  }
}
class OverlayTip {
  constructor(doc, container) {
    this.tip = doc.createElement('div');
    assign(this.tip.style, {
      display: 'flex',
      flexFlow: 'row nowrap',
      backgroundColor: '#333740',
      borderRadius: '2px',
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
      fontWeight: 'bold',
      padding: '3px 5px',
      pointerEvents: 'none',
      position: 'fixed',
      fontSize: '12px',
      whiteSpace: 'nowrap'
    });
    this.nameSpan = doc.createElement('span');
    this.tip.appendChild(this.nameSpan);
    assign(this.nameSpan.style, {
      color: '#ee78e6',
      borderRight: '1px solid #aaaaaa',
      paddingRight: '0.5rem',
      marginRight: '0.5rem'
    });
    this.dimSpan = doc.createElement('span');
    this.tip.appendChild(this.dimSpan);
    assign(this.dimSpan.style, {
      color: '#d7d7d7'
    });
    this.tip.style.zIndex = '10000000';
    container.appendChild(this.tip);
  }
  remove() {
    if (this.tip.parentNode) {
      this.tip.parentNode.removeChild(this.tip);
    }
  }
  updateText(name, width, height) {
    this.nameSpan.textContent = name;
    this.dimSpan.textContent = Math.round(width) + 'px × ' + Math.round(height) + 'px';
  }
  updatePosition(dims, bounds) {
    const tipRect = this.tip.getBoundingClientRect();
    const tipPos = findTipPos(dims, bounds, {
      width: tipRect.width,
      height: tipRect.height
    });
    assign(this.tip.style, tipPos.style);
  }
}
class Overlay {
  constructor(agent) {
    const currentWindow = window.__REACT_DEVTOOLS_TARGET_WINDOW__ || window;
    this.window = currentWindow;
    const tipBoundsWindow = window.__REACT_DEVTOOLS_TARGET_WINDOW__ || window;
    this.tipBoundsWindow = tipBoundsWindow;
    const doc = currentWindow.document;
    this.container = doc.createElement('div');
    this.container.style.zIndex = '10000000';
    this.tip = new OverlayTip(doc, this.container);
    this.rects = [];
    this.agent = agent;
    doc.body.appendChild(this.container);
  }
  remove() {
    this.tip.remove();
    this.rects.forEach(rect => {
      rect.remove();
    });
    this.rects.length = 0;
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
  inspect(nodes, name) {
    const elements = nodes.filter(node => node.nodeType === Node.ELEMENT_NODE);
    while (this.rects.length > elements.length) {
      const rect = this.rects.pop();
      rect.remove();
    }
    if (elements.length === 0) {
      return;
    }
    while (this.rects.length < elements.length) {
      this.rects.push(new OverlayRect(this.window.document, this.container));
    }
    const outerBox = {
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
      left: Number.POSITIVE_INFINITY
    };
    elements.forEach((element, index) => {
      const box = (0,_utils__WEBPACK_IMPORTED_MODULE_0__.getNestedBoundingClientRect)(element, this.window);
      const dims = (0,_utils__WEBPACK_IMPORTED_MODULE_0__.getElementDimensions)(element);
      outerBox.top = Math.min(outerBox.top, box.top - dims.marginTop);
      outerBox.right = Math.max(outerBox.right, box.left + box.width + dims.marginRight);
      outerBox.bottom = Math.max(outerBox.bottom, box.top + box.height + dims.marginBottom);
      outerBox.left = Math.min(outerBox.left, box.left - dims.marginLeft);
      const rect = this.rects[index];
      rect.update(box, dims);
    });
    if (!name) {
      name = elements[0].nodeName.toLowerCase();
      const node = elements[0];
      const ownerName = this.agent.getComponentNameForHostInstance(node);
      if (ownerName) {
        name += ' (in ' + ownerName + ')';
      }
    }
    this.tip.updateText(name, outerBox.right - outerBox.left, outerBox.bottom - outerBox.top);
    const tipBounds = (0,_utils__WEBPACK_IMPORTED_MODULE_0__.getNestedBoundingClientRect)(this.tipBoundsWindow.document.documentElement, this.window);
    this.tip.updatePosition({
      top: outerBox.top,
      left: outerBox.left,
      height: outerBox.bottom - outerBox.top,
      width: outerBox.right - outerBox.left
    }, {
      top: tipBounds.top + this.tipBoundsWindow.scrollY,
      left: tipBounds.left + this.tipBoundsWindow.scrollX,
      height: this.tipBoundsWindow.innerHeight,
      width: this.tipBoundsWindow.innerWidth
    });
  }
}
function findTipPos(dims, bounds, tipSize) {
  const tipHeight = Math.max(tipSize.height, 20);
  const tipWidth = Math.max(tipSize.width, 60);
  const margin = 5;
  let top;
  if (dims.top + dims.height + tipHeight <= bounds.top + bounds.height) {
    if (dims.top + dims.height < bounds.top + 0) {
      top = bounds.top + margin;
    } else {
      top = dims.top + dims.height + margin;
    }
  } else if (dims.top - tipHeight <= bounds.top + bounds.height) {
    if (dims.top - tipHeight - margin < bounds.top + margin) {
      top = bounds.top + margin;
    } else {
      top = dims.top - tipHeight - margin;
    }
  } else {
    top = bounds.top + bounds.height - tipHeight - margin;
  }
  let left = dims.left + margin;
  if (dims.left < bounds.left) {
    left = bounds.left + margin;
  }
  if (dims.left + tipWidth > bounds.left + bounds.width) {
    left = bounds.left + bounds.width - tipWidth - margin;
  }
  top += 'px';
  left += 'px';
  return {
    style: {
      top,
      left
    }
  };
}
function boxWrap(dims, what, node) {
  assign(node.style, {
    borderTopWidth: dims[what + 'Top'] + 'px',
    borderLeftWidth: dims[what + 'Left'] + 'px',
    borderRightWidth: dims[what + 'Right'] + 'px',
    borderBottomWidth: dims[what + 'Bottom'] + 'px',
    borderStyle: 'solid'
  });
}
const overlayStyles = {
  background: 'rgba(120, 170, 210, 0.7)',
  padding: 'rgba(77, 200, 0, 0.3)',
  margin: 'rgba(255, 155, 0, 0.3)',
  border: 'rgba(255, 200, 50, 0.3)'
};

/***/ }),

/***/ "../react-devtools-shared/src/backend/views/Highlighter/index.js":
/*!***********************************************************************!*\
  !*** ../react-devtools-shared/src/backend/views/Highlighter/index.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ setupHighlighter)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_backend_agent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/backend/agent */ "../react-devtools-shared/src/backend/agent.js");
/* harmony import */ var _Highlighter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Highlighter */ "../react-devtools-shared/src/backend/views/Highlighter/Highlighter.js");
/* harmony import */ var react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");



let iframesListeningTo = new Set();
let inspectOnlySuspenseNodes = false;
function setupHighlighter(bridge, agent) {
  bridge.addListener('clearHostInstanceHighlight', clearHostInstanceHighlight);
  bridge.addListener('highlightHostInstance', highlightHostInstance);
  bridge.addListener('highlightHostInstances', highlightHostInstances);
  bridge.addListener('scrollToHostInstance', scrollToHostInstance);
  bridge.addListener('shutdown', stopInspectingHost);
  bridge.addListener('startInspectingHost', startInspectingHost);
  bridge.addListener('stopInspectingHost', stopInspectingHost);
  bridge.addListener('scrollTo', scrollDocumentTo);
  bridge.addListener('requestScrollPosition', sendScroll);
  let applyingScroll = false;
  function scrollDocumentTo({
    left,
    top,
    right,
    bottom
  }) {
    if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.isReactNativeEnvironment)()) {
      return;
    }
    if (left === Math.round(window.scrollX) && top === Math.round(window.scrollY)) {
      return;
    }
    applyingScroll = true;
    window.scrollTo({
      top: top,
      left: left,
      behavior: 'smooth'
    });
  }
  let scrollTimer = null;
  function sendScroll() {
    if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.isReactNativeEnvironment)()) {
      return;
    }
    if (scrollTimer) {
      clearTimeout(scrollTimer);
      scrollTimer = null;
    }
    if (applyingScroll) {
      return;
    }
    const left = window.scrollX;
    const top = window.scrollY;
    const right = left + window.innerWidth;
    const bottom = top + window.innerHeight;
    bridge.send('scrollTo', {
      left,
      top,
      right,
      bottom
    });
  }
  function scrollEnd() {
    sendScroll();
    applyingScroll = false;
  }
  if (typeof document === 'object' && typeof document.addEventListener === 'function') {
    document.addEventListener('scroll', () => {
      if (!scrollTimer) {
        scrollTimer = setTimeout(sendScroll, 400);
      }
    });
    document.addEventListener('scrollend', scrollEnd);
  }
  function startInspectingHost(onlySuspenseNodes) {
    inspectOnlySuspenseNodes = onlySuspenseNodes;
    registerListenersOnWindow(window);
  }
  function registerListenersOnWindow(window) {
    if (window && typeof window.addEventListener === 'function') {
      window.addEventListener('click', onClick, true);
      window.addEventListener('mousedown', onMouseEvent, true);
      window.addEventListener('mouseover', onMouseEvent, true);
      window.addEventListener('mouseup', onMouseEvent, true);
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
    } else {
      agent.emit('startInspectingNative');
    }
  }
  function stopInspectingHost() {
    (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.hideOverlay)(agent);
    removeListenersOnWindow(window);
    iframesListeningTo.forEach(function (frame) {
      try {
        removeListenersOnWindow(frame.contentWindow);
      } catch (error) {}
    });
    iframesListeningTo = new Set();
  }
  function removeListenersOnWindow(window) {
    if (window && typeof window.removeEventListener === 'function') {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('mousedown', onMouseEvent, true);
      window.removeEventListener('mouseover', onMouseEvent, true);
      window.removeEventListener('mouseup', onMouseEvent, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    } else {
      agent.emit('stopInspectingNative');
    }
  }
  function clearHostInstanceHighlight() {
    (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.hideOverlay)(agent);
  }
  function highlightHostInstance({
    displayName,
    hideAfterTimeout,
    id,
    openBuiltinElementsPanel,
    rendererID,
    scrollIntoView
  }) {
    const renderer = agent.rendererInterfaces[rendererID];
    if (renderer == null) {
      console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.hideOverlay)(agent);
      return;
    }
    if (!renderer.hasElementWithId(id)) {
      (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.hideOverlay)(agent);
      return;
    }
    const nodes = renderer.findHostInstancesForElementID(id);
    if (nodes != null) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node === null) {
          continue;
        }
        const nodeRects = typeof node.getClientRects === 'function' ? node.getClientRects() : [];
        if (typeof node.getClientRects === 'undefined' || nodeRects.length > 0 && (nodeRects.length > 2 || nodeRects[0].width > 0 || nodeRects[0].height > 0)) {
          if (scrollIntoView && typeof node.scrollIntoView === 'function') {
            if (scrollDelayTimer) {
              clearTimeout(scrollDelayTimer);
              scrollDelayTimer = null;
            }
            node.scrollIntoView({
              block: 'nearest',
              inline: 'nearest'
            });
          }
          (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.showOverlay)(nodes, displayName, agent, hideAfterTimeout);
          if (openBuiltinElementsPanel) {
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0 = node;
            bridge.send('syncSelectionToBuiltinElementsPanel');
          }
          return;
        }
      }
    }
    (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.hideOverlay)(agent);
  }
  function highlightHostInstances({
    displayName,
    hideAfterTimeout,
    elements,
    scrollIntoView
  }) {
    const nodes = [];
    for (let i = 0; i < elements.length; i++) {
      const {
        id,
        rendererID
      } = elements[i];
      const renderer = agent.rendererInterfaces[rendererID];
      if (renderer == null) {
        console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
        continue;
      }
      if (!renderer.hasElementWithId(id)) {
        continue;
      }
      const hostInstances = renderer.findHostInstancesForElementID(id);
      if (hostInstances !== null) {
        for (let j = 0; j < hostInstances.length; j++) {
          nodes.push(hostInstances[j]);
        }
      }
    }
    if (nodes.length > 0) {
      const node = nodes[0];
      if (scrollIntoView && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
    (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.showOverlay)(nodes, displayName, agent, hideAfterTimeout);
  }
  function attemptScrollToHostInstance(renderer, id) {
    const nodes = renderer.findHostInstancesForElementID(id);
    if (nodes != null) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node === null) {
          continue;
        }
        const nodeRects = typeof node.getClientRects === 'function' ? node.getClientRects() : [];
        if (nodeRects.length > 0 && (nodeRects.length > 2 || nodeRects[0].width > 0 || nodeRects[0].height > 0)) {
          if (typeof node.scrollIntoView === 'function') {
            node.scrollIntoView({
              block: 'nearest',
              inline: 'nearest',
              behavior: 'smooth'
            });
            return true;
          }
        }
      }
    }
    return false;
  }
  let scrollDelayTimer = null;
  function scrollToHostInstance({
    id,
    rendererID
  }) {
    (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.hideOverlay)(agent);
    if ((0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_2__.isReactNativeEnvironment)()) {
      return;
    }
    if (scrollDelayTimer) {
      clearTimeout(scrollDelayTimer);
      scrollDelayTimer = null;
    }
    const renderer = agent.rendererInterfaces[rendererID];
    if (renderer == null) {
      console.warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
      return;
    }
    if (!renderer.hasElementWithId(id)) {
      return;
    }
    if (attemptScrollToHostInstance(renderer, id)) {
      return;
    }
    const rects = renderer.findLastKnownRectsForID(id);
    if (rects !== null && rects.length > 0) {
      let x = Infinity;
      let y = Infinity;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.x < x) {
          x = rect.x;
        }
        if (rect.y < y) {
          y = rect.y;
        }
      }
      const element = document.documentElement;
      if (!element) {
        return;
      }
      if (x < window.scrollX || y < window.scrollY || x > window.scrollX + element.clientWidth || y > window.scrollY + element.clientHeight) {
        window.scrollTo({
          top: y,
          left: x,
          behavior: 'smooth'
        });
      }
      scrollDelayTimer = setTimeout(() => {
        attemptScrollToHostInstance(renderer, id);
      }, 100);
    }
  }
  function onClick(event) {
    event.preventDefault();
    event.stopPropagation();
    stopInspectingHost();
    bridge.send('stopInspectingHost', true);
  }
  function onMouseEvent(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  function onPointerDown(event) {
    event.preventDefault();
    event.stopPropagation();
    selectElementForNode(getEventTarget(event));
  }
  let lastHoveredNode = null;
  function onPointerMove(event) {
    event.preventDefault();
    event.stopPropagation();
    const target = getEventTarget(event);
    if (lastHoveredNode === target) return;
    lastHoveredNode = target;
    if (target.tagName === 'IFRAME') {
      const iframe = target;
      try {
        if (!iframesListeningTo.has(iframe)) {
          const window = iframe.contentWindow;
          registerListenersOnWindow(window);
          iframesListeningTo.add(iframe);
        }
      } catch (error) {}
    }
    if (inspectOnlySuspenseNodes) {
      const match = agent.getIDForHostInstance(target, inspectOnlySuspenseNodes);
      if (match !== null) {
        const renderer = agent.rendererInterfaces[match.rendererID];
        if (renderer == null) {
          console.warn(`Invalid renderer id "${match.rendererID}" for element "${match.id}"`);
          return;
        }
        highlightHostInstance({
          displayName: renderer.getDisplayNameForElementID(match.id),
          hideAfterTimeout: false,
          id: match.id,
          openBuiltinElementsPanel: false,
          rendererID: match.rendererID,
          scrollIntoView: false
        });
      }
    } else {
      (0,_Highlighter__WEBPACK_IMPORTED_MODULE_1__.showOverlay)([target], null, agent, false);
    }
  }
  function onPointerUp(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const selectElementForNode = node => {
    const match = agent.getIDForHostInstance(node, inspectOnlySuspenseNodes);
    if (match !== null) {
      bridge.send('selectElement', match.id);
    }
  };
  function getEventTarget(event) {
    if (event.composed) {
      return event.composedPath()[0];
    }
    return event.target;
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/views/TraceUpdates/canvas.js":
/*!*************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/views/TraceUpdates/canvas.js ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "destroy": () => (/* binding */ destroy),
/* harmony export */   "draw": () => (/* binding */ draw),
/* harmony export */   "groupAndSortNodes": () => (/* binding */ groupAndSortNodes)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");

const COLORS = ['#37afa9', '#63b19e', '#80b393', '#97b488', '#abb67d', '#beb771', '#cfb965', '#dfba57', '#efbb49', '#febc38'];
let canvas = null;
function drawNative(nodeToData, agent) {
  const nodesToDraw = [];
  iterateNodes(nodeToData, ({
    color,
    node
  }) => {
    nodesToDraw.push({
      node,
      color
    });
  });
  agent.emit('drawTraceUpdates', nodesToDraw);
  const mergedNodes = groupAndSortNodes(nodeToData);
  agent.emit('drawGroupedTraceUpdatesWithNames', mergedNodes);
}
function drawWeb(nodeToData) {
  if (canvas === null) {
    initialize();
  }
  const dpr = window.devicePixelRatio || 1;
  const canvasFlow = canvas;
  canvasFlow.width = window.innerWidth * dpr;
  canvasFlow.height = window.innerHeight * dpr;
  canvasFlow.style.width = `${window.innerWidth}px`;
  canvasFlow.style.height = `${window.innerHeight}px`;
  const context = canvasFlow.getContext('2d');
  context.scale(dpr, dpr);
  context.clearRect(0, 0, canvasFlow.width / dpr, canvasFlow.height / dpr);
  const mergedNodes = groupAndSortNodes(nodeToData);
  mergedNodes.forEach(group => {
    drawGroupBorders(context, group);
    drawGroupLabel(context, group);
  });
  if (canvas !== null) {
    if (nodeToData.size === 0 && canvas.matches(':popover-open')) {
      canvas.hidePopover();
      return;
    }
    if (canvas.matches(':popover-open')) {
      canvas.hidePopover();
    }
    canvas.showPopover();
  }
}
function groupAndSortNodes(nodeToData) {
  const positionGroups = new Map();
  iterateNodes(nodeToData, ({
    rect,
    color,
    displayName,
    count
  }) => {
    if (!rect) return;
    const key = `${rect.left},${rect.top}`;
    if (!positionGroups.has(key)) positionGroups.set(key, []);
    positionGroups.get(key)?.push({
      rect,
      color,
      displayName,
      count
    });
  });
  return Array.from(positionGroups.values()).sort((groupA, groupB) => {
    const maxCountA = Math.max(...groupA.map(item => item.count));
    const maxCountB = Math.max(...groupB.map(item => item.count));
    return maxCountA - maxCountB;
  });
}
function drawGroupBorders(context, group) {
  group.forEach(({
    color,
    rect
  }) => {
    context.beginPath();
    context.strokeStyle = color;
    context.rect(rect.left, rect.top, rect.width - 1, rect.height - 1);
    context.stroke();
  });
}
function drawGroupLabel(context, group) {
  const mergedName = group.map(({
    displayName,
    count
  }) => displayName ? `${displayName}${count > 1 ? ` x${count}` : ''}` : '').filter(Boolean).join(', ');
  if (mergedName) {
    drawLabel(context, group[0].rect, mergedName, group[0].color);
  }
}
function draw(nodeToData, agent) {
  return (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_0__.isReactNativeEnvironment)() ? drawNative(nodeToData, agent) : drawWeb(nodeToData);
}
function iterateNodes(nodeToData, execute) {
  nodeToData.forEach((data, node) => {
    const colorIndex = Math.min(COLORS.length - 1, data.count - 1);
    const color = COLORS[colorIndex];
    execute({
      color,
      node,
      count: data.count,
      displayName: data.displayName,
      expirationTime: data.expirationTime,
      lastMeasuredAt: data.lastMeasuredAt,
      rect: data.rect
    });
  });
}
function drawLabel(context, rect, text, color) {
  const {
    left,
    top
  } = rect;
  context.font = '10px monospace';
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  const padding = 2;
  const textHeight = 14;
  const metrics = context.measureText(text);
  const backgroundWidth = metrics.width + padding * 2;
  const backgroundHeight = textHeight;
  const labelX = left;
  const labelY = top - backgroundHeight;
  context.fillStyle = color;
  context.fillRect(labelX, labelY, backgroundWidth, backgroundHeight);
  context.fillStyle = '#000000';
  context.fillText(text, labelX + backgroundWidth / 2, labelY + backgroundHeight / 2);
}
function destroyNative(agent) {
  agent.emit('disableTraceUpdates');
}
function destroyWeb() {
  if (canvas !== null) {
    if (canvas.matches(':popover-open')) {
      canvas.hidePopover();
    }
    if (canvas.parentNode != null) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
  }
}
function destroy(agent) {
  return (0,react_devtools_shared_src_backend_utils__WEBPACK_IMPORTED_MODULE_0__.isReactNativeEnvironment)() ? destroyNative(agent) : destroyWeb();
}
function initialize() {
  canvas = window.document.createElement('canvas');
  canvas.setAttribute('popover', 'manual');
  canvas.style.cssText = `
    xx-background-color: red;
    xx-opacity: 0.5;
    bottom: 0;
    left: 0;
    pointer-events: none;
    position: fixed;
    right: 0;
    top: 0;
    background-color: transparent;
    outline: none;
    box-shadow: none;
    border: none;
  `;
  const root = window.document.documentElement;
  root.insertBefore(canvas, root.firstChild);
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/views/TraceUpdates/index.js":
/*!************************************************************************!*\
  !*** ../react-devtools-shared/src/backend/views/TraceUpdates/index.js ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "initialize": () => (/* binding */ initialize),
/* harmony export */   "toggleEnabled": () => (/* binding */ toggleEnabled)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_backend_agent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/backend/agent */ "../react-devtools-shared/src/backend/agent.js");
/* harmony import */ var _canvas__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./canvas */ "../react-devtools-shared/src/backend/views/TraceUpdates/canvas.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils */ "../react-devtools-shared/src/backend/views/utils.js");



const DISPLAY_DURATION = 250;
const MAX_DISPLAY_DURATION = 3000;
const REMEASUREMENT_AFTER_DURATION = 250;
const HOC_MARKERS = new Map([['Forget', '✨'], ['Memo', '🧠']]);
const getCurrentTime = typeof performance === 'object' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();
const nodeToData = new Map();
let agent = null;
let drawAnimationFrameID = null;
let isEnabled = false;
let redrawTimeoutID = null;
function initialize(injectedAgent) {
  agent = injectedAgent;
  agent.addListener('traceUpdates', traceUpdates);
}
function toggleEnabled(value) {
  isEnabled = value;
  if (!isEnabled) {
    nodeToData.clear();
    if (drawAnimationFrameID !== null) {
      cancelAnimationFrame(drawAnimationFrameID);
      drawAnimationFrameID = null;
    }
    if (redrawTimeoutID !== null) {
      clearTimeout(redrawTimeoutID);
      redrawTimeoutID = null;
    }
    (0,_canvas__WEBPACK_IMPORTED_MODULE_1__.destroy)(agent);
  }
}
function traceUpdates(nodes) {
  if (!isEnabled) return;
  nodes.forEach(node => {
    const data = nodeToData.get(node);
    const now = getCurrentTime();
    let lastMeasuredAt = data != null ? data.lastMeasuredAt : 0;
    let rect = data != null ? data.rect : null;
    if (rect === null || lastMeasuredAt + REMEASUREMENT_AFTER_DURATION < now) {
      lastMeasuredAt = now;
      rect = measureNode(node);
    }
    let displayName = agent.getComponentNameForHostInstance(node);
    if (displayName) {
      const {
        baseComponentName,
        hocNames
      } = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.extractHOCNames)(displayName);
      const markers = hocNames.map(hoc => HOC_MARKERS.get(hoc) || '').join('');
      const enhancedDisplayName = markers ? `${markers}${baseComponentName}` : baseComponentName;
      displayName = enhancedDisplayName;
    }
    nodeToData.set(node, {
      count: data != null ? data.count + 1 : 1,
      expirationTime: data != null ? Math.min(now + MAX_DISPLAY_DURATION, data.expirationTime + DISPLAY_DURATION) : now + DISPLAY_DURATION,
      lastMeasuredAt,
      rect,
      displayName
    });
  });
  if (redrawTimeoutID !== null) {
    clearTimeout(redrawTimeoutID);
    redrawTimeoutID = null;
  }
  if (drawAnimationFrameID === null) {
    drawAnimationFrameID = requestAnimationFrame(prepareToDraw);
  }
}
function prepareToDraw() {
  drawAnimationFrameID = null;
  redrawTimeoutID = null;
  const now = getCurrentTime();
  let earliestExpiration = Number.MAX_VALUE;
  nodeToData.forEach((data, node) => {
    if (data.expirationTime < now) {
      nodeToData.delete(node);
    } else {
      earliestExpiration = Math.min(earliestExpiration, data.expirationTime);
    }
  });
  (0,_canvas__WEBPACK_IMPORTED_MODULE_1__.draw)(nodeToData, agent);
  if (earliestExpiration !== Number.MAX_VALUE) {
    redrawTimeoutID = setTimeout(prepareToDraw, earliestExpiration - now);
  }
}
function measureNode(node) {
  if (!node || typeof node.getBoundingClientRect !== 'function') {
    return null;
  }
  const currentWindow = window.__REACT_DEVTOOLS_TARGET_WINDOW__ || window;
  return (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getNestedBoundingClientRect)(node, currentWindow);
}

/***/ }),

/***/ "../react-devtools-shared/src/backend/views/utils.js":
/*!***********************************************************!*\
  !*** ../react-devtools-shared/src/backend/views/utils.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "extractHOCNames": () => (/* binding */ extractHOCNames),
/* harmony export */   "getBoundingClientRectWithBorderOffset": () => (/* binding */ getBoundingClientRectWithBorderOffset),
/* harmony export */   "getElementDimensions": () => (/* binding */ getElementDimensions),
/* harmony export */   "getNestedBoundingClientRect": () => (/* binding */ getNestedBoundingClientRect),
/* harmony export */   "getOwnerIframe": () => (/* binding */ getOwnerIframe),
/* harmony export */   "getOwnerWindow": () => (/* binding */ getOwnerWindow),
/* harmony export */   "mergeRectOffsets": () => (/* binding */ mergeRectOffsets)
/* harmony export */ });
function getOwnerWindow(node) {
  if (!node.ownerDocument) {
    return null;
  }
  return node.ownerDocument.defaultView;
}
function getOwnerIframe(node) {
  const nodeWindow = getOwnerWindow(node);
  if (nodeWindow) {
    return nodeWindow.frameElement;
  }
  return null;
}
function getBoundingClientRectWithBorderOffset(node) {
  const dimensions = getElementDimensions(node);
  return mergeRectOffsets([node.getBoundingClientRect(), {
    top: dimensions.borderTop,
    left: dimensions.borderLeft,
    bottom: dimensions.borderBottom,
    right: dimensions.borderRight,
    width: 0,
    height: 0
  }]);
}
function mergeRectOffsets(rects) {
  return rects.reduce((previousRect, rect) => {
    if (previousRect == null) {
      return rect;
    }
    return {
      top: previousRect.top + rect.top,
      left: previousRect.left + rect.left,
      width: previousRect.width,
      height: previousRect.height,
      bottom: previousRect.bottom + rect.bottom,
      right: previousRect.right + rect.right
    };
  });
}
function getNestedBoundingClientRect(node, boundaryWindow) {
  const ownerIframe = getOwnerIframe(node);
  if (ownerIframe && ownerIframe !== boundaryWindow) {
    const rects = [node.getBoundingClientRect()];
    let currentIframe = ownerIframe;
    let onlyOneMore = false;
    while (currentIframe) {
      const rect = getBoundingClientRectWithBorderOffset(currentIframe);
      rects.push(rect);
      currentIframe = getOwnerIframe(currentIframe);
      if (onlyOneMore) {
        break;
      }
      if (currentIframe && getOwnerWindow(currentIframe) === boundaryWindow) {
        onlyOneMore = true;
      }
    }
    return mergeRectOffsets(rects);
  } else {
    return node.getBoundingClientRect();
  }
}
function getElementDimensions(domElement) {
  const calculatedStyle = window.getComputedStyle(domElement);
  return {
    borderLeft: parseInt(calculatedStyle.borderLeftWidth, 10),
    borderRight: parseInt(calculatedStyle.borderRightWidth, 10),
    borderTop: parseInt(calculatedStyle.borderTopWidth, 10),
    borderBottom: parseInt(calculatedStyle.borderBottomWidth, 10),
    marginLeft: parseInt(calculatedStyle.marginLeft, 10),
    marginRight: parseInt(calculatedStyle.marginRight, 10),
    marginTop: parseInt(calculatedStyle.marginTop, 10),
    marginBottom: parseInt(calculatedStyle.marginBottom, 10),
    paddingLeft: parseInt(calculatedStyle.paddingLeft, 10),
    paddingRight: parseInt(calculatedStyle.paddingRight, 10),
    paddingTop: parseInt(calculatedStyle.paddingTop, 10),
    paddingBottom: parseInt(calculatedStyle.paddingBottom, 10)
  };
}
function extractHOCNames(displayName) {
  if (!displayName) return {
    baseComponentName: '',
    hocNames: []
  };
  const hocRegex = /^([A-Za-z_$][A-Za-z0-9_$]*)\((.*)\)$/;
  const hocNames = [];
  let baseComponentName = displayName;
  let match;
  while ((match = hocRegex.exec(baseComponentName)) != null) {
    if (Array.isArray(match)) {
      const [, hocName, inner] = match;
      hocNames.push(hocName);
      baseComponentName = inner;
    }
  }
  return {
    baseComponentName,
    hocNames
  };
}

/***/ }),

/***/ "../react-devtools-shared/src/bridge.js":
/*!**********************************************!*\
  !*** ../react-devtools-shared/src/bridge.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BRIDGE_PROTOCOL": () => (/* binding */ BRIDGE_PROTOCOL),
/* harmony export */   "currentBridgeProtocol": () => (/* binding */ currentBridgeProtocol),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./events */ "../react-devtools-shared/src/events.js");
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

const BRIDGE_PROTOCOL = [{
  version: 0,
  minNpmVersion: '"<4.11.0"',
  maxNpmVersion: '"<4.11.0"'
}, {
  version: 1,
  minNpmVersion: '4.13.0',
  maxNpmVersion: '4.21.0'
}, {
  version: 2,
  minNpmVersion: '4.22.0',
  maxNpmVersion: null
}];
const currentBridgeProtocol = BRIDGE_PROTOCOL[BRIDGE_PROTOCOL.length - 1];
class Bridge extends _events__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor(wall) {
    super();
    _defineProperty(this, "_isShutdown", false);
    _defineProperty(this, "_messageQueue", []);
    _defineProperty(this, "_scheduledFlush", false);
    _defineProperty(this, "_wallUnlisten", null);
    _defineProperty(this, "_flush", () => {
      try {
        if (this._messageQueue.length) {
          for (let i = 0; i < this._messageQueue.length; i++) {
            const {
              event,
              payload
            } = this._messageQueue[i];
            this._wall.send(event, payload);
          }
          this._messageQueue.length = 0;
        }
      } finally {
        this._scheduledFlush = false;
      }
    });
    _defineProperty(this, "_handleMessage", message => {
      if (message === null || typeof message !== 'object' || !('event' in message)) {
        return;
      }
      const event = message.event;
      if (typeof event !== 'string' || event.length === 0) {
        throw new TypeError('Bridge event names must be non-empty strings.');
      }
      this._assertNotShutdown('receive a message');
      this.emit(event, message.payload);
    });
    _defineProperty(this, "overrideValueAtPath", ({
      id,
      path,
      rendererID,
      type,
      value
    }) => {
      switch (type) {
        case 'context':
          this.send('overrideContext', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;
        case 'hooks':
          this.send('overrideHookState', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;
        case 'props':
          this.send('overrideProps', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;
        case 'state':
          this.send('overrideState', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;
      }
    });
    this._wall = wall;
    const wallUnlisten = wall.listen(this._handleMessage);
    if (typeof wallUnlisten !== 'function') {
      throw new TypeError('Wall.listen() must return an unlisten function.');
    }
    this._wallUnlisten = wallUnlisten;
    this.addListener('overrideValueAtPath', this.overrideValueAtPath);
  }
  get wall() {
    return this._wall;
  }
  addListener(event, listener) {
    this._assertNotShutdown('add a listener');
    super.addListener(event, listener);
  }
  emit(event, ...args) {
    this._assertNotShutdown('emit an event');
    super.emit(event, ...args);
  }
  send(event, payload) {
    this._assertNotShutdown('send a message');
    if (typeof event !== 'string' || event.length === 0) {
      throw new TypeError('Bridge event names must be non-empty strings.');
    }
    this._messageQueue.push({
      event,
      payload
    });
    if (!this._scheduledFlush) {
      this._scheduledFlush = true;
      if (typeof devtoolsJestTestScheduler === 'function') {
        devtoolsJestTestScheduler(this._flush);
      } else {
        queueMicrotask(this._flush);
      }
    }
  }
  shutdown() {
    this._assertNotShutdown('shut down');
    this.emit('shutdown');
    this.send('shutdown');
    this._isShutdown = true;
    this.removeAllListeners();
    const wallUnlisten = this._wallUnlisten;
    this._wallUnlisten = null;
    try {
      if (wallUnlisten !== null) {
        wallUnlisten();
      }
    } finally {
      do {
        this._flush();
      } while (this._messageQueue.length);
    }
  }
  _assertNotShutdown(action) {
    if (this._isShutdown) {
      throw new Error(`Cannot ${action} through a Bridge that has been shut down.`);
    }
  }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Bridge);

/***/ }),

/***/ "../react-devtools-shared/src/constants.js":
/*!*************************************************!*\
  !*** ../react-devtools-shared/src/constants.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ANSI_STYLE_DIMMING_TEMPLATE": () => (/* binding */ ANSI_STYLE_DIMMING_TEMPLATE),
/* harmony export */   "ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK": () => (/* binding */ ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK),
/* harmony export */   "CHROME_WEBSTORE_EXTENSION_ID": () => (/* binding */ CHROME_WEBSTORE_EXTENSION_ID),
/* harmony export */   "FIREFOX_CONSOLE_DIMMING_COLOR": () => (/* binding */ FIREFOX_CONSOLE_DIMMING_COLOR),
/* harmony export */   "INTERNAL_EXTENSION_ID": () => (/* binding */ INTERNAL_EXTENSION_ID),
/* harmony export */   "LOCAL_EXTENSION_ID": () => (/* binding */ LOCAL_EXTENSION_ID),
/* harmony export */   "LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR": () => (/* binding */ LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR),
/* harmony export */   "LOCAL_STORAGE_BROWSER_THEME": () => (/* binding */ LOCAL_STORAGE_BROWSER_THEME),
/* harmony export */   "LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY": () => (/* binding */ LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY),
/* harmony export */   "LOCAL_STORAGE_DEFAULT_TAB_KEY": () => (/* binding */ LOCAL_STORAGE_DEFAULT_TAB_KEY),
/* harmony export */   "LOCAL_STORAGE_OPEN_IN_EDITOR_URL": () => (/* binding */ LOCAL_STORAGE_OPEN_IN_EDITOR_URL),
/* harmony export */   "LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET": () => (/* binding */ LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET),
/* harmony export */   "LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY": () => (/* binding */ LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY),
/* harmony export */   "LOCAL_STORAGE_SUPPORTS_PROFILING_KEY": () => (/* binding */ LOCAL_STORAGE_SUPPORTS_PROFILING_KEY),
/* harmony export */   "LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY": () => (/* binding */ LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY),
/* harmony export */   "PROFILER_EXPORT_VERSION": () => (/* binding */ PROFILER_EXPORT_VERSION),
/* harmony export */   "PROFILING_FLAG_BASIC_SUPPORT": () => (/* binding */ PROFILING_FLAG_BASIC_SUPPORT),
/* harmony export */   "PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT": () => (/* binding */ PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT),
/* harmony export */   "SESSION_STORAGE_LAST_SELECTION_KEY": () => (/* binding */ SESSION_STORAGE_LAST_SELECTION_KEY),
/* harmony export */   "SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY": () => (/* binding */ SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY),
/* harmony export */   "SESSION_STORAGE_RELOAD_AND_PROFILE_KEY": () => (/* binding */ SESSION_STORAGE_RELOAD_AND_PROFILE_KEY),
/* harmony export */   "SUSPENSE_TREE_OPERATION_ADD": () => (/* binding */ SUSPENSE_TREE_OPERATION_ADD),
/* harmony export */   "SUSPENSE_TREE_OPERATION_REMOVE": () => (/* binding */ SUSPENSE_TREE_OPERATION_REMOVE),
/* harmony export */   "SUSPENSE_TREE_OPERATION_REORDER_CHILDREN": () => (/* binding */ SUSPENSE_TREE_OPERATION_REORDER_CHILDREN),
/* harmony export */   "SUSPENSE_TREE_OPERATION_RESIZE": () => (/* binding */ SUSPENSE_TREE_OPERATION_RESIZE),
/* harmony export */   "SUSPENSE_TREE_OPERATION_SUSPENDERS": () => (/* binding */ SUSPENSE_TREE_OPERATION_SUSPENDERS),
/* harmony export */   "TREE_OPERATION_ADD": () => (/* binding */ TREE_OPERATION_ADD),
/* harmony export */   "TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE": () => (/* binding */ TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE),
/* harmony export */   "TREE_OPERATION_REMOVE": () => (/* binding */ TREE_OPERATION_REMOVE),
/* harmony export */   "TREE_OPERATION_REORDER_CHILDREN": () => (/* binding */ TREE_OPERATION_REORDER_CHILDREN),
/* harmony export */   "TREE_OPERATION_SET_SUBTREE_MODE": () => (/* binding */ TREE_OPERATION_SET_SUBTREE_MODE),
/* harmony export */   "TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS": () => (/* binding */ TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS),
/* harmony export */   "TREE_OPERATION_UPDATE_TREE_BASE_DURATION": () => (/* binding */ TREE_OPERATION_UPDATE_TREE_BASE_DURATION),
/* harmony export */   "UNKNOWN_SUSPENDERS_NONE": () => (/* binding */ UNKNOWN_SUSPENDERS_NONE),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_OLD_VERSION": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_OLD_VERSION),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_PRODUCTION": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_PRODUCTION),
/* harmony export */   "UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE": () => (/* binding */ UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE),
/* harmony export */   "__DEBUG__": () => (/* binding */ __DEBUG__),
/* harmony export */   "__PERFORMANCE_PROFILE__": () => (/* binding */ __PERFORMANCE_PROFILE__)
/* harmony export */ });
const CHROME_WEBSTORE_EXTENSION_ID = 'fmkadmapgofadopljbjfkapdkoienihi';
const INTERNAL_EXTENSION_ID = 'dnjnjgbfilfphmojnmhliehogmojhclc';
const LOCAL_EXTENSION_ID = 'ikiahnapldjmdmpkmfhjdjilojjhgcbf';
const __DEBUG__ = false;
const __PERFORMANCE_PROFILE__ = false;
const TREE_OPERATION_ADD = 1;
const TREE_OPERATION_REMOVE = 2;
const TREE_OPERATION_REORDER_CHILDREN = 3;
const TREE_OPERATION_UPDATE_TREE_BASE_DURATION = 4;
const TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS = 5;
const TREE_OPERATION_SET_SUBTREE_MODE = 7;
const SUSPENSE_TREE_OPERATION_ADD = 8;
const SUSPENSE_TREE_OPERATION_REMOVE = 9;
const SUSPENSE_TREE_OPERATION_REORDER_CHILDREN = 10;
const SUSPENSE_TREE_OPERATION_RESIZE = 11;
const SUSPENSE_TREE_OPERATION_SUSPENDERS = 12;
const TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE = 13;
const PROFILING_FLAG_BASIC_SUPPORT = 0b001;
const PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT = 0b100;
const UNKNOWN_SUSPENDERS_NONE = 0;
const UNKNOWN_SUSPENDERS_REASON_PRODUCTION = 1;
const UNKNOWN_SUSPENDERS_REASON_OLD_VERSION = 2;
const UNKNOWN_SUSPENDERS_REASON_THROWN_PROMISE = 3;
const LOCAL_STORAGE_DEFAULT_TAB_KEY = 'React::DevTools::defaultTab';
const LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY = 'React::DevTools::componentFilters';
const SESSION_STORAGE_LAST_SELECTION_KEY = 'React::DevTools::lastSelection';
const LOCAL_STORAGE_OPEN_IN_EDITOR_URL = 'React::DevTools::openInEditorUrl';
const LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET = 'React::DevTools::openInEditorUrlPreset';
const LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR = 'React::DevTools::alwaysOpenInEditor';
const LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY = 'React::DevTools::parseHookNames';
const SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY = 'React::DevTools::recordChangeDescriptions';
const SESSION_STORAGE_RELOAD_AND_PROFILE_KEY = 'React::DevTools::reloadAndProfile';
const LOCAL_STORAGE_BROWSER_THEME = 'React::DevTools::theme';
const LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY = 'React::DevTools::traceUpdatesEnabled';
const LOCAL_STORAGE_SUPPORTS_PROFILING_KEY = 'React::DevTools::supportsProfiling';
const PROFILER_EXPORT_VERSION = 5;
const FIREFOX_CONSOLE_DIMMING_COLOR = 'color: rgba(124, 124, 124, 0.75)';
const ANSI_STYLE_DIMMING_TEMPLATE = '\x1b[2;38;2;124;124;124m%s\x1b[0m';
const ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK = '\x1b[2;38;2;124;124;124m%s %o\x1b[0m';

/***/ }),

/***/ "../react-devtools-shared/src/events.js":
/*!**********************************************!*\
  !*** ../react-devtools-shared/src/events.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ EventEmitter)
/* harmony export */ });
/* harmony import */ var shared_reportGlobalError__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! shared/reportGlobalError */ "../shared/reportGlobalError.js");
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

class EventEmitter {
  constructor() {
    _defineProperty(this, "listenersMap", new Map());
  }
  addListener(event, listener) {
    const listeners = this.listenersMap.get(event);
    if (listeners === undefined) {
      this.listenersMap.set(event, [listener]);
    } else {
      const index = listeners.indexOf(listener);
      if (index < 0) {
        listeners.push(listener);
      }
    }
  }
  emit(event, ...args) {
    const listeners = this.listenersMap.get(event);
    if (listeners !== undefined) {
      if (listeners.length === 1) {
        const listener = listeners[0];
        listener.apply(null, args);
      } else {
        let didThrow = false;
        let caughtError = null;
        const clonedListeners = Array.from(listeners);
        for (let i = 0; i < clonedListeners.length; i++) {
          const listener = clonedListeners[i];
          try {
            listener.apply(null, args);
          } catch (error) {
            if (!didThrow) {
              didThrow = true;
              caughtError = error;
            } else {
              (0,shared_reportGlobalError__WEBPACK_IMPORTED_MODULE_0__["default"])(error);
            }
          }
        }
        if (didThrow) {
          throw caughtError;
        }
      }
    }
  }
  removeAllListeners() {
    this.listenersMap.clear();
  }
  removeListener(event, listener) {
    const listeners = this.listenersMap.get(event);
    if (listeners !== undefined) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }
}

/***/ }),

/***/ "../react-devtools-shared/src/frontend/types.js":
/*!******************************************************!*\
  !*** ../react-devtools-shared/src/frontend/types.js ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActivityHiddenMode": () => (/* binding */ ActivityHiddenMode),
/* harmony export */   "ActivityVisibleMode": () => (/* binding */ ActivityVisibleMode),
/* harmony export */   "ComponentFilterActivitySlice": () => (/* binding */ ComponentFilterActivitySlice),
/* harmony export */   "ComponentFilterDisplayName": () => (/* binding */ ComponentFilterDisplayName),
/* harmony export */   "ComponentFilterElementType": () => (/* binding */ ComponentFilterElementType),
/* harmony export */   "ComponentFilterEnvironmentName": () => (/* binding */ ComponentFilterEnvironmentName),
/* harmony export */   "ComponentFilterHOC": () => (/* binding */ ComponentFilterHOC),
/* harmony export */   "ComponentFilterLocation": () => (/* binding */ ComponentFilterLocation),
/* harmony export */   "ElementTypeActivity": () => (/* binding */ ElementTypeActivity),
/* harmony export */   "ElementTypeClass": () => (/* binding */ ElementTypeClass),
/* harmony export */   "ElementTypeContext": () => (/* binding */ ElementTypeContext),
/* harmony export */   "ElementTypeForwardRef": () => (/* binding */ ElementTypeForwardRef),
/* harmony export */   "ElementTypeFunction": () => (/* binding */ ElementTypeFunction),
/* harmony export */   "ElementTypeHostComponent": () => (/* binding */ ElementTypeHostComponent),
/* harmony export */   "ElementTypeMemo": () => (/* binding */ ElementTypeMemo),
/* harmony export */   "ElementTypeOtherOrUnknown": () => (/* binding */ ElementTypeOtherOrUnknown),
/* harmony export */   "ElementTypeProfiler": () => (/* binding */ ElementTypeProfiler),
/* harmony export */   "ElementTypeRoot": () => (/* binding */ ElementTypeRoot),
/* harmony export */   "ElementTypeSuspense": () => (/* binding */ ElementTypeSuspense),
/* harmony export */   "ElementTypeSuspenseList": () => (/* binding */ ElementTypeSuspenseList),
/* harmony export */   "ElementTypeTracingMarker": () => (/* binding */ ElementTypeTracingMarker),
/* harmony export */   "ElementTypeViewTransition": () => (/* binding */ ElementTypeViewTransition),
/* harmony export */   "ElementTypeVirtual": () => (/* binding */ ElementTypeVirtual),
/* harmony export */   "StrictMode": () => (/* binding */ StrictMode)
/* harmony export */ });
const ElementTypeClass = 1;
const ElementTypeContext = 2;
const ElementTypeFunction = 5;
const ElementTypeForwardRef = 6;
const ElementTypeHostComponent = 7;
const ElementTypeMemo = 8;
const ElementTypeOtherOrUnknown = 9;
const ElementTypeProfiler = 10;
const ElementTypeRoot = 11;
const ElementTypeSuspense = 12;
const ElementTypeSuspenseList = 13;
const ElementTypeTracingMarker = 14;
const ElementTypeVirtual = 15;
const ElementTypeViewTransition = 16;
const ElementTypeActivity = 17;
const ComponentFilterElementType = 1;
const ComponentFilterDisplayName = 2;
const ComponentFilterLocation = 3;
const ComponentFilterHOC = 4;
const ComponentFilterEnvironmentName = 5;
const ComponentFilterActivitySlice = 6;
const StrictMode = 1;
const ActivityHiddenMode = 2;
const ActivityVisibleMode = 3;

/***/ }),

/***/ "../react-devtools-shared/src/hydration.js":
/*!*************************************************!*\
  !*** ../react-devtools-shared/src/hydration.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "dehydrate": () => (/* binding */ dehydrate),
/* harmony export */   "fillInPath": () => (/* binding */ fillInPath),
/* harmony export */   "hydrate": () => (/* binding */ hydrate),
/* harmony export */   "meta": () => (/* binding */ meta)
/* harmony export */ });
/* harmony import */ var react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/utils */ "../react-devtools-shared/src/utils.js");
/* harmony import */ var shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! shared/ReactSymbols */ "../shared/ReactSymbols.js");
/* harmony import */ var shared_noop__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! shared/noop */ "../shared/noop.js");



const meta = {
  inspectable: Symbol('inspectable'),
  inspected: Symbol('inspected'),
  name: Symbol('name'),
  preview_long: Symbol('preview_long'),
  preview_short: Symbol('preview_short'),
  readonly: Symbol('readonly'),
  size: Symbol('size'),
  type: Symbol('type'),
  unserializable: Symbol('unserializable')
};
const LEVEL_THRESHOLD = 2;
function createDehydrated(type, inspectable, data, cleaned, path) {
  cleaned.push(path);
  const dehydrated = {
    inspectable,
    type,
    preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
    preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
    name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
  };
  if (type === 'array' || type === 'typed_array') {
    dehydrated.size = data.length;
  } else if (type === 'object') {
    dehydrated.size = Object.keys(data).length;
  }
  if (type === 'iterator' || type === 'typed_array') {
    dehydrated.readonly = true;
  }
  return dehydrated;
}
function dehydrate(data, cleaned, unserializable, path, isPathAllowed, level = 0) {
  const type = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getDataType)(data);
  let isPathAllowedCheck;
  switch (type) {
    case 'html_element':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.tagName,
        type
      };
    case 'function':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: typeof data.name === 'function' || !data.name ? 'function' : data.name,
        type
      };
    case 'string':
      isPathAllowedCheck = isPathAllowed(path);
      if (isPathAllowedCheck) {
        return data;
      } else {
        return data.length <= 500 ? data : data.slice(0, 500) + '...';
      }
    case 'bigint':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'symbol':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'react_element':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          cleaned.push(path);
          return {
            inspectable: true,
            preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
            preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
            name: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getDisplayNameForReactElement)(data) || 'Unknown',
            type
          };
        }
        const unserializableValue = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getDisplayNameForReactElement)(data) || 'Unknown'
        };
        unserializableValue.key = dehydrate(data.key, cleaned, unserializable, path.concat(['key']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        if (data.$$typeof === shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LEGACY_ELEMENT_TYPE) {
          unserializableValue.ref = dehydrate(data.ref, cleaned, unserializable, path.concat(['ref']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        }
        unserializableValue.props = dehydrate(data.props, cleaned, unserializable, path.concat(['props']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        unserializable.push(path);
        return unserializableValue;
      }
    case 'react_lazy':
      {
        isPathAllowedCheck = isPathAllowed(path);
        const payload = data._payload;
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          cleaned.push(path);
          const inspectable = payload !== null && typeof payload === 'object' && (payload._status === 1 || payload._status === 2 || payload.status === 'fulfilled' || payload.status === 'rejected');
          return {
            inspectable,
            preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
            preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
            name: 'lazy()',
            type
          };
        }
        const unserializableValue = {
          unserializable: true,
          type: type,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: 'lazy()'
        };
        unserializableValue._payload = dehydrate(payload, cleaned, unserializable, path.concat(['_payload']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        unserializable.push(path);
        return unserializableValue;
      }
    case 'array_buffer':
    case 'data_view':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: type === 'data_view' ? 'DataView' : 'ArrayBuffer',
        size: data.byteLength,
        type
      };
    case 'array':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      }
      const arr = [];
      for (let i = 0; i < data.length; i++) {
        arr[i] = dehydrateKey(data, i, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
      }
      return arr;
    case 'html_all_collection':
    case 'typed_array':
    case 'iterator':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const unserializableValue = {
          unserializable: true,
          type: type,
          readonly: true,
          size: type === 'typed_array' ? data.length : undefined,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
        };
        Array.from(data).forEach((item, i) => unserializableValue[i] = dehydrate(item, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1));
        unserializable.push(path);
        return unserializableValue;
      }
    case 'opaque_iterator':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data[Symbol.toStringTag],
        type
      };
    case 'date':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'regexp':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
        preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
        name: data.toString(),
        type
      };
    case 'thenable':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        cleaned.push(path);
        return {
          inspectable: data.status === 'fulfilled' || data.status === 'rejected',
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: data.toString(),
          type
        };
      }
      if (data.status === 'resolved_model' || data.status === 'resolve_module') {
        data.then(shared_noop__WEBPACK_IMPORTED_MODULE_2__["default"]);
      }
      switch (data.status) {
        case 'fulfilled':
          {
            const unserializableValue = {
              unserializable: true,
              type: type,
              preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
              preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
              name: 'fulfilled Thenable'
            };
            unserializableValue.value = dehydrate(data.value, cleaned, unserializable, path.concat(['value']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
            unserializable.push(path);
            return unserializableValue;
          }
        case 'rejected':
          {
            const unserializableValue = {
              unserializable: true,
              type: type,
              preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
              preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
              name: 'rejected Thenable'
            };
            unserializableValue.reason = dehydrate(data.reason, cleaned, unserializable, path.concat(['reason']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
            unserializable.push(path);
            return unserializableValue;
          }
        default:
          cleaned.push(path);
          return {
            inspectable: false,
            preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
            preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
            name: data.toString(),
            type
          };
      }
    case 'object':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const object = {};
        (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getAllEnumerableKeys)(data).forEach(key => {
          const name = key.toString();
          object[name] = dehydrateKey(data, key, cleaned, unserializable, path.concat([name]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        return object;
      }
    case 'class_instance':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          return createDehydrated(type, true, data, cleaned, path);
        }
        const value = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' ? '' : data.constructor.name
        };
        (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getAllEnumerableKeys)(data).forEach(key => {
          const keyAsString = key.toString();
          value[keyAsString] = dehydrate(data[key], cleaned, unserializable, path.concat([keyAsString]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        unserializable.push(path);
        return value;
      }
    case 'error':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          return createDehydrated(type, true, data, cleaned, path);
        }
        const value = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, false),
          preview_long: (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.formatDataForPreview)(data, true),
          name: data.name
        };
        value.message = dehydrate(data.message, cleaned, unserializable, path.concat(['message']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        value.stack = dehydrate(data.stack, cleaned, unserializable, path.concat(['stack']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        if ('cause' in data) {
          value.cause = dehydrate(data.cause, cleaned, unserializable, path.concat(['cause']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        }
        (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getAllEnumerableKeys)(data).forEach(key => {
          const keyAsString = key.toString();
          value[keyAsString] = dehydrate(data[key], cleaned, unserializable, path.concat([keyAsString]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        unserializable.push(path);
        return value;
      }
    case 'infinity':
    case '-infinity':
    case 'nan':
    case 'undefined':
      cleaned.push(path);
      return {
        type
      };
    default:
      return data;
  }
}
function dehydrateKey(parent, key, cleaned, unserializable, path, isPathAllowed, level = 0) {
  try {
    return dehydrate(parent[key], cleaned, unserializable, path, isPathAllowed, level);
  } catch (error) {
    let preview = '';
    if (typeof error === 'object' && error !== null && typeof error.stack === 'string') {
      preview = error.stack;
    } else if (typeof error === 'string') {
      preview = error;
    }
    cleaned.push(path);
    return {
      inspectable: false,
      preview_short: '[Exception]',
      preview_long: preview ? '[Exception: ' + preview + ']' : '[Exception]',
      name: preview,
      type: 'unknown'
    };
  }
}
function fillInPath(object, data, path, value) {
  const target = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getInObject)(object, path);
  if (target != null) {
    if (!target[meta.unserializable]) {
      delete target[meta.inspectable];
      delete target[meta.inspected];
      delete target[meta.name];
      delete target[meta.preview_long];
      delete target[meta.preview_short];
      delete target[meta.readonly];
      delete target[meta.size];
      delete target[meta.type];
    }
  }
  if (value !== null && data.unserializable.length > 0) {
    const unserializablePath = data.unserializable[0];
    let isMatch = unserializablePath.length === path.length;
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== unserializablePath[i]) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      upgradeUnserializable(value, value);
    }
  }
  (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.setInObject)(object, path, value);
}
function hydrate(object, cleaned, unserializable) {
  cleaned.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getInObject)(object, path.slice(0, length - 1));
    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }
    const value = parent[last];
    if (!value) {
      return;
    } else if (value.type === 'infinity') {
      parent[last] = Infinity;
    } else if (value.type === '-infinity') {
      parent[last] = -Infinity;
    } else if (value.type === 'nan') {
      parent[last] = NaN;
    } else if (value.type === 'undefined') {
      parent[last] = undefined;
    } else {
      const replaced = {};
      replaced[meta.inspectable] = !!value.inspectable;
      replaced[meta.inspected] = false;
      replaced[meta.name] = value.name;
      replaced[meta.preview_long] = value.preview_long;
      replaced[meta.preview_short] = value.preview_short;
      replaced[meta.size] = value.size;
      replaced[meta.readonly] = !!value.readonly;
      replaced[meta.type] = value.type;
      parent[last] = replaced;
    }
  });
  unserializable.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = (0,react_devtools_shared_src_utils__WEBPACK_IMPORTED_MODULE_0__.getInObject)(object, path.slice(0, length - 1));
    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }
    const node = parent[last];
    const replacement = {
      ...node
    };
    upgradeUnserializable(replacement, node);
    parent[last] = replacement;
  });
  return object;
}
function upgradeUnserializable(destination, source) {
  Object.defineProperties(destination, {
    [meta.inspected]: {
      configurable: true,
      enumerable: false,
      value: !!source.inspected
    },
    [meta.name]: {
      configurable: true,
      enumerable: false,
      value: source.name
    },
    [meta.preview_long]: {
      configurable: true,
      enumerable: false,
      value: source.preview_long
    },
    [meta.preview_short]: {
      configurable: true,
      enumerable: false,
      value: source.preview_short
    },
    [meta.size]: {
      configurable: true,
      enumerable: false,
      value: source.size
    },
    [meta.readonly]: {
      configurable: true,
      enumerable: false,
      value: !!source.readonly
    },
    [meta.type]: {
      configurable: true,
      enumerable: false,
      value: source.type
    },
    [meta.unserializable]: {
      configurable: true,
      enumerable: false,
      value: !!source.unserializable
    }
  });
  delete destination.inspected;
  delete destination.name;
  delete destination.preview_long;
  delete destination.preview_short;
  delete destination.size;
  delete destination.readonly;
  delete destination.type;
  delete destination.unserializable;
}

/***/ }),

/***/ "../react-devtools-shared/src/isArray.js":
/*!***********************************************!*\
  !*** ../react-devtools-shared/src/isArray.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const isArray = Array.isArray;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (isArray);

/***/ }),

/***/ "../react-devtools-shared/src/storage.js":
/*!***********************************************!*\
  !*** ../react-devtools-shared/src/storage.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "localStorageGetItem": () => (/* binding */ localStorageGetItem),
/* harmony export */   "localStorageRemoveItem": () => (/* binding */ localStorageRemoveItem),
/* harmony export */   "localStorageSetItem": () => (/* binding */ localStorageSetItem),
/* harmony export */   "sessionStorageGetItem": () => (/* binding */ sessionStorageGetItem),
/* harmony export */   "sessionStorageRemoveItem": () => (/* binding */ sessionStorageRemoveItem),
/* harmony export */   "sessionStorageSetItem": () => (/* binding */ sessionStorageSetItem)
/* harmony export */ });
function localStorageGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}
function localStorageRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {}
}
function localStorageSetItem(key, value) {
  try {
    return localStorage.setItem(key, value);
  } catch (error) {}
}
function sessionStorageGetItem(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}
function sessionStorageRemoveItem(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {}
}
function sessionStorageSetItem(key, value) {
  try {
    return sessionStorage.setItem(key, value);
  } catch (error) {}
}

/***/ }),

/***/ "../react-devtools-shared/src/utils.js":
/*!*********************************************!*\
  !*** ../react-devtools-shared/src/utils.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "alphaSortKeys": () => (/* binding */ alphaSortKeys),
/* harmony export */   "backendToFrontendSerializedElementMapper": () => (/* binding */ backendToFrontendSerializedElementMapper),
/* harmony export */   "deletePathInObject": () => (/* binding */ deletePathInObject),
/* harmony export */   "formatDataForPreview": () => (/* binding */ formatDataForPreview),
/* harmony export */   "getAllEnumerableKeys": () => (/* binding */ getAllEnumerableKeys),
/* harmony export */   "getAlwaysOpenInEditor": () => (/* binding */ getAlwaysOpenInEditor),
/* harmony export */   "getDataType": () => (/* binding */ getDataType),
/* harmony export */   "getDefaultComponentFilters": () => (/* binding */ getDefaultComponentFilters),
/* harmony export */   "getDefaultOpenInEditorURL": () => (/* binding */ getDefaultOpenInEditorURL),
/* harmony export */   "getDefaultPreset": () => (/* binding */ getDefaultPreset),
/* harmony export */   "getDisplayName": () => (/* binding */ getDisplayName),
/* harmony export */   "getDisplayNameForReactElement": () => (/* binding */ getDisplayNameForReactElement),
/* harmony export */   "getIfReloadedAndProfiling": () => (/* binding */ getIfReloadedAndProfiling),
/* harmony export */   "getInObject": () => (/* binding */ getInObject),
/* harmony export */   "getIsReloadAndProfileSupported": () => (/* binding */ getIsReloadAndProfileSupported),
/* harmony export */   "getOpenInEditorURL": () => (/* binding */ getOpenInEditorURL),
/* harmony export */   "getProfilingSettings": () => (/* binding */ getProfilingSettings),
/* harmony export */   "getSavedComponentFilters": () => (/* binding */ getSavedComponentFilters),
/* harmony export */   "getUID": () => (/* binding */ getUID),
/* harmony export */   "getWrappedDisplayName": () => (/* binding */ getWrappedDisplayName),
/* harmony export */   "isPlainObject": () => (/* binding */ isPlainObject),
/* harmony export */   "normalizeUrlIfValid": () => (/* binding */ normalizeUrlIfValid),
/* harmony export */   "onReloadAndProfile": () => (/* binding */ onReloadAndProfile),
/* harmony export */   "onReloadAndProfileFlagsReset": () => (/* binding */ onReloadAndProfileFlagsReset),
/* harmony export */   "parseElementDisplayNameFromBackend": () => (/* binding */ parseElementDisplayNameFromBackend),
/* harmony export */   "persistableComponentFilters": () => (/* binding */ persistableComponentFilters),
/* harmony export */   "printOperationsArray": () => (/* binding */ printOperationsArray),
/* harmony export */   "renamePathInObject": () => (/* binding */ renamePathInObject),
/* harmony export */   "setInObject": () => (/* binding */ setInObject),
/* harmony export */   "setSavedComponentFilters": () => (/* binding */ setSavedComponentFilters),
/* harmony export */   "shallowDiffers": () => (/* binding */ shallowDiffers),
/* harmony export */   "unionOfTwoArrays": () => (/* binding */ unionOfTwoArrays),
/* harmony export */   "utfDecodeStringWithRanges": () => (/* binding */ utfDecodeStringWithRanges),
/* harmony export */   "utfEncodeString": () => (/* binding */ utfEncodeString)
/* harmony export */ });
/* harmony import */ var lru_cache__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lru-cache */ "../../node_modules/lru-cache/index.js");
/* harmony import */ var lru_cache__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lru_cache__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! shared/ReactSymbols */ "../shared/ReactSymbols.js");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./constants */ "../react-devtools-shared/src/constants.js");
/* harmony import */ var _frontend_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-devtools-shared/src/frontend/types */ "../react-devtools-shared/src/frontend/types.js");
/* harmony import */ var react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-devtools-shared/src/storage */ "../react-devtools-shared/src/storage.js");
/* harmony import */ var _hydration__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./hydration */ "../react-devtools-shared/src/hydration.js");
/* harmony import */ var _isArray__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./isArray */ "../react-devtools-shared/src/isArray.js");
/* harmony import */ var _backend_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./backend/utils */ "../react-devtools-shared/src/backend/utils/index.js");









const hasOwnProperty = Object.prototype.hasOwnProperty;
const cachedDisplayNames = new WeakMap();
const encodedStringCache = new (lru_cache__WEBPACK_IMPORTED_MODULE_0___default())({
  max: 1000
});
const LEGACY_REACT_PROVIDER_TYPE = Symbol.for('react.provider');
function alphaSortKeys(a, b) {
  if (a.toString() > b.toString()) {
    return 1;
  } else if (b.toString() > a.toString()) {
    return -1;
  } else {
    return 0;
  }
}
function getAllEnumerableKeys(obj) {
  const keys = new Set();
  let current = obj;
  while (current != null) {
    const currentKeys = [...Object.keys(current), ...Object.getOwnPropertySymbols(current)];
    const descriptors = Object.getOwnPropertyDescriptors(current);
    currentKeys.forEach(key => {
      if (descriptors[key].enumerable) {
        keys.add(key);
      }
    });
    current = Object.getPrototypeOf(current);
  }
  return keys;
}
function getWrappedDisplayName(outerType, innerType, wrapperName, fallbackName) {
  const displayName = outerType?.displayName;
  return displayName || `${wrapperName}(${getDisplayName(innerType, fallbackName)})`;
}
function getDisplayName(type, fallbackName = 'Anonymous') {
  const nameFromCache = cachedDisplayNames.get(type);
  if (nameFromCache != null) {
    return nameFromCache;
  }
  let displayName = fallbackName;
  if (typeof type.displayName === 'string') {
    displayName = type.displayName;
  } else if (typeof type.name === 'string' && type.name !== '') {
    displayName = type.name;
  }
  cachedDisplayNames.set(type, displayName);
  return displayName;
}
let uidCounter = 0;
function getUID() {
  return ++uidCounter;
}
function utfDecodeStringWithRanges(array, left, right) {
  let string = '';
  for (let i = left; i <= right; i++) {
    string += String.fromCodePoint(array[i]);
  }
  return string;
}
function surrogatePairToCodePoint(charCode1, charCode2) {
  return ((charCode1 & 0x3ff) << 10) + (charCode2 & 0x3ff) + 0x10000;
}
function utfEncodeString(string) {
  const cached = encodedStringCache.get(string);
  if (cached !== undefined) {
    return cached;
  }
  const encoded = [];
  let i = 0;
  let charCode;
  while (i < string.length) {
    charCode = string.charCodeAt(i);
    if ((charCode & 0xf800) === 0xd800) {
      encoded.push(surrogatePairToCodePoint(charCode, string.charCodeAt(++i)));
    } else {
      encoded.push(charCode);
    }
    ++i;
  }
  encodedStringCache.set(string, encoded);
  return encoded;
}
function printOperationsArray(operations) {
  const rendererID = operations[0];
  const rootID = operations[1];
  const logs = [`operations for renderer:${rendererID} and root:${rootID}`];
  let i = 2;
  const stringTable = [null];
  const stringTableSize = operations[i++];
  const stringTableEnd = i + stringTableSize;
  while (i < stringTableEnd) {
    const nextLength = operations[i++];
    const nextString = utfDecodeStringWithRanges(operations, i, i + nextLength - 1);
    stringTable.push(nextString);
    i += nextLength;
  }
  while (i < operations.length) {
    const operation = operations[i];
    switch (operation) {
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_ADD:
        {
          const id = operations[i + 1];
          const type = operations[i + 2];
          i += 3;
          if (type === _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeRoot) {
            logs.push(`Add new root node ${id}`);
            i++;
            i++;
            i++;
            i++;
          } else {
            const parentID = operations[i];
            i++;
            i++;
            const displayNameStringID = operations[i];
            const displayName = stringTable[displayNameStringID];
            i++;
            i++;
            i++;
            logs.push(`Add node ${id} (${displayName || 'null'}) as child of ${parentID}`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;
          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            const id = operations[i];
            i += 1;
            logs.push(`Remove node ${id}`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_SET_SUBTREE_MODE:
        {
          const id = operations[i + 1];
          const mode = operations[i + 2];
          i += 3;
          logs.push(`Mode ${mode} set for subtree with root ${id}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_REORDER_CHILDREN:
        {
          const id = operations[i + 1];
          const numChildren = operations[i + 2];
          i += 3;
          const children = operations.slice(i, i + numChildren);
          i += numChildren;
          logs.push(`Re-order node ${id} children ${children.join(',')}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
        i += 3;
        break;
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
        {
          const id = operations[i + 1];
          const numErrors = operations[i + 2];
          const numWarnings = operations[i + 3];
          i += 4;
          logs.push(`Node ${id} has ${numErrors} errors and ${numWarnings} warnings`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_ADD:
        {
          const fiberID = operations[i + 1];
          const parentID = operations[i + 2];
          const nameStringID = operations[i + 3];
          const isSuspended = operations[i + 4];
          const numRects = operations[i + 5];
          i += 6;
          const name = stringTable[nameStringID];
          let rects;
          if (numRects === -1) {
            rects = 'null';
          } else {
            rects = '[';
            for (let rectIndex = 0; rectIndex < numRects; rectIndex++) {
              const offset = i + rectIndex * 4;
              const x = operations[offset + 0];
              const y = operations[offset + 1];
              const width = operations[offset + 2];
              const height = operations[offset + 3];
              if (rectIndex > 0) {
                rects += ', ';
              }
              rects += `(${x}, ${y}, ${width}, ${height})`;
              i += 4;
            }
            rects += ']';
          }
          logs.push(`Add suspense node ${fiberID} (${String(name)},rects={${rects}}) under ${parentID} suspended ${isSuspended}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;
          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            const id = operations[i];
            i += 1;
            logs.push(`Remove suspense node ${id}`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_REORDER_CHILDREN:
        {
          const id = operations[i + 1];
          const numChildren = operations[i + 2];
          i += 3;
          const children = operations.slice(i, i + numChildren);
          i += numChildren;
          logs.push(`Re-order suspense node ${id} children ${children.join(',')}`);
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_RESIZE:
        {
          const id = operations[i + 1];
          const numRects = operations[i + 2];
          i += 3;
          if (numRects === -1) {
            logs.push(`Resize suspense node ${id} to null`);
          } else {
            let line = `Resize suspense node ${id} to [`;
            for (let rectIndex = 0; rectIndex < numRects; rectIndex++) {
              const x = operations[i + 0];
              const y = operations[i + 1];
              const width = operations[i + 2];
              const height = operations[i + 3];
              if (rectIndex > 0) {
                line += ', ';
              }
              line += `(${x}, ${y}, ${width}, ${height})`;
              i += 4;
            }
            logs.push(line + ']');
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.SUSPENSE_TREE_OPERATION_SUSPENDERS:
        {
          i++;
          const changeLength = operations[i++];
          for (let changeIndex = 0; changeIndex < changeLength; changeIndex++) {
            const id = operations[i++];
            const hasUniqueSuspenders = operations[i++] === 1;
            const endTime = operations[i++] / 1000;
            const isSuspended = operations[i++] === 1;
            const environmentNamesLength = operations[i++];
            i += environmentNamesLength;
            logs.push(`Suspense node ${id} unique suspenders set to ${String(hasUniqueSuspenders)} ending at ${String(endTime)} is suspended set to ${String(isSuspended)} with ${String(environmentNamesLength)} environments`);
          }
          break;
        }
      case _constants__WEBPACK_IMPORTED_MODULE_2__.TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE:
        {
          i++;
          const activitySliceIDChange = operations[i++];
          logs.push(activitySliceIDChange === 0 ? 'Reset applied activity slice' : 'Applied activity slice change to ' + activitySliceIDChange);
          break;
        }
      default:
        throw Error(`Unsupported Bridge operation "${operation}"`);
    }
  }
  console.log(logs.join('\n  '));
}
function getDefaultComponentFilters() {
  return [{
    type: _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ComponentFilterElementType,
    value: _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeHostComponent,
    isEnabled: true
  }];
}
function getSavedComponentFilters() {
  try {
    const raw = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY);
    if (raw != null) {
      const parsedFilters = JSON.parse(raw);
      return persistableComponentFilters(parsedFilters);
    }
  } catch (error) {}
  return getDefaultComponentFilters();
}
function setSavedComponentFilters(componentFilters) {
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageSetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY, JSON.stringify(persistableComponentFilters(componentFilters)));
}
function persistableComponentFilters(componentFilters) {
  if (!Array.isArray(componentFilters)) {
    return componentFilters;
  }
  return componentFilters.filter(f => {
    return f.type !== _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ComponentFilterLocation && f.type !== _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ComponentFilterActivitySlice;
  });
}
const vscodeFilepath = 'vscode://file/{path}:{line}:{column}';
function getDefaultPreset() {
  return  false ? 0 : 'vscode';
}
function getDefaultOpenInEditorURL() {
  return  false ? 0 : vscodeFilepath;
}
function getOpenInEditorURL() {
  try {
    const rawPreset = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET);
    switch (rawPreset) {
      case '"vscode"':
        return vscodeFilepath;
    }
    const raw = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_OPEN_IN_EDITOR_URL);
    if (raw != null) {
      return JSON.parse(raw);
    }
  } catch (error) {}
  return getDefaultOpenInEditorURL();
}
function getAlwaysOpenInEditor() {
  try {
    const raw = (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.localStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR);
    return raw === 'true';
  } catch (error) {}
  return false;
}
function parseElementDisplayNameFromBackend(displayName, type) {
  if (displayName === null) {
    return {
      formattedDisplayName: null,
      hocDisplayNames: null,
      compiledWithForget: false
    };
  }
  if (displayName.startsWith('Forget(')) {
    const displayNameWithoutForgetWrapper = displayName.slice(7, displayName.length - 1);
    const {
      formattedDisplayName,
      hocDisplayNames
    } = parseElementDisplayNameFromBackend(displayNameWithoutForgetWrapper, type);
    return {
      formattedDisplayName,
      hocDisplayNames,
      compiledWithForget: true
    };
  }
  let hocDisplayNames = null;
  switch (type) {
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeClass:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeForwardRef:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeFunction:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeMemo:
    case _frontend_types__WEBPACK_IMPORTED_MODULE_3__.ElementTypeVirtual:
      if (displayName.indexOf('(') >= 0) {
        const matches = displayName.match(/[^()]+/g);
        if (matches != null) {
          displayName = matches.pop();
          hocDisplayNames = matches;
        }
      }
      break;
    default:
      break;
  }
  return {
    formattedDisplayName: displayName,
    hocDisplayNames,
    compiledWithForget: false
  };
}
function shallowDiffers(prev, next) {
  for (const attribute in prev) {
    if (!(attribute in next)) {
      return true;
    }
  }
  for (const attribute in next) {
    if (prev[attribute] !== next[attribute]) {
      return true;
    }
  }
  return false;
}
function getInObject(object, path) {
  return path.reduce((reduced, attr) => {
    if (reduced) {
      if (hasOwnProperty.call(reduced, attr)) {
        return reduced[attr];
      }
      if (typeof reduced[Symbol.iterator] === 'function') {
        return Array.from(reduced)[attr];
      }
    }
    return null;
  }, object);
}
function deletePathInObject(object, path) {
  const length = path.length;
  const last = path[length - 1];
  if (object != null) {
    const parent = getInObject(object, path.slice(0, length - 1));
    if (parent) {
      if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(parent)) {
        parent.splice(last, 1);
      } else {
        delete parent[last];
      }
    }
  }
}
function renamePathInObject(object, oldPath, newPath) {
  const length = oldPath.length;
  if (object != null) {
    const parent = getInObject(object, oldPath.slice(0, length - 1));
    if (parent) {
      const lastOld = oldPath[length - 1];
      const lastNew = newPath[length - 1];
      parent[lastNew] = parent[lastOld];
      if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(parent)) {
        parent.splice(lastOld, 1);
      } else {
        delete parent[lastOld];
      }
    }
  }
}
function setInObject(object, path, value) {
  const length = path.length;
  const last = path[length - 1];
  if (object != null) {
    const parent = getInObject(object, path.slice(0, length - 1));
    if (parent) {
      parent[last] = value;
    }
  }
}
function isError(data) {
  if ('name' in data && 'message' in data) {
    while (data) {
      if (Object.prototype.toString.call(data) === '[object Error]') {
        return true;
      }
      data = Object.getPrototypeOf(data);
    }
  }
  return false;
}
function getDataType(data) {
  if (data === null) {
    return 'null';
  } else if (data === undefined) {
    return 'undefined';
  }
  if (typeof HTMLElement !== 'undefined' && data instanceof HTMLElement) {
    return 'html_element';
  }
  const type = typeof data;
  switch (type) {
    case 'bigint':
      return 'bigint';
    case 'boolean':
      return 'boolean';
    case 'function':
      return 'function';
    case 'number':
      if (Number.isNaN(data)) {
        return 'nan';
      } else if (!Number.isFinite(data)) {
        return data > 0 ? 'infinity' : '-infinity';
      } else {
        return 'number';
      }
    case 'object':
      switch (data.$$typeof) {
        case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_ELEMENT_TYPE:
        case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LEGACY_ELEMENT_TYPE:
          return 'react_element';
        case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LAZY_TYPE:
          return 'react_lazy';
      }
      if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(data)) {
        return 'array';
      } else if (ArrayBuffer.isView(data)) {
        return hasOwnProperty.call(data.constructor, 'BYTES_PER_ELEMENT') ? 'typed_array' : 'data_view';
      } else if (data.constructor && data.constructor.name === 'ArrayBuffer') {
        return 'array_buffer';
      } else if (typeof data[Symbol.iterator] === 'function') {
        const iterator = data[Symbol.iterator]();
        if (!iterator) {} else {
          return iterator === data ? 'opaque_iterator' : 'iterator';
        }
      } else if (data.constructor && data.constructor.name === 'RegExp') {
        return 'regexp';
      } else if (typeof data.then === 'function') {
        return 'thenable';
      } else if (isError(data)) {
        return 'error';
      } else {
        const toStringValue = Object.prototype.toString.call(data);
        if (toStringValue === '[object Date]') {
          return 'date';
        } else if (toStringValue === '[object HTMLAllCollection]') {
          return 'html_all_collection';
        }
      }
      if (!isPlainObject(data)) {
        return 'class_instance';
      }
      return 'object';
    case 'string':
      return 'string';
    case 'symbol':
      return 'symbol';
    case 'undefined':
      if (Object.prototype.toString.call(data) === '[object HTMLAllCollection]') {
        return 'html_all_collection';
      }
      return 'undefined';
    default:
      return 'unknown';
  }
}
function typeOfWithLegacyElementSymbol(object) {
  if (typeof object === 'object' && object !== null) {
    const $$typeof = object.$$typeof;
    switch ($$typeof) {
      case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_ELEMENT_TYPE:
      case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LEGACY_ELEMENT_TYPE:
        const type = object.type;
        switch (type) {
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FRAGMENT_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PROFILER_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_STRICT_MODE_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_LIST_TYPE:
          case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_VIEW_TRANSITION_TYPE:
            return type;
          default:
            const $$typeofType = type && type.$$typeof;
            switch ($$typeofType) {
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONTEXT_TYPE:
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FORWARD_REF_TYPE:
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LAZY_TYPE:
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_MEMO_TYPE:
                return $$typeofType;
              case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONSUMER_TYPE:
                return $$typeofType;
              default:
                return $$typeof;
            }
        }
      case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }
  return undefined;
}
function getDisplayNameForReactElement(element) {
  const elementType = typeOfWithLegacyElementSymbol(element);
  switch (elementType) {
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONSUMER_TYPE:
      return 'ContextConsumer';
    case LEGACY_REACT_PROVIDER_TYPE:
      return 'ContextProvider';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_CONTEXT_TYPE:
      return 'Context';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FORWARD_REF_TYPE:
      return 'ForwardRef';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_FRAGMENT_TYPE:
      return 'Fragment';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_LAZY_TYPE:
      return 'Lazy';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_MEMO_TYPE:
      return 'Memo';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PORTAL_TYPE:
      return 'Portal';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_PROFILER_TYPE:
      return 'Profiler';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_STRICT_MODE_TYPE:
      return 'StrictMode';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_TYPE:
      return 'Suspense';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_VIEW_TRANSITION_TYPE:
      return 'ViewTransition';
    case shared_ReactSymbols__WEBPACK_IMPORTED_MODULE_1__.REACT_TRACING_MARKER_TYPE:
      return 'TracingMarker';
    default:
      const {
        type
      } = element;
      if (typeof type === 'string') {
        return type;
      } else if (typeof type === 'function') {
        return getDisplayName(type, 'Anonymous');
      } else if (type != null) {
        return 'NotImplementedInDevtools';
      } else {
        return 'Element';
      }
  }
}
const MAX_PREVIEW_STRING_LENGTH = 50;
function truncateForDisplay(string, length = MAX_PREVIEW_STRING_LENGTH) {
  if (string.length > length) {
    return string.slice(0, length) + '…';
  } else {
    return string;
  }
}
function formatDataForPreview(data, showFormattedValue) {
  if (data != null && hasOwnProperty.call(data, _hydration__WEBPACK_IMPORTED_MODULE_5__.meta.type)) {
    return showFormattedValue ? data[_hydration__WEBPACK_IMPORTED_MODULE_5__.meta.preview_long] : data[_hydration__WEBPACK_IMPORTED_MODULE_5__.meta.preview_short];
  }
  const type = getDataType(data);
  switch (type) {
    case 'html_element':
      return `<${truncateForDisplay(data.tagName.toLowerCase())} />`;
    case 'function':
      if (typeof data.name === 'function' || data.name === '') {
        return '() => {}';
      }
      return `${truncateForDisplay(data.name)}() {}`;
    case 'string':
      return `"${data}"`;
    case 'bigint':
      return truncateForDisplay(data.toString() + 'n');
    case 'regexp':
      return truncateForDisplay(data.toString());
    case 'symbol':
      return truncateForDisplay(data.toString());
    case 'react_element':
      return `<${truncateForDisplay(getDisplayNameForReactElement(data) || 'Unknown')} />`;
    case 'react_lazy':
      const payload = data._payload;
      if (payload !== null && typeof payload === 'object') {
        if (payload._status === 0) {
          return `pending lazy()`;
        }
        if (payload._status === 1 && payload._result != null) {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload._result.default, false);
            return `fulfilled lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled lazy() {…}`;
          }
        }
        if (payload._status === 2) {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload._result, false);
            return `rejected lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected lazy() {…}`;
          }
        }
        if (payload.status === 'pending' || payload.status === 'blocked') {
          return `pending lazy()`;
        }
        if (payload.status === 'fulfilled') {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload.value, false);
            return `fulfilled lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled lazy() {…}`;
          }
        }
        if (payload.status === 'rejected') {
          if (showFormattedValue) {
            const formatted = formatDataForPreview(payload.reason, false);
            return `rejected lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected lazy() {…}`;
          }
        }
      }
      return 'lazy()';
    case 'array_buffer':
      return `ArrayBuffer(${data.byteLength})`;
    case 'data_view':
      return `DataView(${data.buffer.byteLength})`;
    case 'array':
      if (showFormattedValue) {
        let formatted = '';
        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }
          formatted += formatDataForPreview(data[i], false);
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `[${truncateForDisplay(formatted)}]`;
      } else {
        const length = hasOwnProperty.call(data, _hydration__WEBPACK_IMPORTED_MODULE_5__.meta.size) ? data[_hydration__WEBPACK_IMPORTED_MODULE_5__.meta.size] : data.length;
        return `Array(${length})`;
      }
    case 'typed_array':
      const shortName = `${data.constructor.name}(${data.length})`;
      if (showFormattedValue) {
        let formatted = '';
        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }
          formatted += data[i];
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `${shortName} [${truncateForDisplay(formatted)}]`;
      } else {
        return shortName;
      }
    case 'iterator':
      const name = data.constructor.name;
      if (showFormattedValue) {
        const array = Array.from(data);
        let formatted = '';
        for (let i = 0; i < array.length; i++) {
          const entryOrEntries = array[i];
          if (i > 0) {
            formatted += ', ';
          }
          if ((0,_isArray__WEBPACK_IMPORTED_MODULE_6__["default"])(entryOrEntries)) {
            const key = formatDataForPreview(entryOrEntries[0], true);
            const value = formatDataForPreview(entryOrEntries[1], false);
            formatted += `${key} => ${value}`;
          } else {
            formatted += formatDataForPreview(entryOrEntries, false);
          }
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `${name}(${data.size}) {${truncateForDisplay(formatted)}}`;
      } else {
        return `${name}(${data.size})`;
      }
    case 'opaque_iterator':
      {
        return data[Symbol.toStringTag];
      }
    case 'date':
      return data.toString();
    case 'class_instance':
      try {
        let resolvedConstructorName = data.constructor.name;
        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }
        resolvedConstructorName = Object.getPrototypeOf(data).constructor.name;
        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }
        try {
          return truncateForDisplay(String(data));
        } catch (error) {
          return 'unserializable';
        }
      } catch (error) {
        return 'unserializable';
      }
    case 'thenable':
      let displayName;
      if (isPlainObject(data)) {
        displayName = 'Thenable';
      } else {
        let resolvedConstructorName = data.constructor.name;
        if (typeof resolvedConstructorName !== 'string') {
          resolvedConstructorName = Object.getPrototypeOf(data).constructor.name;
        }
        if (typeof resolvedConstructorName === 'string') {
          displayName = resolvedConstructorName;
        } else {
          displayName = 'Thenable';
        }
      }
      switch (data.status) {
        case 'pending':
          return `pending ${displayName}`;
        case 'fulfilled':
          if (showFormattedValue) {
            const formatted = formatDataForPreview(data.value, false);
            return `fulfilled ${displayName} {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled ${displayName} {…}`;
          }
        case 'rejected':
          if (showFormattedValue) {
            const formatted = formatDataForPreview(data.reason, false);
            return `rejected ${displayName} {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected ${displayName} {…}`;
          }
        default:
          return displayName;
      }
    case 'object':
      if (showFormattedValue) {
        const keys = Array.from(getAllEnumerableKeys(data)).sort(alphaSortKeys);
        let formatted = '';
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (i > 0) {
            formatted += ', ';
          }
          formatted += `${key.toString()}: ${formatDataForPreview(data[key], false)}`;
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `{${truncateForDisplay(formatted)}}`;
      } else {
        return '{…}';
      }
    case 'error':
      return truncateForDisplay(String(data));
    case 'boolean':
    case 'number':
    case 'infinity':
    case '-infinity':
    case 'nan':
    case 'null':
    case 'undefined':
      return String(data);
    default:
      try {
        return truncateForDisplay(String(data));
      } catch (error) {
        return 'unserializable';
      }
  }
}
const isPlainObject = object => {
  const objectPrototype = Object.getPrototypeOf(object);
  if (!objectPrototype) return true;
  const objectParentPrototype = Object.getPrototypeOf(objectPrototype);
  return !objectParentPrototype;
};
function backendToFrontendSerializedElementMapper(element) {
  const {
    formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  } = parseElementDisplayNameFromBackend(element.displayName, element.type);
  return {
    ...element,
    displayName: formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  };
}
function normalizeUrlIfValid(url) {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}
function getIsReloadAndProfileSupported() {
  let isBackendStorageAPISupported = false;
  try {
    localStorage.getItem('test');
    isBackendStorageAPISupported = true;
  } catch (error) {}
  return isBackendStorageAPISupported && (0,_backend_utils__WEBPACK_IMPORTED_MODULE_7__.isSynchronousXHRSupported)();
}
function getIfReloadedAndProfiling() {
  return (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RELOAD_AND_PROFILE_KEY) === 'true';
}
function getProfilingSettings() {
  return {
    recordChangeDescriptions: (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageGetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY) === 'true'
  };
}
function onReloadAndProfile(recordChangeDescriptions) {
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageSetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RELOAD_AND_PROFILE_KEY, 'true');
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageSetItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY, recordChangeDescriptions ? 'true' : 'false');
}
function onReloadAndProfileFlagsReset() {
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageRemoveItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RELOAD_AND_PROFILE_KEY);
  (0,react_devtools_shared_src_storage__WEBPACK_IMPORTED_MODULE_4__.sessionStorageRemoveItem)(_constants__WEBPACK_IMPORTED_MODULE_2__.SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY);
}
function unionOfTwoArrays(a, b) {
  let result = a;
  for (let i = 0; i < b.length; i++) {
    const value = b[i];
    if (a.indexOf(value) === -1) {
      if (result === a) {
        result = a.slice(0);
      }
      result.push(value);
    }
  }
  return result;
}

/***/ }),

/***/ "../shared/ReactSymbols.js":
/*!*********************************!*\
  !*** ../shared/ReactSymbols.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ASYNC_ITERATOR": () => (/* binding */ ASYNC_ITERATOR),
/* harmony export */   "REACT_ACTIVITY_TYPE": () => (/* binding */ REACT_ACTIVITY_TYPE),
/* harmony export */   "REACT_CONSUMER_TYPE": () => (/* binding */ REACT_CONSUMER_TYPE),
/* harmony export */   "REACT_CONTEXT_TYPE": () => (/* binding */ REACT_CONTEXT_TYPE),
/* harmony export */   "REACT_ELEMENT_TYPE": () => (/* binding */ REACT_ELEMENT_TYPE),
/* harmony export */   "REACT_FORWARD_REF_TYPE": () => (/* binding */ REACT_FORWARD_REF_TYPE),
/* harmony export */   "REACT_FRAGMENT_TYPE": () => (/* binding */ REACT_FRAGMENT_TYPE),
/* harmony export */   "REACT_LAZY_TYPE": () => (/* binding */ REACT_LAZY_TYPE),
/* harmony export */   "REACT_LEGACY_ELEMENT_TYPE": () => (/* binding */ REACT_LEGACY_ELEMENT_TYPE),
/* harmony export */   "REACT_LEGACY_HIDDEN_TYPE": () => (/* binding */ REACT_LEGACY_HIDDEN_TYPE),
/* harmony export */   "REACT_MEMO_CACHE_SENTINEL": () => (/* binding */ REACT_MEMO_CACHE_SENTINEL),
/* harmony export */   "REACT_MEMO_TYPE": () => (/* binding */ REACT_MEMO_TYPE),
/* harmony export */   "REACT_OPTIMISTIC_KEY": () => (/* binding */ REACT_OPTIMISTIC_KEY),
/* harmony export */   "REACT_PORTAL_TYPE": () => (/* binding */ REACT_PORTAL_TYPE),
/* harmony export */   "REACT_PROFILER_TYPE": () => (/* binding */ REACT_PROFILER_TYPE),
/* harmony export */   "REACT_RECOVERABLE_TYPE": () => (/* binding */ REACT_RECOVERABLE_TYPE),
/* harmony export */   "REACT_SCOPE_TYPE": () => (/* binding */ REACT_SCOPE_TYPE),
/* harmony export */   "REACT_STRICT_MODE_TYPE": () => (/* binding */ REACT_STRICT_MODE_TYPE),
/* harmony export */   "REACT_SUSPENSE_LIST_TYPE": () => (/* binding */ REACT_SUSPENSE_LIST_TYPE),
/* harmony export */   "REACT_SUSPENSE_TYPE": () => (/* binding */ REACT_SUSPENSE_TYPE),
/* harmony export */   "REACT_TRACING_MARKER_TYPE": () => (/* binding */ REACT_TRACING_MARKER_TYPE),
/* harmony export */   "REACT_VIEW_TRANSITION_TYPE": () => (/* binding */ REACT_VIEW_TRANSITION_TYPE),
/* harmony export */   "getIteratorFn": () => (/* binding */ getIteratorFn)
/* harmony export */ });
const REACT_LEGACY_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_ELEMENT_TYPE = Symbol.for('react.transitional.element');
const REACT_PORTAL_TYPE = Symbol.for('react.portal');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const REACT_CONSUMER_TYPE = Symbol.for('react.consumer');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');
const REACT_SCOPE_TYPE = Symbol.for('react.scope');
const REACT_ACTIVITY_TYPE = Symbol.for('react.activity');
const REACT_LEGACY_HIDDEN_TYPE = Symbol.for('react.legacy_hidden');
const REACT_TRACING_MARKER_TYPE = Symbol.for('react.tracing_marker');
const REACT_MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');
const REACT_VIEW_TRANSITION_TYPE = Symbol.for('react.view_transition');
const REACT_RECOVERABLE_TYPE = Symbol.for('react.recoverable');
const MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
const FAUX_ITERATOR_SYMBOL = '@@iterator';
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }
  const maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }
  return null;
}
const ASYNC_ITERATOR = Symbol.asyncIterator;
const REACT_OPTIMISTIC_KEY = Symbol.for('react.optimistic_key');

/***/ }),

/***/ "../shared/isArray.js":
/*!****************************!*\
  !*** ../shared/isArray.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const isArrayImpl = Array.isArray;
function isArray(a) {
  return isArrayImpl(a);
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (isArray);

/***/ }),

/***/ "../shared/noop.js":
/*!*************************!*\
  !*** ../shared/noop.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ noop)
/* harmony export */ });
function noop() {}

/***/ }),

/***/ "../shared/reportGlobalError.js":
/*!**************************************!*\
  !*** ../shared/reportGlobalError.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* provided dependency */ var process = __webpack_require__(/*! process/browser */ "../../node_modules/process/browser.js");
const reportGlobalError = typeof reportError === 'function' ? reportError : error => {
  if (typeof window === 'object' && typeof window.ErrorEvent === 'function') {
    const message = typeof error === 'object' && error !== null && typeof error.message === 'string' ? String(error.message) : String(error);
    const event = new window.ErrorEvent('error', {
      bubbles: true,
      cancelable: true,
      message: message,
      error: error
    });
    const shouldLog = window.dispatchEvent(event);
    if (!shouldLog) {
      return;
    }
  } else if (typeof process === 'object' && typeof process.emit === 'function') {
    process.emit('uncaughtException', error);
    return;
  }
  console['error'](error);
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (reportGlobalError);

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!************************!*\
  !*** ./src/backend.js ***!
  \************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react_devtools_shared_src_backend_agent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-devtools-shared/src/backend/agent */ "../react-devtools-shared/src/backend/agent.js");
/* harmony import */ var react_devtools_shared_src_bridge__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-devtools-shared/src/bridge */ "../react-devtools-shared/src/bridge.js");
/* harmony import */ var react_devtools_shared_src_backend__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-devtools-shared/src/backend */ "../react-devtools-shared/src/backend/index.js");
/* harmony import */ var react_devtools_shared_src_backend_NativeStyleEditor_setupNativeStyleEditor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-devtools-shared/src/backend/NativeStyleEditor/setupNativeStyleEditor */ "../react-devtools-shared/src/backend/NativeStyleEditor/setupNativeStyleEditor.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./utils */ "./src/utils.js");





setup(window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
function setup(hook) {
  if (hook == null) {
    return;
  }
  hook.backends.set(_utils__WEBPACK_IMPORTED_MODULE_4__.COMPACT_VERSION_NAME, {
    Agent: react_devtools_shared_src_backend_agent__WEBPACK_IMPORTED_MODULE_0__["default"],
    Bridge: react_devtools_shared_src_bridge__WEBPACK_IMPORTED_MODULE_1__["default"],
    initBackend: react_devtools_shared_src_backend__WEBPACK_IMPORTED_MODULE_2__.initBackend,
    setupNativeStyleEditor: react_devtools_shared_src_backend_NativeStyleEditor_setupNativeStyleEditor__WEBPACK_IMPORTED_MODULE_3__["default"]
  });
  hook.emit('devtools-backend-installed', _utils__WEBPACK_IMPORTED_MODULE_4__.COMPACT_VERSION_NAME);
}
})();

/******/ })()
;
//# sourceMappingURL=react_devtools_backend_compact.js.map