/**
 * Copy deeply nested object
 * @param {Object} obj
 */
export function deepObjCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function injectScript(scriptPath) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(scriptPath);
  script.type = 'module';
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

export function log(txt) {
  console.log('[INSTRUMENTATION] ', txt);
}