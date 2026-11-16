---
paths:
  - "src/core/**"
  - "src/browser/**"
  - "src/extraction/**"
  - "src/state/**"
  - "src/buildExplorer.ts"
  - "src/main.ts"
---

# Exploration: invariants (do not break)

- **Identity without DOM ids or classes**: elements are identified by tag + rounded rectangle (`rectGridPx`) + text. The viewport is fixed at 1920×1080 and Crawlee fingerprinting is disabled. Anything that changes the geometry changes the ids.
- `DfsExplorer` depends only on `core/interfaces.ts`. Concrete classes get wired up only in `buildExplorer.ts`.
- `IStateStore.claim()` must stay **synchronous** (no `await`): it provides mutual exclusion between tabs (`tabsPerSite`).
- One Crawlee request per site, with no retries (a retry would restart from scratch and duplicate states).
- Keep the HTTP cache on: external navigation is blocked with CDP `Fetch` limited to documents, **not** `page.route` (which disables the cache).
- Form fields (`input`/`select`/`textarea`) are never clickable. Downloads are cancelled. The `blocklist` (logout, delete, …) is never clicked.
- Code under `extraction/browser/` and `browser/inPage/` is serialized and runs **inside the page**: no imports or closures over Node variables.
- `lightweightMode` must not change the geometry (only paint-only CSS, images, fonts).
