/**
 * Copy deeply nested object
 * @param {Object} obj
 */
export function deepObjCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
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



export function log(...args) {
  console.log('[INSTRUMENTATION]', ...args);
}



export function isCloneable(obj) {
  try {
    structuredClone(obj);
    return true;
  } catch {
    return false;
  }
}
