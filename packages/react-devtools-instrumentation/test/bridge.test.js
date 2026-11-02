//===================
// Import
//===================
import {Bridge} from '../modules/state/bridge.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
// The wait-to-action handshake lets a crawler pause before interacting with the page until RAPIDOR
// has captured and persisted at least one state for the page under exploration. capture() and the
// state pipeline are stubbed here so the handshake logic is tested without a real React fiber or
// IndexedDB (neither exists under Node).
describe('Bridge wait-to-action', function () {
  function makeBridge() {
    const calls = {capture: 0, waitForIdle: 0};
    const stateManager = {
      waitForIdle: async () => {
        calls.waitForIdle++;
      },
    };
    const bridge = new Bridge(stateManager);
    bridge.capture = async () => {
      calls.capture++;
    };
    return {bridge, calls};
  }

  describe('settle', function () {
    it('returns false when React has not committed yet (no root to capture)', async () => {
      const {bridge, calls} = makeBridge();
      assert.equal(await bridge.settle(), false);
      assert.equal(calls.capture, 0);
    });

    it('captures the current root and waits for the save pipeline, then returns true', async () => {
      const {bridge, calls} = makeBridge();
      bridge._lastRoot = {}; // pretend React has committed at least once
      assert.equal(await bridge.settle(), true);
      assert.equal(calls.capture, 1);
      assert.equal(calls.waitForIdle, 1);
    });
  });

  describe('waitToAction', function () {
    it('returns false within the timeout when no state is ever captured', async () => {
      const {bridge} = makeBridge();
      const start = Date.now();
      assert.equal(await bridge.waitToAction({timeoutMs: 120, pollMs: 20}), false);
      assert.ok(Date.now() - start >= 100, 'should wait roughly the whole timeout');
    });

    it('returns true immediately when a state is already available', async () => {
      const {bridge, calls} = makeBridge();
      bridge._lastRoot = {};
      assert.equal(await bridge.waitToAction({timeoutMs: 1000, pollMs: 20}), true);
      assert.equal(calls.capture, 1);
    });

    it('polls and returns true as soon as React commits', async () => {
      const {bridge} = makeBridge();
      setTimeout(() => {
        bridge._lastRoot = {};
      }, 60);
      assert.equal(await bridge.waitToAction({timeoutMs: 1000, pollMs: 20}), true);
    });

    it('never throws: a capture error is retried until a later attempt succeeds', async () => {
      const {bridge} = makeBridge();
      bridge._lastRoot = {};
      let firstCall = true;
      bridge.capture = async () => {
        if (firstCall) {
          firstCall = false;
          throw new Error('capture failed');
        }
      };
      assert.equal(await bridge.waitToAction({timeoutMs: 500, pollMs: 20}), true);
    });
  });
});
