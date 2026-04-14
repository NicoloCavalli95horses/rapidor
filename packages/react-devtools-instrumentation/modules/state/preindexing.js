//===================
// Import
//===================
import { emit, events } from "../../utils/eventBus.js";
import { log } from "../../utils/utils.js";



//===================
// Functions
//===================
export class PreIndexing {
  constructor() {
    this.maxStrLength = 300;
    this.data = [];

    // [TODO] improve set of keys and test matches
    this.interestingKeys = [
      // id
      'id', 'user', 'account', 'profile', 'order',
      'resource', 'item', 'object', 'doc',
      'name', 'key', 'title', 'type',
      // roles
      'owner', 'createdBy', 'updatedBy',
      'author', 'creator', 'role', 'permission',
      'scope', 'scopes',
    ];
  }



  // Create data to preindex
  prepareData({ graphIndex, nodeId, key, props }) {
    if (this.isInteresting('key', key)) {
      this.data.push({ graphIndex, nodeId, value: key, path: ['key'], depth: 0 });
    }

    this.iterate(props, ({ key, value, path }) => {
      if (this.isInteresting(key, value)) {
        // only save strings to avoid false negative in comparison ('112' == 112)
        this.data.push({ graphIndex, nodeId, value: value.toString(), path, depth: path.length });
      }
    });
  }



  emit() {
    if (this.data.length === 0) { return; }

    emit({ type: events.PREINDEXING_UPDATE, payload: this.data });
    log({ module: 'preindexing', msg: 'Emitted batch' })

    this.data = [];
  }



  iterate(root, callback) {
    const stack = [{ value: root, path: ['props'], key: undefined }];

    while (stack.length) {
      const { value, path, key } = stack.pop();

      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) {
          stack.push({ key: i, value: value[i], path: [...path, i] });
        }
      } else if (value !== null && typeof value === "object") {
        const entries = Object.entries(value);
        for (let i = entries.length - 1; i >= 0; i--) {
          const [k, v] = entries[i];
          stack.push({ key: k, value: v, path: [...path, k] });
        }
      } else {
        callback({ key, value, path });
      }
    }
  }



  isInteresting(key, value) {
    if (value == null) { return false; }

    if (!this.matchesKey(key)) { return false; }

    if (typeof value === 'string') {
      if (/^\[.*\]$/.test(value)) { return false; } // ignore placeholders
      const v = value.trim();
      return (v.length > 1 && v.length < this.maxStrLength);
    }

    if (typeof value === "number") {
      return Number.isFinite(value);
    }
  }



  matchesKey(str) {
    if (!str) { return false; }
    const norm = String(str).toString().trim().toLowerCase();
    const words = this.splitWords(norm);

    return this.interestingKeys.some(k => {
      const key = k.toLowerCase();

      return (
        words.includes(key) ||
        words.some(w => w.startsWith(key)) || // prefix (id → identifier)
        words.some(w => key.startsWith(w))    // inverse (user → userid)
      );
    });
  }



  splitWords(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → camel + case
      .toLowerCase()
      .split(/[^a-z0-9]+/);
  }
}
