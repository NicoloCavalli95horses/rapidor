# IDOR finding — my.babbel.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `a41857eb81892f2e147760f9095459071ae84583a80438a5b0f99a5d947321f9` |
| Site | my.babbel.com |
| Detection | client-side routing |
| Swapped value | `21579bc6e366ed2e12952008b330f3cb1d0211ad` → `014a43038a2ac1ad11a5a3de584879f5cdf514a9` |
| Position | query parameter |
| Recorded | 2026-11-25T07:58:22.226Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://my.babbel.com/dashboard/inprogress

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://my.babbel.com/en_GB/lesson-player/FRA/0ecaf91449be4f5aaa53790769d5aed3/e0b0ff97-a402-42f6-a8a3-9b48c5895426?return_url=https%3A%2F%2Fmy.babbel.com%2Fdashboard%2Finprogress&learning_activity_id=80b70c10260b4424a78803c7bf95fe87&content_release_id=21579bc6e366ed2e12952008b330f3cb1d0211ad&origin=learning_path`
- **Forged request (the paid sibling's):** `https://my.babbel.com/en_GB/lesson-player/FRA/0ecaf91449be4f5aaa53790769d5aed3/e0b0ff97-a402-42f6-a8a3-9b48c5895426?return_url=https%3A%2F%2Fmy.babbel.com%2Fdashboard%2Finprogress&learning_activity_id=80b70c10260b4424a78803c7bf95fe87&content_release_id=014a43038a2ac1ad11a5a3de584879f5cdf514a9&origin=learning_path`

The identifier `21579bc6e366ed2e12952008b330f3cb1d0211ad` was replaced with `014a43038a2ac1ad11a5a3de584879f5cdf514a9`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `data.title` | `Bienvenue ! Part 1` | `Trois Anglais dans l'équipe. Part 1` | no |
| `data.subtitle` | `Welcome!` | `Three English people on the team.` | no |
| `data.description` | `how to greet others and say goodbye how to ask someone how they are` | `how to state your nationality the feminine and masculine forms of nationalities` | no |
| `data.topics.0` | `how to greet others and say goodbye` | `how to state your nationality` | no |
| `data.topics.1` | `how to ask someone how they are` | `the feminine and masculine forms of nationalities` | no |
| `data.imageId` | `0a1d628482694c519a797f23ef4f3fe1` | `46e42a14ab744cbb9c06eba040370693` | no |
| `data.canDos.0` | `A1_1` | `A1_22` | no |
| `data.canDos.1` | `A1_2` | _(absent)_ | no |
| `data.tags.0` | `motivation:travel` | `level:a1` | no |
| `data.tags.1` | `motivation:relationships` | `motivation:school` | no |
| `data.tags.3` | `motivation:school` | `vocabulary:communication:identification` | no |
| `data.tags.4` | `level:a1` | `grammar:noun:gender` | no |
| `data.tags.5` | `vocabulary:communication:greetings_goodbyes` | `grammar:adjective` | no |
| `data.tags.6` | `grammar:verb:present_tense` | _(absent)_ | no |
| `data.tags.7` | `grammar:adjective` | _(absent)_ | no |
| `data.tags.8` | `grammar:pronoun:interrogative` | _(absent)_ | no |
| `data.contentId` | `0ecaf91449be4f5aaa53790769d5aed3` | `892cbd81a3ae44159c689d10f0999783` | no |
| `data.learningActivityId` | `80b70c10260b4424a78803c7bf95fe87` | `5f8b6f226d5e45149511d242b26d9572` | no |
| `data.active` | `true` | `false` | no |
| `data.unlocked` | `true` | `false` | **yes** |
| `data.contentReleaseId` | `21579bc6e366ed2e12952008b330f3cb1d0211ad` | `014a43038a2ac1ad11a5a3de584879f5cdf514a9` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `unlocked`.

## Evidence

This resource is reached purely through the SPA's **client-side routing** (no distinct backend request to forge): navigating to the forged URL renders the paid sibling's content in the authenticated lower-tier session.

**Oracle:** the normalized **DOM diff** (text nodes + `<img>` src + element count), with remount-noise calibration — the same comparison the pipeline's content guard uses. `test.ts` captures the reference page twice (to measure noise) and the forged URL once, masks both identifiers, and asserts the forged DOM is **inert** (≈ the reference, i.e. no paid content appeared) or the app's not-found page. It is RED while the paid content renders.

**Visual evidence only (not the criterion):** `test.ts` writes `assets/original.png`, `assets/mutated.png` and `assets/diff.png` next to this report. A screenshot is viewport-bound and asset-dependent, so it never decides the verdict.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
