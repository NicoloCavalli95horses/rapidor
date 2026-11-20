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

- **Intended workflow — one deep target page, not a wide shallow sweep.** These language-learning SPAs are too noisy to crawl neutrally: a neutral seed burns the 45-min budget wandering chrome/sections and never reaches the deep lesson/exercise flow where the paid-resource IDORs live (busuu's `objective_<uuid>` is ~3 clicks below the timeline). The defaults encode "pick a target page manually, explore it deeply": `maxDepth` default **4**, `ignoreClickablesWithin` default **`['nav','footer']`** (keep the crawler on the page), `randomizeClickOrder` **on** (sample the whole clickable set, not DOM order which front-loads nav). When tuning, think "explore the one page well", not "cover many pages".
- **`ignoreClickablesWithin` must NOT contain `header`.** busuu renders primary content — including the lesson cards that are the real targets — inside a `<header>`; ignoring it makes them unreachable (an earlier run kept `header` blacklisted, never clicked the cards, and stayed on one URL). This is the SAME header-is-content trap the analysis `domZone` chrome-skip avoids. `nav`/`footer` are safe chrome; `header`/`section` are not.
- **Randomized click order is a per-tab local shuffle of a COPY** (`DfsExplorer.visit`, `shuffled`): it needs no cross-tab coordination because the synchronous `claim()` still guarantees `(state,element)` exclusivity, and `claimable()`/restore are order-independent (restore replays the recorded `state.path`, not the try order). Do not centralize selection into a shared frontier structure.
- **Identity without DOM ids or classes**: elements are identified by tag + rounded rectangle (`rectGridPx`) + text. The viewport is fixed at 1920×1080 and Crawlee fingerprinting is disabled. Anything that changes the geometry changes the ids.
- `DfsExplorer` depends only on `core/interfaces.ts`. Concrete classes get wired up only in `buildExplorer.ts`.
- `IStateStore.claim()` must stay **synchronous** (no `await`): it provides mutual exclusion between tabs (`tabsPerSite`).
- One Crawlee request per site, with no retries (a retry would restart from scratch and duplicate states).
- Keep the HTTP cache on: external navigation is blocked with CDP `Fetch` limited to documents, **not** `page.route` (which disables the cache).
- Form fields (`input`/`select`/`textarea`) are never clickable. Downloads are cancelled. The `blocklist` (logout, delete, …) is never clicked.
- Code under `extraction/browser/` and `browser/inPage/` is serialized and runs **inside the page**: no imports or closures over Node variables.
- `lightweightMode` must not change the geometry (only paint-only CSS, images, fonts).
