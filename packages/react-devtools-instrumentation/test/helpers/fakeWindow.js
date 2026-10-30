//===================
// Test helpers
//===================
// Minimal, dependency-free stand-ins for the browser globals the instrumentation relies on, so the
// bridge round-trip (window.postMessage -> message event -> listener) can be exercised under Node.

// A tiny window with an event system and an async postMessage, mirroring how the browser delivers
// "message" events to every registered listener on a later tick.
export function createFakeWindow({origin = 'https://app.test'} = {}) {
  const listeners = new Map();

  const win = {
    location: {origin, href: `${origin}/`, hostname: new URL(origin).hostname},

    addEventListener(type, cb) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(cb);
    },

    removeEventListener(type, cb) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter(fn => fn !== cb)
      );
    },

    dispatchEvent(event) {
      (listeners.get(event.type) || []).slice().forEach(cb => cb(event));
      return true;
    },

    // Deliver asynchronously (like the real postMessage), tagging the event with this window as the
    // source and its own origin, which is what clientToBridge.js validates before handling it.
    postMessage(data) {
      queueMicrotask(() => {
        win.dispatchEvent({
          type: 'message',
          data,
          source: win,
          origin: win.location.origin,
        });
      });
    },
  };

  return win;
}

// Simulates the RAPIDOR content-script bridge: for every "rapidor-main" REQUEST, it replies with a
// "rapidor-bridge" RESPONSE whose `result` is produced by the provided classify() callback.
export function attachFakeBridge({win, classify}) {
  win.addEventListener('message', event => {
    const msg = event.data;
    if (msg?.source !== 'rapidor-main' || msg.type !== 'REQUEST') {
      return;
    }

    const result = classify(msg);
    win.postMessage({
      source: 'rapidor-bridge',
      type: 'RESPONSE',
      requestId: msg.requestId,
      result,
    });
  });
}
