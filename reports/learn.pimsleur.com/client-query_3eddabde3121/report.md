# IDOR finding — learn.pimsleur.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `3eddabde31216a252295e5ac54d4f4ac83179c75baccd80cf2cc4534cad45e8d` |
| Site | learn.pimsleur.com |
| Detection | client-side routing |
| Swapped value | `296` → `297` |
| Position | query parameter |
| Recorded | 2026-11-25T08:56:33.931Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://learn.pimsleur.com/MiniLearn

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://learn.pimsleur.com/MiniLearn/MiniLesson?id=296&force_auto_play=false`
- **Forged request (the paid sibling's):** `https://learn.pimsleur.com/MiniLearn/MiniLesson?id=297&force_auto_play=false`

The identifier `296` was replaced with `297`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `miniLesson.id` | `296` | `297` | no |
| `miniLesson.lessonCode` | `CountingUN` | `TeenLangUN` | no |
| `miniLesson.title` | `Counting Across Cultures` | `Did Teen Girls Break Language?` | no |
| `miniLesson.fullImageFilePath` | `https://d3kaeubvx0x0ex.cloudfront.net/universal%20mini%20course/English/asset/lesson_photo/full/CountingUN_Getty_5381110…` | `https://d3kaeubvx0x0ex.cloudfront.net/universal%20mini%20course/English/asset/lesson_photo/full/TeenLangUN_Getty_2155004…` | no |
| `miniLesson.thumbImageFilePath` | `https://d3kaeubvx0x0ex.cloudfront.net/universal%20mini%20course/English/asset/lesson_photo/thumb/CountingUN_Getty_538111…` | `https://d3kaeubvx0x0ex.cloudfront.net/universal%20mini%20course/English/asset/lesson_photo/thumb/TeenLangUN_Getty_215500…` | no |
| `miniLesson.audioFileId` | `2429951` | `2429950` | no |
| `miniLesson.audioFilePath` | `https://d3kaeubvx0x0ex.cloudfront.net/universal%20mini%20course/English/asset/lesson_audio/Universal_CountingUN.mp3?vers…` | `https://d3kaeubvx0x0ex.cloudfront.net/universal%20mini%20course/English/asset/lesson_audio/Universal_TeenLangUN.mp3?vers…` | no |
| `miniLesson.featured` | `true` | `false` | **yes** |
| `miniLesson.durationMilliseconds` | `723775` | `438309` | no |
| `miniLesson.isFree` | `true` | `null` | **yes** |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `featured`, `isFree`.

## Evidence

This resource is reached purely through the SPA's **client-side routing** (no distinct backend request to forge): navigating to the forged URL renders the paid sibling's content in the authenticated lower-tier session.

**Oracle:** the normalized **DOM diff** (text nodes + `<img>` src + element count), with remount-noise calibration — the same comparison the pipeline's content guard uses. `test.ts` captures the reference page twice (to measure noise) and the forged URL once, masks both identifiers, and asserts the forged DOM is **inert** (≈ the reference, i.e. no paid content appeared) or the app's not-found page. It is RED while the paid content renders.

**Visual evidence only (not the criterion):** `test.ts` writes `assets/original.png`, `assets/mutated.png` and `assets/diff.png` next to this report. A screenshot is viewport-bound and asset-dependent, so it never decides the verdict.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
