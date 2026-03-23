//===================
// Import
//===================



//===================
// Class
//===================

export class NavigationTracker {
  constructor() {
  }

  getNavigationState() {
    const uri = new URL(window?.location?.href);
    const fullPath = decodeURIComponent(uri.origin + uri.pathname); //no query parameters
    return fullPath;
  }
}
