# IDOR finding — promova.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `9d3e362ba6ff6326556bc8d532b39185bb12e169385c52874a52f3c6729ef051` |
| Site | promova.com |
| Detection | HTTP forge |
| Swapped value | `73` → `82` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:55:50.771Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://promova.com/my-plan/app3XAphYAQgyNJwg

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://courses.api.promova.com/v1/users/steps/app3XAphYAQgyNJwg/73`
- **Forged request (the paid sibling's):** `https://courses.api.promova.com/v1/users/steps/app3XAphYAQgyNJwg/82`

The identifier `73` was replaced with `82`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `lesson.id` | `73` | `82` | no |
| `lesson.title` | `Single vowels: ㅏ and ㅓ` | `Y-vowels: ㅑ and ㅕ` | no |
| `lesson.free` | `true` | `false` | **yes** |
| `lesson.image` | `https://img.api.promova.com/files/d3dr48s0bfbpdcnmqc5g.svg` | `https://img.api.promova.com/files/d3dr4as0bfbpdcnmqcng.svg` | no |
| `lesson.color_code` | `#9CA8DB` | `#CBE0A6` | no |
| `lesson.progress.update.canvas.updated_at` | `2026-11-22T13:04:06Z` | `2026-11-20T17:28:25Z` | no |
| `lesson.progress.update.for_you.updated_at` | `2026-11-22T13:04:06Z` | `2026-11-20T17:28:25Z` | no |
| `lesson.progress.update.my_plan.updated_at` | `2026-11-22T13:04:06Z` | `2026-11-20T17:28:25Z` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `free`.

## Evidence

The forged **GET** replayed the request with the paid sibling's identifier, in the authenticated (lower-tier) session.

A finding means the server answered **2xx** with a body shaped like the baseline but **not identical** to it — the paid resource was served, not a denial or a fallback to the free content.

Server-response similarity: `{"areSimilar":true,"fields":{"areEqual":true,"fields":["status","contentType"]},"bodyLength":{"refLen":21870,"candLen":18759,"isSimilar":true,"threshold":0.45},"bodyShape":{"refKeys":15,"candKeys":15,"isSimilar":true,"threshold":0.45}}`.

Baseline (your own request): status `200`, content-type `application/json`. Request/response headers in `evidence.json` have their credentials redacted.

**Oracle:** `test.ts` re-forges the GET live and asserts the server now **rejects** it (status ≥ 400, an empty/error body, or the free fallback). It is RED while the leak reproduces.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
