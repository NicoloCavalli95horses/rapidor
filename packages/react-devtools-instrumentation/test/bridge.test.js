//===================
// Import
//===================
import {Bridge} from '../modules/state/bridge.js';
import {Graph} from '../modules/state/graph.js';
import {eventBus, events} from '../utils/eventBus.js';
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



// 'full' mode (manual use, no crawler attached) keeps doing everything itself: save+dedup to its
// own IndexedDB, preindexing, analysis — exactly as before. 'minimal' mode (a crawler is driving)
// should only ever expose the freshly-computed graph via getLatestState()/_lastState: no save/dedup
// round-trip through StateManager, no preindexing — the crawler does both of those itself from the
// same graph. `mode` is injected via the constructor (see its own comment) specifically so these two
// behaviours can be exercised here without touching config.js's frozen singleton.
describe('Bridge mode gating (full vs minimal)', function () {
  function makeBridgeWithMode(mode) {
    const stateManager = {waitForIdle: async () => {}};
    return new Bridge(stateManager, {mode});
  }

  describe('handleStateGraph', function () {
    for (const mode of ['full', 'minimal']) {
      it(`always sets _lastState eagerly, in '${mode}' mode too`, async () => {
        const bridge = makeBridgeWithMode(mode);
        const payload = {fingerprint: 'f', nodes: {}};
        bridge.getStateGraph = async () => payload;
        await bridge.handleStateGraph({});
        assert.equal(bridge._lastState, payload);
      });
    }

    it(`emits STATE_UPDATE in 'full' mode, so StateManager can save/dedup/preindex it`, async () => {
      const bridge = makeBridgeWithMode('full');
      bridge.getStateGraph = async () => ({fingerprint: 'f'});
      const received = [];
      const subscription = eventBus.subscribe((e) => received.push(e));
      try {
        await bridge.handleStateGraph({});
      } finally {
        subscription.unsubscribe();
      }
      assert.ok(received.some((e) => e.type === events.STATE_UPDATE));
    });

    it(`never emits STATE_UPDATE in 'minimal' mode: RAPIDOR's own save/dedup/preindexing pipeline must not run`, async () => {
      const bridge = makeBridgeWithMode('minimal');
      bridge.getStateGraph = async () => ({fingerprint: 'f'});
      const received = [];
      const subscription = eventBus.subscribe((e) => received.push(e));
      try {
        await bridge.handleStateGraph({});
      } finally {
        subscription.unsubscribe();
      }
      assert.ok(!received.some((e) => e.type === events.STATE_UPDATE));
    });
  });

  describe('visitFiber preindexing', function () {
    // A minimal fiber-shaped node that processNode() will keep: tag 0 (FunctionComponent) is in
    // config.tagsWhitelist, and a real `type` function gives getComponentTypeId something to key on.
    function keepableNode({props}) {
      return {
        tag: 0,
        key: null,
        type: function ExampleComponent() {},
        memoizedProps: props,
        return: null,
        sibling: null,
        child: null,
      };
    }

    it(`buffers preindexing rows in 'full' mode`, () => {
      const bridge = makeBridgeWithMode('full');
      const g = new Graph();
      const graph = g.createGraph();
      bridge.visitFiber({node: keepableNode({props: {id: 'resource_123'}}), parentId: null, graph, g});
      assert.ok(bridge.preindexing.data.length > 0, 'expected at least one buffered preindexing row');
    });

    it(`never buffers preindexing rows in 'minimal' mode — the crawler preindexes the same graph itself`, () => {
      const bridge = makeBridgeWithMode('minimal');
      const g = new Graph();
      const graph = g.createGraph();
      bridge.visitFiber({node: keepableNode({props: {id: 'resource_123'}}), parentId: null, graph, g});
      assert.equal(bridge.preindexing.data.length, 0);
    });
  });
});
