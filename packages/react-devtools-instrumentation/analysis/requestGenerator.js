//===================
// Import
//===================
import { eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';


//===================
// Functions
//===================
export class RequestGenerator {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  init() {
    eventBus
      .pipe(filter(e => e.type === events.GEN_REQ))
      .subscribe(e => this.handleGenerate(e.payload));
  }



  async handleGenerate(event) {
    const { results, http } = event;
    const segments = await this.findAlternativeSegments(results);
    const res = await this.buildRequests(http.request, segments);
    console.log(res);
  }


  async buildRequests(ref, segments) {
    const commonRoot = this.removeLastSegment(ref.uri);
    const method = ref.verb.toUpperCase();

    const promises = segments.map((s) => {
      const path = `${commonRoot}/${s}`;

      const options = {
        method,
        ...(ref.headers && { headers: ref.headers }),
        ...(
          ["POST", "PUT", "PATCH"].includes(method) && ref.body
            ? { body: ref.body }
            : {}
        )
      };

      return this.fetchRequest({ path, options });
    });

    return Promise.all(promises);
  }



  removeLastSegment(endpoint) {
    const url = new URL(endpoint);
    const segments = url.pathname.split('/').filter(Boolean);
    segments.pop();
    url.pathname = '/' + segments.join('/');
    return url.toString();
  }



  async findAlternativeSegments(results) {
    const segments = new Set();

    for (const result of results) {
      const node = await this.stateManager.getStateByID(result.rowId, result.nodeId);
      const { path, value: match } = result;
      const lastKey = path[path.length - 1];

      const siblings = this.findRelevantArray(node, path, lastKey, match);
      if (!siblings) { continue; }

      for (const child of siblings) {
        if (child?.[lastKey] != null) {
          segments.add(child[lastKey]);
        }
      }
    }

    return [...segments];
  }



  findRelevantArray(root, path, lastKey, match) {
    let current = root;

    for (let i = 0; i < path.length; i++) {
      if (current == null) { return null; }

      const key = path[i];
      current = current[key];

      if (Array.isArray(current)) {
        const found = current.some(
          item => item?.[lastKey] === match
        );

        if (found) { return current; }
      }
    }

    return null;
  }

  async fetchRequest({ path, options }) {
    try {
      const response = await fetch(path, options);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(error.message);
    }
  }
}