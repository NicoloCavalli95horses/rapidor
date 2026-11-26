# IDOR finding — app.rocketlanguages.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `5d00fa5c9782d60fbfa04674e879d58e8e061672c7415ea218930b5e47900a10` |
| Site | app.rocketlanguages.com |
| Detection | client-side routing |
| Swapped value | `leaderboard` → `rocket-certification` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T07:11:19.849Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://app.rocketlanguages.com/members/products/186/dashboard

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://app.rocketlanguages.com/members/products/186/tools/leaderboard`
- **Forged request (the paid sibling's):** `https://app.rocketlanguages.com/members/products/186/tools/rocket-certification`

The identifier `leaderboard` was replaced with `rocket-certification`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `item.localeTitle` | `leaderboard` | `rocket-certification` | no |
| `item.path` | `leaderboard` | `rocket-certification` | no |
| `item.hiddenForCourse` | _(absent)_ | `["sign-language","english"]` | no |
| `item.hiddenForProductLevel` | _(absent)_ | `[4]` | **yes** |
| `item.lockedForType` | _(absent)_ | `[2,10]` | **yes** |
| `item.hiddenForType` | _(absent)_ | `[13]` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `hiddenForProductLevel`, `lockedForType`.

## Evidence

This resource is reached purely through the SPA's **client-side routing** (no distinct backend request to forge): navigating to the forged URL renders the paid sibling's content in the authenticated lower-tier session.

**Oracle:** the normalized **DOM diff** (text nodes + `<img>` src + element count), with remount-noise calibration — the same comparison the pipeline's content guard uses. `test.ts` captures the reference page twice (to measure noise) and the forged URL once, masks both identifiers, and asserts the forged DOM is **inert** (≈ the reference, i.e. no paid content appeared) or the app's not-found page. It is RED while the paid content renders.

**Visual evidence only (not the criterion):** `test.ts` writes `assets/original.png`, `assets/mutated.png` and `assets/diff.png` next to this report. A screenshot is viewport-bound and asset-dependent, so it never decides the verdict.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
