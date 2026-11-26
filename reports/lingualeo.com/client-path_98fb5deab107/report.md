# IDOR finding — lingualeo.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `98fb5deab10759b5c54cd6b24b9602edf17780953eec658dca5dbd5d523a0155` |
| Site | lingualeo.com |
| Detection | client-side routing |
| Swapped value | `/en/training/wordTranslate?utm_action=10` → `wordPuzzle` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:52:29.492Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://lingualeo.com/en/training

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://lingualeo.com/en/training/wordTranslate?utm_action=10`
- **Forged request (the paid sibling's):** `https://lingualeo.com/en/training/wordPuzzle?utm_action=10`

The identifier `/en/training/wordTranslate?utm_action=10` was replaced with `wordPuzzle`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `type` | `word_translate` | `word_puzzle` | no |
| `titleText` | `Word-Translation` | `Word builder` | no |
| `tooltipText` | `Improves your translation skills and boosts your understanding of texts and speech.` | `Helps you improve your translation and writing skills.` | no |
| `available` | `null` | `0` | **yes** |
| `skills.0` | `listening` | `writing` | no |
| `url` | `/en/training/wordTranslate?utm_action=10` | `/en/training/wordPuzzle?utm_action=10` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `available`.

## Evidence

This resource is reached purely through the SPA's **client-side routing** (no distinct backend request to forge): navigating to the forged URL renders the paid sibling's content in the authenticated lower-tier session.

**Oracle:** the normalized **DOM diff** (text nodes + `<img>` src + element count), with remount-noise calibration — the same comparison the pipeline's content guard uses. `test.ts` captures the reference page twice (to measure noise) and the forged URL once, masks both identifiers, and asserts the forged DOM is **inert** (≈ the reference, i.e. no paid content appeared) or the app's not-found page. It is RED while the paid content renders.

**Visual evidence only (not the criterion):** `test.ts` writes `assets/original.png`, `assets/mutated.png` and `assets/diff.png` next to this report. A screenshot is viewport-bound and asset-dependent, so it never decides the verdict.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
