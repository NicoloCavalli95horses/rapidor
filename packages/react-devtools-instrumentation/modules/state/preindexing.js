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
      'name', 'key', 'title', 'type', 'url', 'link',
      // roles
      'owner', 'createdBy', 'updatedBy',
      'author', 'creator', 'role', 'permission',
      'scope', 'scopes',
      // content
      'content', 'node', 'slug'
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
        // always save data as array (value can be an URL, in this cases we split it into tokens)
        this.data.push({ graphIndex, nodeId, value: this.tokenize(value.toString()), path, depth: path.length });
      }
    });
  }



  emit() {
    if (this.data.length === 0) { return; }

    emit({ type: events.PREINDEXING_UPDATE, payload: this.data });
    log({ module: 'preindexing', msg: 'Emitted batch' })

    this.data = [];
  }



  // Split string into tokens if contains / or . or ? 
  tokenize(value, rule = /[/.?]/) {
    if (typeof value !== 'string') { return []; }

    return value
      .split(rule)
      .map(v => v.trim())
      .filter(Boolean);
  }



  iterate(root, callback, maxDepth = 4) {
    const stack = [{ value: root, path: ['props'], key: undefined }];

    while (stack.length) {
      const { value, path, key } = stack.pop();

      if (path.length > maxDepth) { continue; } // limit exploration

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

    if (!this.isKeyMatch(key)) { return false; }

    if (typeof value === 'string') {
      const hasSquareBrackets = /^\[.*\]$/.test(value);
      const hasWhiteSpaces = /\s/.test(value);
      if (hasSquareBrackets || hasWhiteSpaces) { return false; }
      const v = value.trim();
      return (v.length > 1 && v.length < this.maxStrLength);
    }

    if (typeof value === "number") {
      return Number.isFinite(value);
    }
  }



  isKeyMatch(str) {
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
