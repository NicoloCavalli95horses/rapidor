//===================
// Import
//===================
import { emit, eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { log } from "../utils.js";
import { config } from "../config.js";


//===================
// Functions
//===================
export class PreIndexing {
  constructor() {
    this.batchLength = 5000;
    this.timeoverMs = 5000;
    this.batches = [];
    this.timeoverId = null;
  }



  process({ graphIndex, nodeId, key, props }) {
    const batch = this.createBatch({ graphIndex, nodeId, key, props });
    if (batch.length === 0) { return; }

    for (const item of batch) { // prevent stackoverflow
      this.batches.push(item);
    }

    if (!this.timeoverId) {
      this.timeoverId = setTimeout(() => {
        this.flush();
      }, this.timeoverMs);
    }

    if (this.batches.length >= this.batchLength) {
      this.flush();
    }
  }



  flush() {
    if (this.batches.length === 0) { return; }

    emit({ type: events.PREINDEXING_UPDATE, payload: this.batches });
    log({ module: 'preindexing', msg: 'emitted batch' })
    this.batches = [];

    if (this.timeoverId) {
      clearTimeout(this.timeoverId);
      this.timeoverId = null;
    }
  }



  createBatch({ graphIndex, nodeId, key, props }) {
    const data = [];

    if (this.isInteresting(key)) {
      data.push({ graphIndex, nodeId, value: key, path: [], depth: 0 });
    }

    this.iterate(props, (value, path) => {
      if (this.isInteresting(value)) {
        data.push({ graphIndex, nodeId, value, path, depth: path.length });
      }
    });

    return data;
  }



  iterate(root, callback) {
    const stack = [{ value: root, path: [] }];

    while (stack.length) {
      const { value, path } = stack.pop();

      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) {
          stack.push({ value: value[i], path: [...path, i] });
        }
      } else if (value !== null && typeof value === "object") {
        const entries = Object.entries(value);
        for (let i = entries.length - 1; i >= 0; i--) {
          const [k, v] = entries[i];
          stack.push({ value: v, path: [...path, k] });
        }
      } else {
        callback(value, path);
      }
    }
  }



  isInteresting(value) {
    if (value == null) { return false; }

    if (typeof value === "string") {
      const v = value.trim();
      return v.length > 1 && v.length < 300;
    }

    if (typeof value === "number") {
      return Number.isFinite(value);
    }

    return false;
  }
}
