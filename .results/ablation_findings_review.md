# Ablation findings — manual review

5 findings (ablation_vulnerabilities, current engine; vulnerabilityId aligned with the main pipeline — carriers collapsed).

## #1 app.talkpal.ai

- reference: `GET https://app.talkpal.ai/roleplays/6a6c7e8845f22156a012a010?_rsc=etjCcXFm7Jcf-nWH`
- candidate: `GET https://app.talkpal.ai/roleplays/6ad9b77b7bbb8e6b1cd7fcd6?_rsc=etjCcXFm7Jcf-nWH`
- swap: `6a6c7e8845f22156a012a010` → `6ad9b77b7bbb8e6b1cd7fcd6`
- authz keys: `['isUnlocked']`
- response body length: 6187 → 6170 bytes

| prop | reference | candidate |
|---|---|---|
| `list.0.id` | "6a6c7e8845f22156a012a010" | "6ad9b77b7bbb8e6b1cd7fcd6" |
| `list.0.title` | "Louer une voiture" | "Vous n'êtes pas paresseux : ce que cache vraiment la procrastination" |
| `list.0.coverImg` | "https://files.talkpal.ai/roleplays-mode/cover_new/renting_a_car.webp" | "https://files.talkpal.ai/podcast-covers/Youre_not_lazy_what_procrastination_is_really_telling_you.webp" |
| `list.0.coverImgBw` | "https://files.talkpal.ai/roleplays-mode/cover_new/bw/renting_a_car_bw.webp" | null |
| `list.0.name` | "Agent de location de voitures" | null |
| `list.0.aiImg` | "https://files.talkpal.ai/roleplays-mode/image_new/car_rental_agent.webp" | null |
| `list.0.category` | "Transport" | "Psychologie et comportement humain" |
| `list.0.setting` | "Chez une agence de location de voitures." | null |
| `list.0.durationMs` | null | 444840 |
| `list.0.isUnlocked` | null | false |
| `list.0.positionMs` | null | 0 |

## #2 app.talkpal.ai

- reference: `GET https://app.talkpal.ai/roleplays/6a6c7e8845f22156a012a04c?_rsc=etjCcXFm7Jcf-nWH`
- candidate: `GET https://app.talkpal.ai/roleplays/6ad9b77b7bbb8e6b1cd7fcd7?_rsc=etjCcXFm7Jcf-nWH`
- swap: `6a6c7e8845f22156a012a04c` → `6ad9b77b7bbb8e6b1cd7fcd7`
- authz keys: `['isUnlocked']`
- response body length: 0 → 6170 bytes

| prop | reference | candidate |
|---|---|---|
| `list.1.id` | "6a6c7e8845f22156a012a04c" | "6ad9b77b7bbb8e6b1cd7fcd7" |
| `list.1.title` | "Interviewer un vampire" | "Pourquoi votre cerveau s'emballe à 2 heures du matin : la science de la rumination" |
| `list.1.coverImg` | "https://files.talkpal.ai/roleplays-mode/cover_new/interviewing_a_vampire.webp" | "https://files.talkpal.ai/podcast-covers/Why_your_brain_spirals_at_2_am_the_science_of_overthinking.webp" |
| `list.1.coverImgBw` | "https://files.talkpal.ai/roleplays-mode/cover_new/bw/interviewing_a_vampire_bw.webp" | null |
| `list.1.name` | "Vampire" | null |
| `list.1.aiImg` | "https://files.talkpal.ai/roleplays-mode/image_new/vampire.webp" | null |
| `list.1.category` | "Divertissement" | "Psychologie et comportement humain" |
| `list.1.setting` | "Dans un château sombre." | null |
| `list.1.durationMs` | null | 456560 |
| `list.1.isUnlocked` | null | false |
| `list.1.positionMs` | null | 0 |

## #3 promova.com

- reference: `GET https://promova.com/my-plan/app3XAphYAQgyNJwg/73?_rsc=t7V1gVa0mp36bgNr`
- candidate: `GET https://promova.com/my-plan/app3XAphYAQgyNJwg/76?_rsc=t7V1gVa0mp36bgNr`
- swap: `73` → `76`
- authz keys: `['free']`
- response body length: 584 → 584 bytes

| prop | reference | candidate |
|---|---|---|
| `id` | 73 | 76 |
| `title` | "Single vowels: ㅏ and ㅓ" | "Basic consonants: ㄴ and ㅁ" |
| `free` | true | false |
| `image` | "https://img.api.promova.com/files/d3dr48s0bfbpdcnmqc5g.svg" | "https://img.api.promova.com/files/d3dr49c0bfbpdcnmqcbg.svg" |
| `color_code` | "#9CA8DB" | "#FFE9AE" |
| `progress.update.canvas.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |
| `progress.update.for_you.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |
| `progress.update.my_plan.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |

## #4 promova.com

- reference: `GET https://promova.com/my-plan/app3XAphYAQgyNJwg/73?_rsc=t7V1gVa0mp36bgNr`
- candidate: `GET https://promova.com/my-plan/app3XAphYAQgyNJwg/77?_rsc=t7V1gVa0mp36bgNr`
- swap: `73` → `77`
- authz keys: `['free']`
- response body length: 584 → 584 bytes

| prop | reference | candidate |
|---|---|---|
| `id` | 73 | 77 |
| `title` | "Single vowels: ㅏ and ㅓ" | "Basic consonants: ㄹ and ㅇ" |
| `free` | true | false |
| `image` | "https://img.api.promova.com/files/d3dr48s0bfbpdcnmqc5g.svg" | "https://img.api.promova.com/files/d3dr49k0bfbpdcnmqcdg.svg" |
| `color_code` | "#9CA8DB" | "#D5D8A9" |
| `progress.update.canvas.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |
| `progress.update.for_you.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |
| `progress.update.my_plan.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |

## #5 promova.com

- reference: `GET https://promova.com/my-plan/app3XAphYAQgyNJwg/73?_rsc=t7V1gVa0mp36bgNr`
- candidate: `GET https://promova.com/my-plan/app3XAphYAQgyNJwg/78?_rsc=t7V1gVa0mp36bgNr`
- swap: `73` → `78`
- authz keys: `['free']`
- response body length: 584 → 584 bytes

| prop | reference | candidate |
|---|---|---|
| `id` | 73 | 78 |
| `title` | "Single vowels: ㅏ and ㅓ" | "Single vowels: ㅡ, ㅐ, and ㅔ" |
| `free` | true | false |
| `image` | "https://img.api.promova.com/files/d3dr48s0bfbpdcnmqc5g.svg" | "https://img.api.promova.com/files/d3dr49s0bfbpdcnmqcfg.svg" |
| `color_code` | "#9CA8DB" | "#C4E3C4" |
| `progress.update.canvas.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |
| `progress.update.for_you.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |
| `progress.update.my_plan.updated_at` | "2026-11-22T13:03:14Z" | "2026-11-20T17:27:45Z" |
