# IDOR finding — ejoy-english.com

> **Access-control issue: a lower-tier user can reach a paid / higher-privilege resource by swapping a sibling identifier.**

| Field | Value |
|---|---|
| Finding id | `e55962780ad4bd18620e32e0a6204cf2c562be9a0caebbd30d29bb5abd876a73` |
| Site | ejoy-english.com |
| Detection | client-side routing |
| Swapped value | `1030` → `1034` |
| Position | path segment, index 0 from the right |
| Recorded | 2026-11-25T08:54:45.764Z |

## Where to start

Open the crawl's entry page as the authenticated **lower-tier** user (the account that should NOT have the paid resource):

- **Entry page (seed):** https://ejoy-english.com/app/courses/37/314

This page lists the account's free and paid resources side by side; the paid sibling's preview appears here, and its identifier (swapped below) is read straight from this listing's own component state.

## Reference vs. forged resource

- **Legitimate request (yours):** `https://ejoy-english.com/app/courses/37/314/1030?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1030%2Fc75f7750fc1d74111b65295559a1ee7a3bf301f3.json`
- **Forged request (the paid sibling's):** `https://ejoy-english.com/app/courses/37/314/1034?path=cp%2Fcourse%2Flive%2F37%2Flessons%2F1034%2F44e1dc560370eaf13be6a0af312c0cab152f38cc.json`

The identifier `1030` was replaced with `1034`, taken from a sibling component instance the UI presented as paid/locked.

## Sibling component props

| Prop | Your resource | Paid sibling | Authorization-relevant |
|---|---|---|---|
| `lesson.id` | `1030` | `1034` | no |
| `lesson.name` | `Lesson 1` | `Lesson 4` | no |
| `lesson.desc` | `Video overview` | `Describing User Experience` | no |
| `lesson.image` | `ls/course/lesson/DALL·E 2024-02-07 16.51.43 - Logo featuring two people sitting at a table and talking, one female and o…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2019/09/17/18/48/computer-4484282_640…` | no |
| `lesson.context` | `4691,4692,4693,4694,4695` | `4706,4707,4708,4709` | no |
| `lesson.qOrder` | `ql_927,ql_680,ql_576,ql_545,ql_371,ql_946,ql_263,ql_18,ql_816,ql_940,ql_900,ql_426,ql_612,ql_169,ql_708,ql_983,ql_908,ql…` | `ql_851,ql_704,ql_944,ql_318,ql_752,ql_324,ql_115,ql_534,ql_791,ql_403,ql_136,ql_837,ql_699,ql_25,ql_754,ql_119,ql_70,ql_…` | no |
| `lesson.lock` | `false` | `true` | **yes** |
| `lesson.created_at` | `2024-02-08T01:19:46.881Z` | `2024-02-08T04:22:51.073Z` | no |
| `lesson.updated_at` | `2024-11-19T07:09:05.259Z` | `2024-11-06T07:35:01.382Z` | no |
| `lesson.descTrans.0.trans` | `Hiểu nội dung chính` | `Mô tả trải nghiệm người dùng` | no |
| `lesson.lDesc` | `Let’s have a quick look at the video and learn some new vocabularies. ` | `Let's learn some new vocabulary to describe user experience. ` | no |
| `lesson.lDescTrans.0.trans` | `Cùng xem nhanh video và học một số từ mới nhé!` | `Hãy cùng học một số từ vựng mới để mô tả trải nghiệm người dùng.` | no |
| `lesson.contexts.0.id` | `4693` | `4706` | no |
| `lesson.contexts.0.context` | `Our teams use CRM for customer interactions, and a database for reports.` | `What about your user experience preferences?` | no |
| `lesson.contexts.0.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/03/13/17/26/ecommerce-2140603_64…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2015/05/28/14/38/ux-787980_640.jpg@pn…` | no |
| `lesson.contexts.0.audio` | `au/course/context/audio/01d3fccafdd317b776011bfd3a695ce7.mp3` | `au/course/context/audio/80647744ffe8c67e9e970f035d68eea3.mp3` | no |
| `lesson.contexts.0.cueEnd` | `25500` | `30480` | no |
| `lesson.contexts.0.cueStart` | `19614` | `26613` | no |
| `lesson.contexts.0.name` | `CRM` | `User experience preferences` | no |
| `lesson.contexts.0.pronun` | `CRM` | `ˈjuzər ɪkˈspɪriəns ˈprɛfərənsɪz ?` | no |
| `lesson.contexts.0.wordP` | `CRM` | `user experience preferences?` | no |
| `lesson.contexts.0.def` | `Customer Relationship Management (using technology to make customers happy and grow the business). ` | `Individual choices within digital platforms to customize experiences. ` | no |
| `lesson.contexts.0.created_at` | `2024-02-08T01:27:59.757Z` | `2024-02-08T04:25:01.925Z` | no |
| `lesson.contexts.0.updated_at` | `2024-02-08T01:27:59.757Z` | `2024-02-08T04:25:01.925Z` | no |
| `lesson.contexts.1.id` | `4691` | `4707` | no |
| `lesson.contexts.1.context` | `Yes, we must be GDPR compliant for our European users.` | `Would prefer straightforward interfaces.` | no |
| `lesson.contexts.1.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/08/07/22/15/flag-2608475_640.jpg…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2019/11/08/07/50/away-4610699_640.jpg…` | no |
| `lesson.contexts.1.audio` | `au/course/context/audio/dfa6ea1d1696cebf5f8e0722812f7bbb.mp3` | `au/course/context/audio/a9e05168a9c0f8d8adc381f020de6578.mp3` | no |
| `lesson.contexts.1.cueEnd` | `43102` | `32769` | no |
| `lesson.contexts.1.cueStart` | `38916` | `30480` | no |
| `lesson.contexts.1.name` | `European` | `straightforward interfaces` | no |
| `lesson.contexts.1.pronun` | `ˌjʊrəˈpiən` | `ˈstreɪtˈfɔrwərd ˈɪntərˌfeɪsɪz .` | no |
| `lesson.contexts.1.wordP` | `European` | `straightforward interfaces.` | no |
| `lesson.contexts.1.def` | `People who come from the continent of Europe. ` | `An easy to use design ` | no |
| `lesson.contexts.1.created_at` | `2024-02-08T01:23:41.002Z` | `2024-02-08T04:26:39.550Z` | no |
| `lesson.contexts.1.updated_at` | `2024-02-08T01:23:41.002Z` | `2024-02-08T04:26:39.550Z` | no |
| `lesson.contexts.2.id` | `4692` | `4708` | no |
| `lesson.contexts.2.context` | `Yes, we must be GDPR compliant for our European users.` | `Simplicity is key.` | no |
| `lesson.contexts.2.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2018/05/08/13/56/globe-3383088_640.jp…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2016/10/21/14/50/autumn-1758194_640.j…` | no |
| `lesson.contexts.2.audio` | `au/course/context/audio/fd02e52c6d6a94fd00f3cd3ecd43d37b.mp3` | `au/course/context/audio/8aeb7b259af6f0b5847801df3da13234.mp3` | no |
| `lesson.contexts.2.cueEnd` | `43102` | `34648` | no |
| `lesson.contexts.2.cueStart` | `38916` | `32769` | no |
| `lesson.contexts.2.name` | `GDPR compliant ` | `Simplicity is key.` | no |
| `lesson.contexts.2.pronun` | `GDPR kəmˈplaɪənt` | `sɪmˈplɪsəti ɪz ki .` | no |
| `lesson.contexts.2.wordP` | `GDPR compliant` | `Simplicity is key.` | no |
| `lesson.contexts.2.def` | `Following the data protection rules set by the General Data Protection Regulation. ` | `Keeping things simple and easy is important. ` | no |
| `lesson.contexts.2.created_at` | `2024-02-08T01:25:09.605Z` | `2024-02-08T04:27:19.061Z` | no |
| `lesson.contexts.2.updated_at` | `2024-02-08T01:25:09.605Z` | `2024-02-08T09:34:32.664Z` | no |
| `lesson.contexts.3.id` | `4694` | `4709` | no |
| `lesson.contexts.3.context` | `All right. Any data privacy concerns?` | `The app was updated to enhance the user experience.` | no |
| `lesson.contexts.3.image` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/02/28/15/26/man-2106040_640.jpg@…` | `https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/photo/2017/11/12/22/50/exhibition-2944064_6…` | no |
| `lesson.contexts.3.audio` | `au/course/context/audio/b6e050572b857fd3bc57f78f008bd207.mp3` | `au/course/context/audio/4e73a9af39dd811fff97621b778753eb.mp3` | no |
| `lesson.contexts.3.videoId` | `1105` | `null` | no |
| `lesson.contexts.3.cueEnd` | `38916` | `null` | no |
| `lesson.contexts.3.cueStart` | `34648` | `null` | no |
| `lesson.contexts.3.type` | `video/context` | `word/context` | no |
| `lesson.contexts.3.name` | `concern` | `User experience` | no |
| `lesson.contexts.3.pronun` | `kənˈsɜrnz ?` | `ˈjuzər ɪkˈspɪriəns .` | no |
| `lesson.contexts.3.wordP` | `concerns?` | `user experience.` | no |
| `lesson.contexts.3.def` | `Something that causes worry/ interest. ` | `The process design teams use to create products that provide meaningful and relevant experiences to users.` | no |
| `lesson.contexts.3.created_at` | `2024-02-08T01:28:59.651Z` | `2024-02-08T04:29:17.323Z` | no |
| `lesson.contexts.3.updated_at` | `2024-02-08T01:28:59.651Z` | `2024-02-08T09:35:05.039Z` | no |
| `lesson.contexts.4` | `{"id":4695,"context":"Europe","image":"https://img.glotdojo.com/insecure/fit/0/0/sm/1/plain/https://cdn.pixabay.com/phot…` | _(absent)_ | no |
| `lesson.path` | `cp/course/live/37/lessons/1030/c75f7750fc1d74111b65295559a1ee7a3bf301f3.json` | `cp/course/live/37/lessons/1034/44e1dc560370eaf13be6a0af312c0cab152f38cc.json` | no |
| `index` | `0` | `3` | no |

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
