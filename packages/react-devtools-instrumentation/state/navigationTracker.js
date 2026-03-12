//===================
// Import
//===================



//===================
// Class
//===================
export class NavigationTracker {
  constructor() {
    this.visited = new Set();
    this.current = undefined;
    this.last = undefined;
  }

  static STATE = {
    SAME_PAGE: 'same_page',
    VISITED: 'visited',
    NEW_PAGE: 'new_page'
  }



  init() {
    this.clean();
  }



  canProcessPage() {
    return [
      NavigationTracker.STATE.NEW_PAGE,
      NavigationTracker.STATE.SAME_PAGE,
    ].includes(this.getNavigationState());
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



  getNavigationState() {
    const url = this.getCurrent();
    this.last = this.current;
    this.current = url;

    // same page
    if (this.last === url) {
      return NavigationTracker.STATE.SAME_PAGE;
    }

    // page change
    if (this.visited.has(url)) {
      return NavigationTracker.STATE.VISITED;
    }

    // new page
    this.visited.add(url);
    return NavigationTracker.STATE.NEW_PAGE;
  }



  getInfo() {
    return {
      current: this.current,
      last: this.last,
      visited: [...this.visited],
      navigationState: this.getNavigationState()
    };
  }



  clean() {
    this.visited.clear();
    this.current = undefined;
    this.last = undefined;
  }
}