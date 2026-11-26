# IDOR finding — my.babbel.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `0f1e10706f066a1ea2abb048006f65a223716ca13a32f2478646326a3db2dc3a` |
| Site | my.babbel.com |
| Detection | client-side routing |
| Swapped value | `21579bc6e366ed2e12952008b330f3cb1d0211ad` → `b383a84f45053f7ef594127f61355288a9e96d31` |
| Position | query parameter |
| Recorded | 2026-11-25T07:58:22.337Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://my.babbel.com/dashboard/inprogress

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://my.babbel.com/en_GB/lesson-player/FRA/0ecaf91449be4f5aaa53790769d5aed3/e0b0ff97-a402-42f6-a8a3-9b48c5895426?return_url=https%3A%2F%2Fmy.babbel.com%2Fdashboard%2Finprogress&learning_activity_id=80b70c10260b4424a78803c7bf95fe87&content_release_id=21579bc6e366ed2e12952008b330f3cb1d0211ad&origin=learning_path`
- **Forged request (the paid sibling's):** `https://my.babbel.com/en_GB/lesson-player/FRA/0ecaf91449be4f5aaa53790769d5aed3/e0b0ff97-a402-42f6-a8a3-9b48c5895426?return_url=https%3A%2F%2Fmy.babbel.com%2Fdashboard%2Finprogress&learning_activity_id=80b70c10260b4424a78803c7bf95fe87&content_release_id=b383a84f45053f7ef594127f61355288a9e96d31&origin=learning_path`

The identifier `21579bc6e366ed2e12952008b330f3cb1d0211ad` was replaced with `b383a84f45053f7ef594127f61355288a9e96d31`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `data.title` | `Bienvenue ! Part 1` | `Vin rouge et cacahuètes. Part 1` | no |
| `data.subtitle` | `Welcome!` | `Red wine and peanuts.` | no |
| `data.description` | `how to greet others and say goodbye how to ask someone how they are` | `numbers 9 to 12 vocabulary for things you find in a bar plural articles` | no |
| `data.topics.0` | `how to greet others and say goodbye` | `numbers 9 to 12` | no |
| `data.topics.1` | `how to ask someone how they are` | `vocabulary for things you find in a bar` | no |
| `data.topics.2` | _(absent)_ | `plural articles` | no |
| `data.imageId` | `0a1d628482694c519a797f23ef4f3fe1` | `67ac2413d82748d08449d6214d55b8ec` | no |
| `data.canDos.0` | `A1_1` | `A1_8` | no |
| `data.canDos.1` | `A1_2` | `A1_16` | no |
| `data.tags.0` | `motivation:travel` | `level:a1` | no |
| `data.tags.1` | `motivation:relationships` | `motivation:interest_culture` | no |
| `data.tags.2` | `motivation:work` | `motivation:travel` | no |
| `data.tags.3` | `motivation:school` | `motivation:relationships` | no |
| `data.tags.4` | `level:a1` | `motivation:work` | no |
| `data.tags.5` | `vocabulary:communication:greetings_goodbyes` | `vocabulary:food_drink:groceries_fruits_vegetables` | no |
| `data.tags.6` | `grammar:verb:present_tense` | `vocabulary:time_numbers:numbers` | no |
| `data.tags.7` | `grammar:adjective` | `vocabulary:food_drink:beverages` | no |
| `data.tags.8` | `grammar:pronoun:interrogative` | `grammar:number_cardinal` | no |
| `data.tags.9` | _(absent)_ | `grammar:noun:plural` | no |
| `data.contentId` | `0ecaf91449be4f5aaa53790769d5aed3` | `4b725131d46543aba12a669b74a8ba77` | no |
| `data.learningActivityId` | `80b70c10260b4424a78803c7bf95fe87` | `d4f528fc57d74208aa22c8f5becc973b` | no |
| `data.active` | `true` | `false` | no |
| `data.unlocked` | `true` | `false` | **yes** |
| `data.contentReleaseId` | `21579bc6e366ed2e12952008b330f3cb1d0211ad` | `b383a84f45053f7ef594127f61355288a9e96d31` | no |

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
