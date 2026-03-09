//===================
// Import
//===================



//===================
// Class
//===================
export class NavigationTracker {
  constructor() {
    this.visited = new Set();
  }



  init() {
    this.clean();
  }



  // returns the URL in normalized format, ensuring the order of the query parameters
  normalize(url) {
    const u = new URL(url);
    u.hash = "";
    u.pathname = u.pathname.replace(/\/$/, ""); // remove extra `/` if present

    const params = new URLSearchParams(u.search);
    const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
    u.search = sorted.toString();

    const fullPath = u.origin + u.pathname + (u.search ? "?" + u.search : "");

    return fullPath;
  }



  getCurrent() {
    return this.normalize(window.location.href);
  }



  saveCurrent() {
    this.visited.add(this.getCurrent());
  }



  hasAlreadyVisited() {
    if (this.visited.size) {
      return this.visited.has(this.getCurrent());
    } else {
      this.saveCurrent();
      return false
    }
  }



  clean() {
    this.visited.clear();
  }
}