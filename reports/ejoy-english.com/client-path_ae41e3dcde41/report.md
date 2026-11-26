# IDOR finding — ejoy-english.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `ae41e3dcde41c04877fc32eca240df0f7009b7fa4795c99e6c1cfa0578bef513` |
| Site | ejoy-english.com |
| Detection | client-side routing |
| Swapped value | `1031` → `1032` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:54:45.936Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://ejoy-english.com/app/courses/37/314

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://ejoy-english.com/app/courses/37/314/1031?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1031%2Fc2eb73c053754da1c8266e9f34791285ddb006af.json`
- **Forged request (the paid sibling's):** `https://ejoy-english.com/app/courses/37/314/1032?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1032%2Fbe938897246b1d3be9418cedbfa7a2dad497d1ac.json`

The identifier `1031` was replaced with `1032`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `lesson.id` | `1031` | `1032` | no |
| `lesson.name` | `Lesson 2` | `Lesson 3` | no |
| `lesson.desc` | `System integration` | `Leading project meetings with customers.` | no |
| `lesson.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/09/20/17/37/client-3691435_640.j…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2015/01/09/11/08/startup-594090_640.j…` | no |
| `lesson.context` | `4696,4697,4698,4699` | `4700,4701,4702,4703,4704,4705` | no |
| `lesson.qOrder` | `ql_685,ql_593,ql_791,ql_43,ql_114,ql_345,ql_125,ql_245,ql_798,ql_642,ql_951,ql_974,ql_837,ql_346,ql_573,ql_53,ql_153,ql_…` | `ql_599,ql_856,ql_769,ql_746,ql_888,ql_633,ql_453,ql_255,ql_890,ql_709,ql_636,ql_920,ql_294,ql_154,ql_992,ql_227,ql_655,q…` | no |
| `lesson.lock` | `false` | `true` | **yes** |
| `lesson.showPreview` | `yes` | `none` | no |
| `lesson.created_at` | `2024-02-08T03:00:40.275Z` | `2024-02-08T03:33:09.574Z` | no |
| `lesson.updated_at` | `2024-11-06T07:29:11.048Z` | `2024-11-06T07:30:06.574Z` | no |
| `lesson.descTrans.0.trans` | `Tích hợp hệ thống` | `Chủ trì các cuộc họp dự án với khách hàng.` | no |
| `lesson.hideIds` | `null` | `4703,4702,4701,4700` | no |
| `lesson.lDesc` | `Let's learn some new vocabulary about system integration` | `Let's learn how to lead project meetings with customers! ` | no |
| `lesson.lDescTrans.0.trans` | `Cùng học một số từ vựng mới về tích hợp hệ thống nhé!` | `Cùng học cách dẫn dắt một cuộc họp dự án với khách hàng nào!` | no |
| `lesson.contexts.0.id` | `4696` | `4702` | no |
| `lesson.contexts.0.context` | `We need to integrate your existing system with our new platform for seamless transition.` | `Noted` | no |
| `lesson.contexts.0.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/07/10/10/06/integration-2489613_…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2015/01/08/18/30/entrepreneur-593371_…` | no |
| `lesson.contexts.0.audio` | `au/course/context/audio/4e4aaf3fee165531347b772f66b4f30c.mp3` | `au/course/context/audio/0dff0689f8816e200392753bce095b56.mp3` | no |
| `lesson.contexts.0.videoId` | `1105` | `null` | no |
| `lesson.contexts.0.cueEnd` | `18518` | `null` | no |
| `lesson.contexts.0.cueStart` | `12505` | `null` | no |
| `lesson.contexts.0.type` | `video/context` | `word/context` | no |
| `lesson.contexts.0.name` | `Integrate` | `Noted` | no |
| `lesson.contexts.0.pronun` | `ˈɪntəˌgreɪt` | `ˈnoʊtəd` | no |
| `lesson.contexts.0.wordP` | `integrate` | `Noted` | no |
| `lesson.contexts.0.def` | `Combine different parts to work together. ` | `To show that the message has been received and understood` | no |
| `lesson.contexts.0.created_at` | `2024-02-08T03:01:50.121Z` | `2024-02-08T03:59:02.747Z` | no |
| `lesson.contexts.0.updated_at` | `2024-02-08T03:01:50.121Z` | `2024-02-08T09:29:43.387Z` | no |
| `lesson.contexts.0.trans` | `["[max-depth]"]` | `null` | no |
| `lesson.contexts.1.id` | `4697` | `4700` | no |
| `lesson.contexts.1.context` | `We need to integrate your existing system with our new platform for seamless transition.` | `Let's dive straight into` | no |
| `lesson.contexts.1.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2020/11/08/06/49/semiconductor-572298…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/08/24/21/41/tartan-track-2678544…` | no |
| `lesson.contexts.1.audio` | `au/course/context/audio/5aeadc024ecf79d1f859c7acd6284764.mp3` | `au/course/context/audio/e95ebaea4852050938bcc429d95a6214.mp3` | no |
| `lesson.contexts.1.videoId` | `1105` | `null` | no |
| `lesson.contexts.1.cueEnd` | `18518` | `null` | no |
| `lesson.contexts.1.cueStart` | `12505` | `null` | no |
| `lesson.contexts.1.type` | `video/context` | `word/context` | no |
| `lesson.contexts.1.name` | `existing system` | `Let's dive straight into` | no |
| `lesson.contexts.1.pronun` | `ɪgˈzɪstɪŋ ˈsɪstəm` | `lɛts daɪv streɪt ˈɪntu` | no |
| `lesson.contexts.1.wordP` | `existing system` | `Let's dive straight into` | no |
| `lesson.contexts.1.def` | `The system that is currently in use. ` | `To start immediately` | no |
| `lesson.contexts.1.created_at` | `2024-02-08T03:02:41.142Z` | `2024-02-08T03:57:22.511Z` | no |
| `lesson.contexts.1.updated_at` | `2024-02-08T03:02:41.142Z` | `2024-02-08T03:57:22.511Z` | no |
| `lesson.contexts.2.id` | `4698` | `4703` | no |
| `lesson.contexts.2.context` | `We need to integrate your existing system with our new platform for seamless transition.` | `Lastly` | no |
| `lesson.contexts.2.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/10/25/21/39/gold-2889423_640.jpg…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pi…` | no |
| `lesson.contexts.2.audio` | `au/course/context/audio/e3d1b578aacf3da48cdb722150172a7a.mp3` | `au/course/context/audio/98fef2d55d3e4ee387a25432b10267c4.mp3` | no |
| `lesson.contexts.2.videoId` | `1105` | `null` | no |
| `lesson.contexts.2.cueEnd` | `18518` | `null` | no |
| `lesson.contexts.2.cueStart` | `12505` | `null` | no |
| `lesson.contexts.2.type` | `video/context` | `word/context` | no |
| `lesson.contexts.2.name` | `seamless transition` | `Lastly` | no |
| `lesson.contexts.2.pronun` | `ˈsimləs trænˈzɪʃən .` | `ˈlæstli` | no |
| `lesson.contexts.2.wordP` | `seamless transition.` | `Lastly` | no |
| `lesson.contexts.2.def` | `A change from one thing to another that goes very smoothly. ` | `To express the last point in a conversation` | no |
| `lesson.contexts.2.created_at` | `2024-02-08T03:03:35.917Z` | `2024-02-08T03:59:43.901Z` | no |
| `lesson.contexts.2.updated_at` | `2024-02-08T03:03:35.917Z` | `2024-02-08T03:59:43.901Z` | no |
| `lesson.contexts.3.id` | `4699` | `4705` | no |
| `lesson.contexts.3.context` | `Our teams use CRM for customer interactions, and a database for reports.` | `I'll draft a plan and I'll email it to you` | no |
| `lesson.contexts.3.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/06/07/12/28/target-group-3460039…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2016/06/25/12/52/laptop-1478822_640.j…` | no |
| `lesson.contexts.3.audio` | `au/course/context/audio/8bcc0f3c7fa84a8f92212418b2a8228f.mp3` | `au/course/context/audio/a6833435cca7f3dba9bc47682183080f.mp3` | no |
| `lesson.contexts.3.videoId` | `1105` | `null` | no |
| `lesson.contexts.3.cueEnd` | `25500` | `null` | no |
| `lesson.contexts.3.cueStart` | `19614` | `null` | no |
| `lesson.contexts.3.type` | `video/context` | `word/context` | no |
| `lesson.contexts.3.name` | `customer interactions` | `I'll draft a plan and I'll email it to you` | no |
| `lesson.contexts.3.pronun` | `ˈkʌstəmər ˌɪntəˈrækʃənz ,` | `aɪl dræft eɪ plæn ænd aɪl iˈmeɪl ɪt tu ju` | no |
| `lesson.contexts.3.wordP` | `customer interactions,` | `I'll draft a plan and I'll email it to you` | no |
| `lesson.contexts.3.def` | `The ways a business communicates with customers. ` | `To write down a plan and send it by email. ` | no |
| `lesson.contexts.3.created_at` | `2024-02-08T03:04:16.014Z` | `2024-02-08T04:01:06.200Z` | no |
| `lesson.contexts.3.updated_at` | `2024-02-08T03:04:16.014Z` | `2024-02-08T04:01:06.200Z` | no |
| `lesson.contexts.3.hidden` | `null` | `true` | no |
| `lesson.contexts.4` | _(absent)_ | `{"id":4701,"context":"Sure thing","image":"https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/…` | no |
| `lesson.contexts.5` | _(absent)_ | `{"id":4704,"context":"I'll draft a plan and I'll email it to you","image":"https://img.glotdojo.com/insecure/fit/0/0/sm/…` | no |
| `lesson.path` | `cp/course/live/37/lessons/1031/c2eb73c053754da1c8266e9f34791285ddb006af.json` | `cp/course/live/37/lessons/1032/be938897246b1d3be9418cedbfa7a2dad497d1ac.json` | no |
| `index` | `1` | `2` | no |

## Why this is an IDOR

The two components are sibling instances of the **same React component**; the swap replaces one resource identifier with another. These props read as authorization state and differ between the two siblings: `lock`.

## Evidence

This resource is reached purely through the SPA's **client-side routing** (no distinct backend request to forge): navigating to the forged URL renders the paid sibling's content in the authenticated lower-tier session.

**Oracle:** the normalized **DOM diff** (text nodes + `<img>` src + element count), with remount-noise calibration — the same comparison the pipeline's content guard uses. `test.ts` captures the reference page twice (to measure noise) and the forged URL once, masks both identifiers, and asserts the forged DOM is **inert** (≈ the reference, i.e. no paid content appeared) or the app's not-found page. It is RED while the paid content renders.

**Visual evidence only (not the criterion):** `test.ts` writes `assets/original.png`, `assets/mutated.png` and `assets/diff.png` next to this report. A screenshot is viewport-bound and asset-dependent, so it never decides the verdict.

## Reproduce

```bash
node --import tsx --test test.ts   # from this finding's folder
```

The test is **RED while the vulnerability is present** and turns green once the server/app denies the forged access. It SKIPS (neither pass nor fail) if the session is no longer authenticated, so an expired login is never mistaken for a fix.
