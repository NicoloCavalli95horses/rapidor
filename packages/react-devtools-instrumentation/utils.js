//===================
// Const
//===================
let logs = [];



//===================
// Functions
//===================

/**
 * Copy deeply nested object
 * @param {Object} obj
 */
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


export function log({module, type = 'info', msg}) {
  console.log('[INSTRUMENTATION]', `[${module.toUpperCase()}]`, msg);
  logs.push(JSON.stringify({ type, module, msg, timestamp: new Date().toISOString() }));
}



function downloadLogs(content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logs_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



export function showDownloadBtn(doc) {
  function inject() {
    const btn = doc.createElement("button");
    btn.innerText = "Download logs";
    btn.style.position = "fixed";
    btn.style.top = "10px";
    btn.style.right = "10px";
    btn.style.zIndex = "999999";
    btn.onclick = () => {
      downloadLogs(logs);
      logs = [];
    };
    doc.body.appendChild(btn);
  }

  if (doc.body) {
    inject();
  } else {
    doc.addEventListener("DOMContentLoaded", inject);
  }
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
  return function (...args) {
    if (timer) {
      clearTimeout(timer);
    };
    timer = setTimeout(() => {
      // preserve the context of 'this' and the original args
      fn.apply(this, args);
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