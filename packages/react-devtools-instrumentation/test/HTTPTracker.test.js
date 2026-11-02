//===================
// Import
//===================
import { HTTPTracker } from '../modules/HTTP/HTTPTracker.js';
import assert from 'node:assert';

//===================
// Test suite
//===================
// getResponseBody turns a raw response into a parsed body. Server-Sent Events (text/event-stream,
// and streams some servers mislabel as JSON) must be parsed as a list of data: payloads, not
// JSON.parse-d as a whole — which would throw and drop the response from the analysis.
describe('HTTPTracker.getResponseBody (event-stream handling)', function () {
  const tracker = new HTTPTracker();
  const SSE = 'event: message\ndata: {"id":"a1","owner":"u1"}\n\nevent: message\ndata: {"id":"a2"}\n\n';

  it('parses a text/event-stream string into its JSON data: payloads (XHR case)', async function () {
    const ret = await tracker.getResponseBody({ data: SSE, type: 'text/event-stream' });
    assert.equal(ret.type, 'event-stream');
    assert.deepEqual(ret.body, [{ id: 'a1', owner: 'u1' }, { id: 'a2' }]);
    assert.deepEqual(ret.error, {});
  });

  it('handles an SSE stream mislabelled as application/json instead of throwing', async function () {
    const ret = await tracker.getResponseBody({ data: SSE, type: 'application/json' });
    assert.equal(ret.type, 'event-stream');
    assert.deepEqual(ret.body, [{ id: 'a1', owner: 'u1' }, { id: 'a2' }]);
    assert.deepEqual(ret.error, {}, 'no parse error should be recorded for SSE');
  });

  it('parses SSE from a Response object (Fetch case)', async function () {
    const res = new Response(SSE, { headers: { 'Content-Type': 'text/event-stream' } });
    const ret = await tracker.getResponseBody({ data: res, type: 'text/event-stream' });
    assert.equal(ret.type, 'event-stream');
    assert.deepEqual(ret.body, [{ id: 'a1', owner: 'u1' }, { id: 'a2' }]);
  });

  it('keeps a non-JSON data: payload as a string', async function () {
    const ret = await tracker.getResponseBody({ data: 'data: hello\n\n', type: 'text/event-stream' });
    assert.deepEqual(ret.body, ['hello']);
  });

  it('still parses real JSON normally', async function () {
    const ret = await tracker.getResponseBody({ data: '{"x":1}', type: 'application/json' });
    assert.equal(ret.type, 'json');
    assert.deepEqual(ret.body, { x: 1 });
  });

  it('still reports a genuinely malformed JSON body as an error', async function () {
    const ret = await tracker.getResponseBody({ data: '{ not json', type: 'application/json' });
    assert.equal(ret.type, 'unknown');       // never reached the json success path
    assert.notDeepEqual(ret.error, {});      // error recorded
  });
});
