# IDOR finding — lingualeo.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `db18ffbc7bd9142e3f4dff67a38b942b1d666d9b245a5875b1fc4c8f05f26c31` |
| Site | lingualeo.com |
| Detection | client-side routing |
| Swapped value | `/en/training/wordTranslate?utm_action=10` → `translateWord` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:52:33.296Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://lingualeo.com/en/training

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://lingualeo.com/en/training/wordTranslate?utm_action=10`
- **Forged request (the paid sibling's):** `https://lingualeo.com/en/training/translateWord?utm_action=10`

The identifier `/en/training/wordTranslate?utm_action=10` was replaced with `translateWord`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `type` | `word_translate` | `translate_word` | no |
| `titleText` | `Word-Translation` | `Translation-Word` | no |
| `tooltipText` | `Improves your translation skills and boosts your understanding of texts and speech.` | `Helps to learn the meaning of words and express your thoughts better.` | no |
| `available` | `null` | `0` | **yes** |
| `url` | `/en/training/wordTranslate?utm_action=10` | `/en/training/translateWord?utm_action=10` | no |

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
