# IDOR finding — lingualeo.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `4c8baff174dbbe2e74b70aff3c2ef2f13762dbe7b98716374ed019dc14c9d9e1` |
| Site | lingualeo.com |
| Detection | client-side routing |
| Swapped value | `/en/training/wordTranslate?utm_action=10` → `wordsCards` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:54:00.180Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://lingualeo.com/en/training

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://lingualeo.com/en/training/wordTranslate?utm_action=10`
- **Forged request (the paid sibling's):** `https://lingualeo.com/en/training/wordsCards?utm_action=10`

The identifier `/en/training/wordTranslate?utm_action=10` was replaced with `wordsCards`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `type` | `word_translate` | `word_cards` | no |
| `titleText` | `Word-Translation` | `Vocabulary cards` | no |
| `tooltipText` | `Improves your translation skills and boosts your understanding of texts and speech.` | `With vocabulary cards you can quickly check to see how many words from your personal dictionary do you know.` | no |
| `available` | `null` | `0` | **yes** |
| `url` | `/en/training/wordTranslate?utm_action=10` | `/en/training/wordsCards?utm_action=10` | no |

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
