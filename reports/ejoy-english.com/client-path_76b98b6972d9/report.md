# IDOR finding — ejoy-english.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `76b98b6972d97b3df108d5144325127cecce48db2903ecb3aa87807c58d2932d` |
| Site | ejoy-english.com |
| Detection | client-side routing |
| Swapped value | `1030` → `1033` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:54:51.680Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://ejoy-english.com/app/courses/37/314

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://ejoy-english.com/app/courses/37/314/1030?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1030%2Fc75f7750fc1d74111b65295559a1ee7a3bf301f3.json`
- **Forged request (the paid sibling's):** `https://ejoy-english.com/app/courses/37/314/1033?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1033%2F04e0520fbffde27b745fb03769d222a642f9ca1e.json`

The identifier `1030` was replaced with `1033`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `lesson.id` | `1030` | `1033` | no |
| `lesson.name` | `Lesson 1` | `Lesson 5` | no |
| `lesson.desc` | `Video overview` | `Keeping Things Running` | no |
| `lesson.image` | `ls/course/lesson/DALL·E 2024-02-07 16.51.43 - Logo featuring two people sitting at a table and talking, one female and o…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/07/31/11/21/people-2557396_640.j…` | no |
| `lesson.context` | `4691,4692,4693,4694,4695` | `4710,4711,4712,4713` | no |
| `lesson.qOrder` | `ql_927,ql_680,ql_576,ql_545,ql_371,ql_946,ql_263,ql_18,ql_816,ql_940,ql_900,ql_426,ql_612,ql_169,ql_708,ql_983,ql_908,ql…` | `ql_906,ql_334,ql_747,ql_436,ql_183,ql_347,ql_60,ql_128,ql_804,ql_261,ql_672,ql_44,ql_288,ql_138,ql_849,ql_811,ql_303,ql_…` | no |
| `lesson.lock` | `false` | `true` | **yes** |
| `lesson.created_at` | `2024-02-08T01:19:46.881Z` | `2024-02-08T04:21:22.290Z` | no |
| `lesson.updated_at` | `2024-11-19T07:09:05.259Z` | `2024-11-06T07:38:13.727Z` | no |
| `lesson.descTrans.0.trans` | `Hiểu nội dung chính` | `Giữ mọi thứ hoạt động` | no |
| `lesson.lDesc` | `Let’s have a quick look at the video and learn some new vocabularies. ` | `Let's learn some new vocabulary to keep things running!` | no |
| `lesson.lDescTrans.0.trans` | `Cùng xem nhanh video và học một số từ mới nhé!` | `Hãy học một số từ vựng mới để duy trì hoạt động.` | no |
| `lesson.contexts.0.id` | `4693` | `4710` | no |
| `lesson.contexts.0.context` | `Our teams use CRM for customer interactions, and a database for reports.` | `So, we'll minimize downtime but when would be the best time for updates and maintenance?` | no |
| `lesson.contexts.0.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/03/13/17/26/ecommerce-2140603_64…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2014/11/06/18/37/watch-519629_640.jpg…` | no |
| `lesson.contexts.0.audio` | `au/course/context/audio/01d3fccafdd317b776011bfd3a695ce7.mp3` | `au/course/context/audio/ebeb4fbc35353cab6933ba6f6327e113.mp3` | no |
| `lesson.contexts.0.cueEnd` | `25500` | `53143` | no |
| `lesson.contexts.0.cueStart` | `19614` | `46894` | no |
| `lesson.contexts.0.name` | `CRM` | `minimize downtime` | no |
| `lesson.contexts.0.pronun` | `CRM` | `ˈmɪnəˌmaɪz ˈdaʊnˌtaɪm` | no |
| `lesson.contexts.0.wordP` | `CRM` | `minimize downtime` | no |
| `lesson.contexts.0.def` | `Customer Relationship Management (using technology to make customers happy and grow the business). ` | `Reduce the amount of time a system is not working` | no |
| `lesson.contexts.0.created_at` | `2024-02-08T01:27:59.757Z` | `2024-02-08T06:38:30.713Z` | no |
| `lesson.contexts.0.updated_at` | `2024-02-08T01:27:59.757Z` | `2024-02-08T06:38:30.713Z` | no |
| `lesson.contexts.1.id` | `4691` | `4712` | no |
| `lesson.contexts.1.context` | `Yes, we must be GDPR compliant for our European users.` | `Will online tutorials with support for questions be enough?` | no |
| `lesson.contexts.1.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/08/07/22/15/flag-2608475_640.jpg…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2016/02/17/15/37/laptop-1205256_640.j…` | no |
| `lesson.contexts.1.audio` | `au/course/context/audio/dfa6ea1d1696cebf5f8e0722812f7bbb.mp3` | `au/course/context/audio/7833e25efa3a7514dde078702f591c71.mp3` | no |
| `lesson.contexts.1.cueEnd` | `43102` | `63257` | no |
| `lesson.contexts.1.cueStart` | `38916` | `59261` | no |
| `lesson.contexts.1.name` | `European` | `online tutorials` | no |
| `lesson.contexts.1.pronun` | `ˌjʊrəˈpiən` | `ˈɔnˌlaɪn tuˈtɔriəlz` | no |
| `lesson.contexts.1.wordP` | `European` | `online tutorials` | no |
| `lesson.contexts.1.def` | `People who come from the continent of Europe. ` | `Lessons on the Internet for learning. ` | no |
| `lesson.contexts.1.created_at` | `2024-02-08T01:23:41.002Z` | `2024-02-08T06:40:39.477Z` | no |
| `lesson.contexts.1.updated_at` | `2024-02-08T01:23:41.002Z` | `2024-02-08T06:40:39.477Z` | no |
| `lesson.contexts.2.id` | `4692` | `4713` | no |
| `lesson.contexts.2.context` | `Yes, we must be GDPR compliant for our European users.` | `Perfect, I'll monitor the system's performance closely.` | no |
| `lesson.contexts.2.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/05/08/13/56/globe-3383088_640.jp…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2015/07/17/22/43/student-849822_640.j…` | no |
| `lesson.contexts.2.audio` | `au/course/context/audio/fd02e52c6d6a94fd00f3cd3ecd43d37b.mp3` | `au/course/context/audio/08b5411f848a2581a41672a759c87380.mp3` | no |
| `lesson.contexts.2.cueEnd` | `43102` | `70967` | no |
| `lesson.contexts.2.cueStart` | `38916` | `67492` | no |
| `lesson.contexts.2.name` | `GDPR compliant ` | `monitor` | no |
| `lesson.contexts.2.pronun` | `GDPR kəmˈplaɪənt` | `ˈmɑnətər` | no |
| `lesson.contexts.2.wordP` | `GDPR compliant` | `monitor` | no |
| `lesson.contexts.2.def` | `Following the data protection rules set by the General Data Protection Regulation. ` | `Watch or check frequently for a special purpose. ` | no |
| `lesson.contexts.2.created_at` | `2024-02-08T01:25:09.605Z` | `2024-02-08T06:41:34.848Z` | no |
| `lesson.contexts.2.updated_at` | `2024-02-08T01:25:09.605Z` | `2024-02-08T06:41:34.848Z` | no |
| `lesson.contexts.3.id` | `4694` | `4711` | no |
| `lesson.contexts.3.context` | `All right. Any data privacy concerns?` | `So, we'll minimize downtime but when would be the best time for updates and maintenance?` | no |
| `lesson.contexts.3.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/02/28/15/26/man-2106040_640.jpg@…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/03/02/15/14/relaxation-3193392_6…` | no |
| `lesson.contexts.3.audio` | `au/course/context/audio/b6e050572b857fd3bc57f78f008bd207.mp3` | `au/course/context/audio/57cb773ae7a82c8c8aae12fa8f8d7abd.mp3` | no |
| `lesson.contexts.3.cueEnd` | `38916` | `53143` | no |
| `lesson.contexts.3.cueStart` | `34648` | `46894` | no |
| `lesson.contexts.3.name` | `concern` | `maintenance` | no |
| `lesson.contexts.3.pronun` | `kənˈsɜrnz ?` | `ˈmeɪntənəns ` | no |
| `lesson.contexts.3.wordP` | `concerns?` | `maintenance` | no |
| `lesson.contexts.3.def` | `Something that causes worry/ interest. ` | `Taking care of something to keep it in good condition. ` | no |
| `lesson.contexts.3.created_at` | `2024-02-08T01:28:59.651Z` | `2024-02-08T06:39:44.088Z` | no |
| `lesson.contexts.3.updated_at` | `2024-02-08T01:28:59.651Z` | `2024-02-08T09:37:27.173Z` | no |
| `lesson.contexts.4` | `{"id":4695,"context":"Europe","image":"https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/phot…` | _(absent)_ | no |
| `lesson.path` | `cp/course/live/37/lessons/1030/c75f7750fc1d74111b65295559a1ee7a3bf301f3.json` | `cp/course/live/37/lessons/1033/04e0520fbffde27b745fb03769d222a642f9ca1e.json` | no |
| `index` | `0` | `4` | no |

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
