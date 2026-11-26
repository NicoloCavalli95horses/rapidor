# IDOR finding — www.busuu.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `beb1a050a1016b5917c04319eba50bd8099c029e45bc0adf42f80bad3f30ee05` |
| Site | www.busuu.com |
| Detection | HTTP forge |
| Swapped value | `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` → `objective_ja_complete_a1_37_b` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T09:36:31.260Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://www.busuu.com/dashboard/timeline/a1

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://api.busuu.com/api/v2/component/objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e?platform=web&lang1=ja&interface_language=en&translations=ja,en&content_version=3.0`
- **Forged request (the paid sibling's):** `https://api.busuu.com/api/v2/component/objective_ja_complete_a1_37_b?platform=web&lang1=ja&interface_language=en&translations=ja,en&content_version=3.0`

The identifier `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` was replaced with `objective_ja_complete_a1_37_b`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `id` | `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` | `objective_ja_complete_a1_37_b` | no |
| `animationSequenceSteps.0` | `{"name":"AnimateImage","delay":1000}` | _(absent)_ | no |
| `title` | `Japanese writing` | `Hiragana: long consonants` | no |
| `subtitle` | `Learn the rules of writing Japanese` | `Learn how to form and pronounce long consonants` | no |
| `routing.lessonId` | `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` | `objective_ja_complete_a1_37_b` | no |
| `routing.unitId` | `0_0_0_5f522b354e614b20a687f02d0ba2a67e` | `unit_ja_complete_a1_b_1_c` | no |
| `routing.activityId` | `activity_0a57daaa-f13d-4dee-a542-efbc915d829d` | `activity_ja_a1_b_c_1` | no |
| `image` | `https://cdn.busuu.com/media/resized/navigation/256/objective_ja_complete_a2_771661529403_256.jpg` | `https://cdn.busuu.com/objectives/thumbnails/objective_ja_complete_a1_37_b_256.jpg` | no |
| `unlocked` | `true` | `false` | **yes** |
| `active` | `true` | `false` | no |
| `isLastUpdatedComponent` | `true` | `[non-serializable:undefined]` | no |
| `isNextUp` | `true` | `false` | no |
| `isLessonUnlocked` | `true` | `false` | **yes** |
| `timeEstimated` | `98` | `427` | no |
| `index` | `0` | `2` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `unlocked`, `isLessonUnlocked`.

## Evidence

The forged **GET** replayed the request with the paid sibling's identifier, in the authenticated (lower-tier) session.

A finding means the server answered **2xx** with a body shaped like the baseline but **not identical** to it — the paid resource was served, not a denial or a fallback to the free content.

Server-response similarity: `{"areSimilar":true,"fields":{"areEqual":true,"fields":["status","contentType"]},"bodyLength":{"refLen":27047,"candLen":47250,"isSimilar":true,"threshold":0.45},"bodyShape":{"refKeys":7,"candKeys":7,"isSimilar":true,"threshold":0.45}}`.

Baseline (your own request): status `200`, content-type `application/json`. Request/response headers in `evidence.json` have their credentials redacted.

**Oracle:** `test.ts` re-forges the GET live and asserts the server now **rejects** it (status ≥ 400, an empty/error body, or the free fallback). It is RED while the leak reproduces.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
