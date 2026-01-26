/**
 * Copy deeply nested object
 * @param {Object} obj
 */
export function deepObjCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Send a postMessage
 * @param {Object} message - Il messaggio da inviare
 * @param {Window} targetWindow - La finestra target (default: parent)
 * @param {string} targetOrigin - L'origine target (default: '*', ma meglio specificare)
 */
export function sendPostMessage(msg, targetWindow = window.parent, targetOrigin = '*') {
  try {
    if (!msg || typeof msg !== 'object') {
      throw new Error('Message must be a non-null object');
    }
    targetWindow.postMessage(msg, targetOrigin);
  } catch (err) {
    log('[postMessage] Error sending message:', err);
  }
}

export function log(...args) {
  console.log('[INSTRUMENTATION] ', ...args);
}