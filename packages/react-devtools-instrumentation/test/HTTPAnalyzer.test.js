//===================
// Import
//===================
import { analyzeHTTP } from "../modules/HTTP/HTTPAnalyzer.js";
import assert from "node:assert";



//===================
// Test suite
//===================
describe("analyzeHTTP class", function () {
  const HTTPAnalyzer = new analyzeHTTP();


  it("should load", function () {
    assert.equal(typeof HTTPAnalyzer, 'object');
  });


  it("should convert search parameters to object", function () {
    const urlObj = new URL("https://example.com/?name=Jonathan%20Smith&age=18");
    const paramsObj = HTTPAnalyzer.searchParamsToObj(urlObj.searchParams);
    assert.equal(paramsObj.name, 'Jonathan Smith');
    assert.equal(paramsObj.age, '18');
    assert.equal(paramsObj.address, undefined);
  });


  it("should map a search parameters object into an array", function () {
    const urlObj = new URL("https://example.com/?role=user&id=123&sort=false");
    const fullPath = decodeURIComponent(urlObj.origin + urlObj.pathname);
    const paramsObj = HTTPAnalyzer.searchParamsToObj(urlObj.searchParams);

    const r1 = HTTPAnalyzer.getParamsAnalysis({ params: paramsObj, fullPath, valuesToExclude: ['user'] });
    assert.equal(r1[0].value, '123');
    assert.equal(r1.length, 1);

    const r2 = HTTPAnalyzer.getParamsAnalysis({ params: paramsObj, fullPath, valuesToExclude: ['123'] });
    assert.equal(r2[0].value, 'user');

    const r3 = HTTPAnalyzer.getParamsAnalysis({ params: paramsObj, fullPath });
    assert.equal(r3.length, 2);

    assert.equal(r3.some(el => el.value == '123'), true);
    assert.equal(r3.some(el => el.value == 'false'), false);
  });


  describe("should return the correct index of the segment belonging to the URL to be processed", function () {
    it("[last index] equal length", function () {
      const history = [[1, 2, 3]];
      const segment = [1, 2, 3];

      const index = HTTPAnalyzer.getIndexOfSegment(segment, history);
      assert.equal(index, segment.length - 1);
      assert.equal(index, 2);
    });


    it("[last index] different length", function () {
      const history = [[1, 2, 3]];
      const history2 = [[1, 2, 3], [4, 5, 6, 7, 8, 9, 10]];
      const history3 = [[]];
      const segment = [1, 2, 3, 4, 5];

      const index = HTTPAnalyzer.getIndexOfSegment(segment, history);
      assert.equal(index, segment.length - 1);
      assert.equal(index, 4);

      const index2 = HTTPAnalyzer.getIndexOfSegment(segment, history2);
      const index3 = HTTPAnalyzer.getIndexOfSegment(segment, history3);
      assert.equal(index, index2);
      assert.equal(index2, index3);
    });


    it("[custom index] one different item", function () {
      const history = [[1, 2, 3, 4], []];
      const segment = [1, 8, 3, 4];

      const index = HTTPAnalyzer.getIndexOfSegment(segment, history);
      assert.equal(index, 1);
    });
  });


  describe("should return the correct segment of the URL (getPropertyAt)", function () {
    it("extracts the segment at the given index, without an extension", function () {
      const urlObj = new URL("https://example.com/api/item/id1");
      const segments = ['api', 'item', 'id1'];

      const prop = HTTPAnalyzer.getPropertyAt({ urlObj, segments, idx: 2, hasTrailingSlash: false });
      assert.equal(prop.value, 'id1');
      assert.equal(prop.index, 1);
      assert.deepEqual(prop.parts, ['https://example.com/api/item/', '']);

      // the value can be re-inserted at `index` to rebuild the original path
      const parts = [...prop.parts];
      parts.splice(prop.index, 0, prop.value);
      assert.equal(parts.join(''), 'https://example.com/api/item/id1');
    });


    it("splits the file extension off the fuzzable value and keeps it in the suffix", function () {
      const urlObj = new URL("https://example.com/files/photo.jpg");
      const segments = ['files', 'photo.jpg'];

      const prop = HTTPAnalyzer.getPropertyAt({ urlObj, segments, idx: 1, hasTrailingSlash: false });
      assert.equal(prop.value, 'photo');
      assert.deepEqual(prop.parts, ['https://example.com/files/', '.jpg']);

      const parts = [...prop.parts];
      parts.splice(prop.index, 0, prop.value);
      assert.equal(parts.join(''), 'https://example.com/files/photo.jpg');
    });


    it("preserves a trailing slash in the suffix", function () {
      const urlObj = new URL("https://example.com/api/item/id1/");
      const segments = ['api', 'item', 'id1'];

      const prop = HTTPAnalyzer.getPropertyAt({ urlObj, segments, idx: 2, hasTrailingSlash: true });
      assert.equal(prop.parts[1], '/');
    });


    it("returns an empty/invalid property when the index is out of range", function () {
      const urlObj = new URL("https://example.com/api");
      const segments = ['api'];

      const prop = HTTPAnalyzer.getPropertyAt({ urlObj, segments, idx: 5, hasTrailingSlash: false });
      assert.deepEqual(prop, { parts: [], value: undefined, index: -1 });
    });
  });


  describe("getParamsAnalysis should always skip boolean-like values", function () {
    it("excludes 'true' and 'false' even without valuesToExclude", function () {
      const urlObj = new URL("https://example.com/?flag=true&off=false&id=42");
      const fullPath = decodeURIComponent(urlObj.origin + urlObj.pathname);
      const paramsObj = HTTPAnalyzer.searchParamsToObj(urlObj.searchParams);

      const result = HTTPAnalyzer.getParamsAnalysis({ params: paramsObj, fullPath });
      assert.equal(result.length, 1);
      assert.equal(result[0].value, '42');
      assert.deepEqual(result[0].parts, ['https://example.com/?id=']);
      assert.equal(result[0].index, 1);
    });


    it("returns an empty array when there are no params", function () {
      const result = HTTPAnalyzer.getParamsAnalysis({ params: {}, fullPath: 'https://example.com/' });
      assert.deepEqual(result, []);
    });
  });


  describe("getFingerprint", function () {
    it("fingerprints a tracked request (uri + verb)", function () {
      assert.equal(HTTPAnalyzer.getFingerprint({ uri: '/api/x', verb: 'GET' }), 'get:/api/x');
    });


    it("fingerprints a generated Request (url + method)", function () {
      assert.equal(HTTPAnalyzer.getFingerprint({ url: 'https://e.com/y', method: 'POST' }), 'post:https://e.com/y');
    });


    it("returns undefined for a missing request", function () {
      assert.equal(HTTPAnalyzer.getFingerprint(undefined), undefined);
    });
  });


  describe("getBaseDomain", function () {
    it("keeps the registrable domain for a subdomain", function () {
      assert.equal(HTTPAnalyzer.getBaseDomain('a.b.example.com'), 'example.com');
    });


    it("returns the domain unchanged when there is no subdomain", function () {
      assert.equal(HTTPAnalyzer.getBaseDomain('example.com'), 'example.com');
    });
  });


  describe("searchParamsToObj should keep the last value of a repeated key", function () {
    it("collapses duplicate keys", function () {
      const urlObj = new URL("https://example.com/?id=1&id=2");
      const paramsObj = HTTPAnalyzer.searchParamsToObj(urlObj.searchParams);
      assert.equal(paramsObj.id, '2');
    });
  });
});