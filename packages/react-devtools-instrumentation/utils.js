//===================
// Import
//===================
import { config } from "./config.js";



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
      log('[postMessage] Message must be a non-null object');
    }
    if (isCloneable(msg)) {
      targetWindow.postMessage(msg, targetOrigin);
    } else {
      log('[postMessage] Impossible to send. Uncloneable object: ', msg)
    }
  } catch (err) {
    log('[postMessage] Error sending message:', err);
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
export function debounce(fn, delay) {
  let timer = null;
  let running = false;

  return function (...args) {
    if (timer) { clearTimeout(timer); }

    timer = setTimeout(async () => {
      if (running) { return; }

      running = true;
      try {
        await fn.apply(this, args);
      } finally {
        running = false;
      }
    }, delay);
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

  if (t !== "object") {
    return false;
  }

  // block large host objects
  if (value === window || value === document || value === location) {
    return false;
  }

  // accept array
  if (Array.isArray(value)) {
    return true;
  }

  // accept plain object
  return Object.getPrototypeOf(value) === Object.prototype;
}