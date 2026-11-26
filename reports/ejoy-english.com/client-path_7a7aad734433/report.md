# IDOR finding — ejoy-english.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `7a7aad7344339196cded2f148fcb53784aa9fbc0220aed8fb559a9113db5d695` |
| Site | ejoy-english.com |
| Detection | client-side routing |
| Swapped value | `1031` → `1035` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:54:53.542Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://ejoy-english.com/app/courses/37/314

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://ejoy-english.com/app/courses/37/314/1031?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1031%2Fc2eb73c053754da1c8266e9f34791285ddb006af.json`
- **Forged request (the paid sibling's):** `https://ejoy-english.com/app/courses/37/314/1035?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1035%2F0f7d88929ceecf8582120a36836100b1c5a57a42.json`

The identifier `1031` was replaced with `1035`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `lesson.id` | `1031` | `1035` | no |
| `lesson.name` | `Lesson 2` | `Lesson 6` | no |
| `lesson.desc` | `System integration` | `Revision` | no |
| `lesson.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/09/20/17/37/client-3691435_640.j…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2015/03/05/00/05/airplane-659687_640.…` | no |
| `lesson.context` | `4696,4697,4698,4699` | `4694,4698,4699,4710` | no |
| `lesson.qOrder` | `ql_685,ql_593,ql_791,ql_43,ql_114,ql_345,ql_125,ql_245,ql_798,ql_642,ql_951,ql_974,ql_837,ql_346,ql_573,ql_53,ql_153,ql_…` | `ql_879,ql_110,ql_891,ql_412,ql_674,ql_98,ql_85,ql_253,ql_343,ql_498,ql_68,ql_547,ql_929,ql_324,ql_593,ql_27` | no |
| `lesson.lock` | `false` | `true` | **yes** |
| `lesson.showPreview` | `yes` | `none` | no |
| `lesson.created_at` | `2024-02-08T03:00:40.275Z` | `2024-02-08T07:12:39.060Z` | no |
| `lesson.updated_at` | `2024-11-06T07:29:11.048Z` | `2024-05-17T03:53:13.434Z` | no |
| `lesson.descTrans.0.trans` | `Tích hợp hệ thống` | `Ôn tập` | no |
| `lesson.lDesc` | `Let's learn some new vocabulary about system integration` | `Let's review together what we have learnt! ` | no |
| `lesson.lDescTrans.0.trans` | `Cùng học một số từ vựng mới về tích hợp hệ thống nhé!` | `Cùng ôn tập lại những gì đã học trong bài này nào!` | no |
| `lesson.contexts.0.id` | `4696` | `4694` | no |
| `lesson.contexts.0.context` | `We need to integrate your existing system with our new platform for seamless transition.` | `All right. Any data privacy concerns?` | no |
| `lesson.contexts.0.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/07/10/10/06/integration-2489613_…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/02/28/15/26/man-2106040_640.jpg@…` | no |
| `lesson.contexts.0.audio` | `au/course/context/audio/4e4aaf3fee165531347b772f66b4f30c.mp3` | `au/course/context/audio/b6e050572b857fd3bc57f78f008bd207.mp3` | no |
| `lesson.contexts.0.cueEnd` | `18518` | `38916` | no |
| `lesson.contexts.0.cueStart` | `12505` | `34648` | no |
| `lesson.contexts.0.name` | `Integrate` | `concern` | no |
| `lesson.contexts.0.pronun` | `ˈɪntəˌgreɪt` | `kənˈsɜrnz ?` | no |
| `lesson.contexts.0.wordP` | `integrate` | `concerns?` | no |
| `lesson.contexts.0.def` | `Combine different parts to work together. ` | `Something that causes worry/ interest. ` | no |
| `lesson.contexts.0.created_at` | `2024-02-08T03:01:50.121Z` | `2024-02-08T01:28:59.651Z` | no |
| `lesson.contexts.0.updated_at` | `2024-02-08T03:01:50.121Z` | `2024-02-08T01:28:59.651Z` | no |
| `lesson.contexts.1.id` | `4697` | `4698` | no |
| `lesson.contexts.1.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2020/11/08/06/49/semiconductor-572298…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/10/25/21/39/gold-2889423_640.jpg…` | no |
| `lesson.contexts.1.audio` | `au/course/context/audio/5aeadc024ecf79d1f859c7acd6284764.mp3` | `au/course/context/audio/e3d1b578aacf3da48cdb722150172a7a.mp3` | no |
| `lesson.contexts.1.name` | `existing system` | `seamless transition` | no |
| `lesson.contexts.1.pronun` | `ɪgˈzɪstɪŋ ˈsɪstəm` | `ˈsimləs trænˈzɪʃən .` | no |
| `lesson.contexts.1.wordP` | `existing system` | `seamless transition.` | no |
| `lesson.contexts.1.def` | `The system that is currently in use. ` | `A change from one thing to another that goes very smoothly. ` | no |
| `lesson.contexts.1.created_at` | `2024-02-08T03:02:41.142Z` | `2024-02-08T03:03:35.917Z` | no |
| `lesson.contexts.1.updated_at` | `2024-02-08T03:02:41.142Z` | `2024-02-08T03:03:35.917Z` | no |
| `lesson.contexts.1.trans` | `["[max-depth]"]` | `null` | no |
| `lesson.contexts.2.id` | `4698` | `4699` | no |
| `lesson.contexts.2.context` | `We need to integrate your existing system with our new platform for seamless transition.` | `Our teams use CRM for customer interactions, and a database for reports.` | no |
| `lesson.contexts.2.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/10/25/21/39/gold-2889423_640.jpg…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/06/07/12/28/target-group-3460039…` | no |
| `lesson.contexts.2.audio` | `au/course/context/audio/e3d1b578aacf3da48cdb722150172a7a.mp3` | `au/course/context/audio/8bcc0f3c7fa84a8f92212418b2a8228f.mp3` | no |
| `lesson.contexts.2.cueEnd` | `18518` | `25500` | no |
| `lesson.contexts.2.cueStart` | `12505` | `19614` | no |
| `lesson.contexts.2.name` | `seamless transition` | `customer interactions` | no |
| `lesson.contexts.2.pronun` | `ˈsimləs trænˈzɪʃən .` | `ˈkʌstəmər ˌɪntəˈrækʃənz ,` | no |
| `lesson.contexts.2.wordP` | `seamless transition.` | `customer interactions,` | no |
| `lesson.contexts.2.def` | `A change from one thing to another that goes very smoothly. ` | `The ways a business communicates with customers. ` | no |
| `lesson.contexts.2.created_at` | `2024-02-08T03:03:35.917Z` | `2024-02-08T03:04:16.014Z` | no |
| `lesson.contexts.2.updated_at` | `2024-02-08T03:03:35.917Z` | `2024-02-08T03:04:16.014Z` | no |
| `lesson.contexts.3.id` | `4699` | `4710` | no |
| `lesson.contexts.3.context` | `Our teams use CRM for customer interactions, and a database for reports.` | `So, we'll minimize downtime but when would be the best time for updates and maintenance?` | no |
| `lesson.contexts.3.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/06/07/12/28/target-group-3460039…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2014/11/06/18/37/watch-519629_640.jpg…` | no |
| `lesson.contexts.3.audio` | `au/course/context/audio/8bcc0f3c7fa84a8f92212418b2a8228f.mp3` | `au/course/context/audio/ebeb4fbc35353cab6933ba6f6327e113.mp3` | no |
| `lesson.contexts.3.cueEnd` | `25500` | `53143` | no |
| `lesson.contexts.3.cueStart` | `19614` | `46894` | no |
| `lesson.contexts.3.name` | `customer interactions` | `minimize downtime` | no |
| `lesson.contexts.3.pronun` | `ˈkʌstəmər ˌɪntəˈrækʃənz ,` | `ˈmɪnəˌmaɪz ˈdaʊnˌtaɪm` | no |
| `lesson.contexts.3.wordP` | `customer interactions,` | `minimize downtime` | no |
| `lesson.contexts.3.def` | `The ways a business communicates with customers. ` | `Reduce the amount of time a system is not working` | no |
| `lesson.contexts.3.created_at` | `2024-02-08T03:04:16.014Z` | `2024-02-08T06:38:30.713Z` | no |
| `lesson.contexts.3.updated_at` | `2024-02-08T03:04:16.014Z` | `2024-02-08T06:38:30.713Z` | no |
| `lesson.contexts.3.trans` | `null` | `["[max-depth]"]` | no |
| `lesson.path` | `cp/course/live/37/lessons/1031/c2eb73c053754da1c8266e9f34791285ddb006af.json` | `cp/course/live/37/lessons/1035/0f7d88929ceecf8582120a36836100b1c5a57a42.json` | no |
| `index` | `1` | `5` | no |

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
