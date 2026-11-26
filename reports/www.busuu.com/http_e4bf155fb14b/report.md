# IDOR finding — www.busuu.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `e4bf155fb14ba8313207d6dcde67e7c86fb9b3b7fd9bd195ec156b347e6bd15e` |
| Site | www.busuu.com |
| Detection | HTTP forge |
| Swapped value | `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` → `objective_22560674-b789-44e2-95fa-36717ebf19eb` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T09:36:31.246Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://www.busuu.com/dashboard/timeline/a1

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://api.busuu.com/api/v2/component/objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e?platform=web&lang1=ja&interface_language=en&translations=ja,en&content_version=3.0`
- **Forged request (the paid sibling's):** `https://api.busuu.com/api/v2/component/objective_22560674-b789-44e2-95fa-36717ebf19eb?platform=web&lang1=ja&interface_language=en&translations=ja,en&content_version=3.0`

The identifier `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` was replaced with `objective_22560674-b789-44e2-95fa-36717ebf19eb`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `id` | `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` | `objective_22560674-b789-44e2-95fa-36717ebf19eb` | no |
| `animationSequenceSteps.0` | `{"name":"AnimateImage","delay":1000}` | _(absent)_ | no |
| `title` | `Japanese writing` | `Hiragana: a i u e o` | no |
| `subtitle` | `Learn the rules of writing Japanese` | `Learn how to write the first 5 hiragana letters` | no |
| `routing.lessonId` | `objective_5f522b35-4e61-4b20-a687-f02d0ba2a67e` | `objective_22560674-b789-44e2-95fa-36717ebf19eb` | no |
| `routing.unitId` | `0_0_0_5f522b354e614b20a687f02d0ba2a67e` | `0_0_0_22560674b78944e295fa36717ebf19eb` | no |
| `routing.activityId` | `activity_0a57daaa-f13d-4dee-a542-efbc915d829d` | `activity_2bb5e3df-d160-47e4-86ad-a23ff19179ef` | no |
| `image` | `https://cdn.busuu.com/media/resized/navigation/256/objective_ja_complete_a2_771661529403_256.jpg` | `https://cdn.busuu.com/media/resized/navigation/256/unit_ja_complete_a1_124_11661530415_256.jpg` | no |
| `unlocked` | `true` | `false` | **yes** |
| `active` | `true` | `false` | no |
| `isLastUpdatedComponent` | `true` | `[non-serializable:undefined]` | no |
| `isNextUp` | `true` | `false` | no |
| `isLessonUnlocked` | `true` | `false` | **yes** |
| `timeEstimated` | `98` | `200` | no |
| `index` | `0` | `1` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `unlocked`, `isLessonUnlocked`.

## Evidence

The forged **GET** replayed the request with the paid sibling's identifier, in the authenticated (lower-tier) session.

A finding means the server answered **2xx** with a body shaped like the baseline but **not identical** to it — the paid resource was served, not a denial or a fallback to the free content.

Server-response similarity: `{"areSimilar":true,"fields":{"areEqual":true,"fields":["status","contentType"]},"bodyLength":{"refLen":27047,"candLen":58343,"isSimilar":true,"threshold":0.45},"bodyShape":{"refKeys":7,"candKeys":7,"isSimilar":true,"threshold":0.45}}`.

Baseline (your own request): status `200`, content-type `application/json`. Request/response headers in `evidence.json` have their credentials redacted.

**Oracle:** `test.ts` re-forges the GET live and asserts the server now **rejects** it (status ≥ 400, an empty/error body, or the free fallback). It is RED while the leak reproduces.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
