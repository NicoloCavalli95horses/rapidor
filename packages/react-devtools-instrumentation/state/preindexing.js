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
    this.maxStrLength = 300;
    this.batches = [];
    this.timeoverId = null;

    this.interestingKeys = [
      // id
      'id', 'userId', 'accountId', 'profileId', 'orderId',
      'resourceId', 'itemId', 'objectId', 'docId',
      'uid', 'uuid', 'guid', 'item',
      // roles
      'owner', 'ownerId',
      'user', 'username',
      'account', 'accountId',
      'createdBy', 'updatedBy',
      'author', 'creator',
      'role', 'roles',
      'permission', 'permissions',
      'scope', 'scopes',
      'isAdmin', 'isOwner', 'isSubscribed',
      'accessLevel', 'isPremium', 'premium',
      'registered', 'sub', 'isRegistered',
    ];
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

    this.iterate(props, ({ key, value, path }) => {
      if (this.isInteresting(key, value)) {
        data.push({ graphIndex, nodeId, value, path, depth: path.length });
      }
    });

    return data;
  }



  iterate(root, callback) {
    const stack = [{ value: root, path: [], key: undefined }];

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

    if (this.matchesKey(key)) {

      if (typeof value === 'string') {
        if (/^\[.*\]$/.test(value)) { return false; } // ignore placeholders
        const v = value.trim();
        return v.length > 1 && v.length < this.maxStrLength;
      }

      if (typeof value === "number") {
        return Number.isFinite(value);
      }
    }

    return false;
  }



  matchesKey(str) {
    if (!str) { return false; }
    const norm = str.toString().trim().toLowerCase();
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
