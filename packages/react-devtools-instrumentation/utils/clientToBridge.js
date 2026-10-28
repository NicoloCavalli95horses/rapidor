//===================
// Const
//===================
const pendingRequests = new Map();


//===================
// Functions
//===================
export function sendToBridge({ action, payload = {}, timeoutMs = 10000 }) {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Bridge timeout: ${action}`));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeout, });

    window.postMessage({
      source: "rapidor-main",
      type: "REQUEST",
      requestId,
      action,
      payload,
    },
      window.location.origin
    );
  });
}



export function initClientToBridge() {
  window.addEventListener("message", (event) => {
    if (event.source !== window) { return };
    if (event.origin !== window.location.origin) { return };

    const message = event.data;

    if (message?.source !== "rapidor-bridge") { return };
    if (message.type !== "RESPONSE") { return };

    const pending = pendingRequests.get(message.requestId);
    if (!pending) { return };

    clearTimeout(pending.timeout);
    pendingRequests.delete(message.requestId);

    if (message.error) {
      pending.reject(new Error(message.error));
    } else {
      pending.resolve(message.result);
    }
  });
}