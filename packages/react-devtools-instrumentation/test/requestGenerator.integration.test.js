//===================
// Import
//===================
import {RequestGenerator} from '../modules/analysis/requestGenerator.js';
import {events} from '../utils/eventBus.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
// Integration-level coverage of the request-crafting and request/response correlation logic. The
// DOM-driven SPA routing check (isUsingQueryParams/waitDOMIdle) needs a live DOM and is left to e2e.
describe('RequestGenerator (integration)', function () {
  describe('buildRequest', function () {
    const gen = new RequestGenerator();

    it('rebuilds the fuzzed URL by splicing the candidate value into the path', function () {
      const reference = {uri: 'https://app.test/api/item/id1', verb: 'get'};
      const target = {
        parts: ['https://app.test/api/item/', ''],
        value: 'id2',
        index: 1,
      };

      const req = gen.buildRequest({reference, target});
      assert.equal(req.url, 'https://app.test/api/item/id2');
      assert.equal(req.method, 'GET');
      assert.equal(typeof req._requestId, 'string'); // correlation id read back by HTTPTracker
    });

    it('attaches a JSON body for POST/PUT/PATCH', async function () {
      const reference = {
        uri: 'https://app.test/api/item',
        verb: 'post',
        body: {a: 1},
        headers: {'content-type': 'application/json'},
      };
      const target = {
        parts: ['https://app.test/api/', ''],
        value: 'item',
        index: 1,
      };

      const req = gen.buildRequest({reference, target});
      assert.equal(req.method, 'POST');
      assert.equal(await req.text(), JSON.stringify({a: 1}));
    });
  });

  describe('bodyToJSON', function () {
    const gen = new RequestGenerator();

    it('serializes a plain object', function () {
      assert.equal(gen.bodyToJSON({a: 1}), '{"a":1}');
    });

    it('falls back to an empty JSON object when serialization fails', function () {
      assert.equal(gen.bodyToJSON(10n), '{}'); // BigInt is not JSON-serializable
    });
  });

  describe('serializedReqObj', function () {
    const gen = new RequestGenerator();

    it('flattens a Request into a plain, DB-storable object', async function () {
      const request = new Request('https://app.test/x', {
        method: 'GET',
        headers: {'x-test': '1'},
      });
      const out = await gen.serializedReqObj(request);

      assert.equal(out.url, 'https://app.test/x');
      assert.equal(out.method, 'GET');
      assert.equal(out.headers['x-test'], '1');
      assert.equal(out.body, null); // no body on a GET
    });
  });

  describe('detectParamsUsage', function () {
    it('records query parameters the app reads via URLSearchParams.get', function () {
      const original = URLSearchParams.prototype.get;
      try {
        const gen = new RequestGenerator();
        gen.detectParamsUsage();

        const url = new URL('https://app.test/?token=xyz');
        url.searchParams.get('token');

        assert.equal(gen.accessedParams.has('token'), true);
      } finally {
        URLSearchParams.prototype.get = original; // undo the global monkey-patch
      }
    });
  });

  describe('executeRequest / handleTracked correlation', function () {
    it('resolves executeRequest once the matching tracked response arrives', async function () {
      global.window = {fetch: () => Promise.resolve()}; // the real response comes back via handleTracked
      try {
        const gen = new RequestGenerator();
        const request = {_requestId: 'rid-1'};

        const pending = gen.executeRequest({request, type: events.FETCH_EVENT});
        gen.handleTracked({
          request: {_requestId: 'rid-1'},
          response: {status: 200, body: 'ok'},
        });

        const res = await pending;
        assert.equal(res.status, 200);
      } finally {
        delete global.window;
      }
    });

    it('handleTracked ignores a response with an unknown request id', function () {
      const gen = new RequestGenerator();
      assert.doesNotThrow(() =>
        gen.handleTracked({request: {_requestId: 'unknown'}, response: {}})
      );
    });
  });
});
