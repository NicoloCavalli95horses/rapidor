//===================
// Import
//===================
import { config } from "../config.js";
import { emit, events } from "./eventBus.js";


//===================
// Const
//===================
export const logs = [];



//===================
// Functions
//===================
export function deepObjCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}



export function copyObjKeys(obj = {}, keys = []) {
  return keys.reduce((acc, key) => {
    if (Object.hasOwn(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}



/**
 * @param {Object} message
 * @param {Window} targetWindow
 * @param {string} targetOrigin
 */
export function sendPostMessage(msg, targetWindow = window.parent, targetOrigin = window.location.origin) {
  try {
    if (!msg || typeof msg !== 'object') {
      log({ module: 'utils', msg: 'Message must be a non-null object', type: 'error' });
    }
    if (isCloneable(msg)) {
      targetWindow.postMessage(msg, targetOrigin);
    } else {
      log({ module: 'utils', msg: 'Impossible to send. Uncloneable object', type: 'error' });
      console.log(msg)
    }
  } catch (err) {
    log({ module: 'utils', msg: 'Error sending message', type: 'error' });
  }
}



// type: info | error | warning
export function log({ module, type = 'info', msg }) {
  const color = {
    error: 'color: red',
    info: 'color: white',
    warning: 'color: orange',
  }
  console.log(`%c[${config.toolName}] [${module.toUpperCase()}] ${msg}`, color[type]);
  logs.push(JSON.stringify({ type, module, msg, timestamp: new Date().toISOString() }));
}



export function isCloneable(obj) {
  try {
    structuredClone(obj);
    return true;
  } catch {
    return false;
  }
}



export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



export function payloadSize(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json).length;

  return {
    bytes,
    kb: (bytes / 1024).toFixed(2),
    mb: (bytes / (1024 * 1024)).toFixed(2)
  };
}



export async function getEstimatedIndexedDBstorage() {
  await navigator.storage.estimate();
}



export function hasOwnKeys(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}



// Returns a wrapper function that check when fn is executed
// > Debounce (idle execution): executed after the idle debounceT
// > Throttling: force execution after throttleT under if under continuous load
export function debounceWithMaxTime(fn, { debounceT = 1000, maxT = 10000 } = {}) {
  let debounceTimer = null;
  let maxTimer = null;
  let lastArgs = null;
  let lastThis = null;
  let startedAt = null;
  let running = false;

  function clear() {
    if (debounceTimer) { clearTimeout(debounceTimer); }
    debounceTimer = null;
  }

  function clearMax() {
    if (maxTimer) { clearTimeout(maxTimer); }
    maxTimer = null;
    startedAt = null;
  }

  async function run() {
    if (running) return;
    running = true;

    clear();
    clearMax();

    try {
      await fn.apply(lastThis, lastArgs);
    } finally {
      running = false;
    }
  }

  return function (...args) {
    lastArgs = args;
    lastThis = this;

    const now = Date.now();

    if (!startedAt) {
      startedAt = now;

      maxTimer = setTimeout(run, maxT);
    }

    clear();

    debounceTimer = setTimeout(run, debounceT);
  };
}


export function isSerializableValue(value) {
  if (value === null) {
    return true;
  }

  const t = typeof value;

  if (t === "string" || t === "boolean") {
    return true;
  }

  if (t === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return true;
  }

  if (t === "object") {
    if (isPlainObject(value)) {
      return true;
    }

    return false;
  }
  return false;
}



export function isPlainObject(value) {
  if (value === null || typeof value !== "object") { return false; }
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null);
}



export function getCurrentDOM() {
  return new XMLSerializer().serializeToString(document);
}


export function printConfig() {
  const table = Object.entries(config).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(', ')
        : typeof value === 'object' ? JSON.stringify(value)
            : value
  }));
  
  console.table(table);
}