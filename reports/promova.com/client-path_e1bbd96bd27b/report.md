# IDOR finding — promova.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `e1bbd96bd27b042ec9717fe610074712ca39f65d778312f7cfe92daf73ab30b4` |
| Site | promova.com |
| Detection | client-side routing |
| Swapped value | `73` → `83` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:55:50.762Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://promova.com/my-plan/app3XAphYAQgyNJwg

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://promova.com/my-plan/app3XAphYAQgyNJwg/73`
- **Forged request (the paid sibling's):** `https://promova.com/my-plan/app3XAphYAQgyNJwg/83`

The identifier `73` was replaced with `83`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `lesson.id` | `73` | `83` | no |
| `lesson.title` | `Single vowels: ㅏ and ㅓ` | `Y-vowels: ㅛ, ㅠ, ㅒ, and ㅖ` | no |
| `lesson.free` | `true` | `false` | **yes** |
| `lesson.image` | `https://img.api.promova.com/files/d3dr48s0bfbpdcnmqc5g.svg` | `https://img.api.promova.com/files/d3dr4b40bfbpdcnmqcpg.svg` | no |
| `lesson.color_code` | `#9CA8DB` | `#B8DEE0` | no |
| `lesson.progress.update.canvas.updated_at` | `2026-11-22T13:04:06Z` | `2026-11-20T17:28:26Z` | no |
| `lesson.progress.update.for_you.updated_at` | `2026-11-22T13:04:06Z` | `2026-11-20T17:28:26Z` | no |
| `lesson.progress.update.my_plan.updated_at` | `2026-11-22T13:04:06Z` | `2026-11-20T17:28:26Z` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `free`.

## Evidence

This resource is reached purely through the SPA's **client-side routing** (no distinct backend request to forge): navigating to the forged URL renders the paid sibling's content in the authenticated lower-tier session.

**Oracle:** the normalized **DOM diff** (text nodes + `<img>` src + element count), with remount-noise calibration — the same comparison the pipeline's content guard uses. `test.ts` captures the reference page twice (to measure noise) and the forged URL once, masks both identifiers, and asserts the forged DOM is **inert** (≈ the reference, i.e. no paid content appeared) or the app's not-found page. It is RED while the paid content renders.

**Visual evidence only (not the criterion):** `test.ts` writes `assets/original.png`, `assets/mutated.png` and `assets/diff.png` next to this report. A screenshot is viewport-bound and asset-dependent, so it never decides the verdict.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
