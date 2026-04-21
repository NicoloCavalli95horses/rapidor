//===================
// Import
//===================
import { debounceWithMaxTime, sleep } from "../utils/utils.js";
import assert from "node:assert";



//===================
// Test suite
//===================
describe("utils", function () {

  describe("Function debounceWithMaxTime", function () {
    it("should execute after sufficient idle time", async () => {
      const debounceT = 300;
      const maxT = 10000;
      let count = 0;

      const fn = debounceWithMaxTime(() => { count++; }, { debounceT, maxT });

      const t = setInterval(fn, 100);

      await sleep(300);
      clearInterval(t);

      await sleep(400);
      assert.equal(count, 1);
    });


    it("should execute once after maxT, under continuous load", async () => {
      const debounceT = 300;
      const maxT = 1000;
      let count = 0;

      const fn = debounceWithMaxTime(() => { count++; }, { debounceT, maxT });

      const t = setInterval(fn, 100);

      await sleep(1200); // t keeps updating for 1200ms, maxT is triggered
      clearInterval(t);

      assert.ok(count == 1);
    }).timeout(10000);


    it("should not execute while already running", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const fn = debounceWithMaxTime(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);

        await sleep(300);
        concurrent--;
      }, { debounceT: 100, maxT: 200 });

      const t = setInterval(fn, 50);

      await sleep(1000);
      clearInterval(t);

      assert.equal(maxConcurrent, 1);
    });


    it("should reset after execution", async () => {
      let count = 0;

      const fn = debounceWithMaxTime(() => {
        count++;
      }, { debounceT: 200, maxT: 1000 });

      fn();
      await sleep(300); // trigger debounce

      fn();
      await sleep(300); // should execute again

      assert.equal(count, 2);
    });

  });
});
