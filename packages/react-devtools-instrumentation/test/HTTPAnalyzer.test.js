//===================
// Import
//===================
import { analyzeHTTP } from "../HTTP/HTTPAnalyzer.js";
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

  
  it("should return the correct segment of the URL", function () {
    // HTTPAnalyzer.getPropertyAt() //[TODO]
  })
});