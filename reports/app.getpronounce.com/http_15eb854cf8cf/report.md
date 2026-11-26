# IDOR finding — app.getpronounce.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `15eb854cf8cf3a472a3f6a97437bf0eb4b06efcc41ad269dda6c0305fe11c2f2` |
| Site | app.getpronounce.com |
| Detection | HTTP forge |
| Swapped value | `echo` → `shimmer` |
| Position | query parameter |
| Recorded | 2026-11-25T07:09:24.847Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://app.getpronounce.com/courses/Ocpkyua83V

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://api.getpronounce.com/pronounce?text=Oh%2C+nice%21&voice=echo&provider=openai&speed=1&tag=chat.backchannel`
- **Forged request (the paid sibling's):** `https://api.getpronounce.com/pronounce?text=Oh%2C+nice%21&voice=shimmer&provider=openai&speed=1&tag=chat.backchannel`

The identifier `echo` was replaced with `shimmer`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `voiceId` | `echo` | `shimmer` | no |
| `name` | `Jack` | `Emma` | no |
| `descriptionKey` | `descriptions.echo` | `descriptions.shimmer` | no |
| `isFree` | `true` | `false` | **yes** |
| `text` | `Hello, I'm Jack, cooperative and polite, always ready to help and make your day better!` | `Hi there! I'm Emma, your go-to source of energy and kindness, always ready to brighten your day!` | no |
| `providerVoiceId` | `echo` | `shimmer` | no |
| `available` | `true` | `false` | **yes** |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `isFree`, `available`.

## Evidence

The forged **GET** replayed the request with the paid sibling's identifier, in the authenticated (lower-tier) session.

A finding means the server answered **2xx** with a body shaped like the baseline but **not identical** to it — the paid resource was served, not a denial or a fallback to the free content.

Server-response similarity: `{"areSimilar":true,"fields":{"areEqual":true,"fields":["status","contentType"]},"bodyLength":{"refLen":5894,"candLen":8600,"isSimilar":true,"threshold":0.45},"bodyShape":{"refKeys":0,"candKeys":0,"isSimilar":true,"threshold":0.45}}`.

Baseline (your own request): status `200`, content-type `audio/mpeg`. Request/response headers in `evidence.json` have their credentials redacted.

**Oracle:** `test.ts` re-forges the GET live and asserts the server now **rejects** it (status ≥ 400, an empty/error body, or the free fallback). It is RED while the leak reproduces.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
