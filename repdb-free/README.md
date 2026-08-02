# RepDB Free Tier — README

Thanks for downloading RepDB. This is the **free tier** of the RepDB exercise
dataset: 400 exercises with flat-style WebP images and full EN/DE/ES
texts, free for personal **and commercial** use inside your applications under
a plain-language attribution license (see `LICENSE.md` and the summary below).

## Contents

```
free.json          — 400 exercises (schema v3), full EN + DE + ES
free.en.json       — single-locale slim view (bare `name`/`description`/...)
free.de.json       — same, German
free.es.json       — same, Spanish
exercise-list.json — coverage manifest: slug + name (EN/DE/ES) + category for ALL exercises in the full paid dataset (not just this free tier)
index.html         — self-contained offline viewer: open it directly in a browser (file://), no server needed
images/
  flat/            — flat-style WebP, 512×512, designed solid background
  muscles/         — anatomical muscle diagram WebP
  equipment/       — equipment icon WebP
upgrade-samples/   — Standard-tier animation previews (5 looping transparent WebP clips) — EVALUATION ONLY, see the upgrade-samples clause in LICENSE.md
  README.md        — sample terms: evaluation-only, upgrade-samples clause in LICENSE.md
README.md          — this file (English)
README.de.md       — German
README.es.md       — Spanish
LICENSE.md         — free-tier attribution license (English)
LICENSE.de.md      — German
LICENSE.es.md      — Spanish
ATTRIBUTION.md     — copy-paste attribution for README, HTML, or app credits
```

Each exercise ships with names, descriptions, step-by-step instructions and
tips in English, German and Spanish, plus category, difficulty, primary and
secondary muscles, equipment, goals, tags and a MET value for calorie
estimates.

## Attribution (required)

The license is free for commercial in-app use, but it requires **one visible
link**:

> Exercise data by [RepDB](https://repdb.co)

Put it in your app's about/credits screen, your project's README, or your
website footer — whichever fits. That's the whole price. See `LICENSE.md`.
Ready-to-paste Markdown, HTML, and plain-text versions are in
`ATTRIBUTION.md`.

## Quickstart

### JSON — full multilingual

```js
const data = await fetch("/free.json").then(r => r.json());
console.log(data.exercises.length); // exercises in this free tier
console.log(data.exercises[0].name_en, data.exercises[0].name_de);
```

### JSON — single locale (smaller, simpler)

```js
const data = await fetch("/free.de.json").then(r => r.json());
console.log(data.exercises[0].name);              // "Bauchroller" — bare field
console.log(data.enum_labels.category[data.exercises[0].category]); // "Kraft"
```

`enum_labels` covers `category`, `force_type`, `mechanic`, `difficulty`,
`body_part`, and `goals` so you can render slug-valued fields without a
hand-written translation table.

### Images

Exercise images are 512×512 WebP in the flat illustration style (designed
solid background, ready to use as-is):

```
images/flat/bench-press-start.webp
images/flat/bench-press-peak.webp
```

Most exercises have a `start` + `peak` pair (start position and peak of the
movement). **Static holds** (plank, dead-hang, wall-sit, …) have a single
`main` image instead:

```
images/flat/plank-main.webp
```

Don't hardcode the pair — each exercise's `images` field lists exactly which
variants exist (`{"flat": ["start", "peak"]}` or `{"flat": ["main"]}`), so
build your paths from it.

**Aliased images.** A few exercises are visual variants of another exercise
and reuse its images instead of shipping their own. These carry an
`image_alias` field — build image filenames from the alias slug, not the `id`:

```js
const slug = ex.image_alias ?? ex.id;
const path = `images/flat/${slug}-${variant}.webp`;
```

Muscles and equipment are referenced by their `image` field in the JSON:

```js
const muscle = data.muscles["biceps_brachii"];
const imgPath = `images/muscles/${muscle.image}`;  // → images/muscles/biceps-brachii.webp

const equip = data.equipment["barbell"];
const imgPath = `images/equipment/${equip.image}`;  // → images/equipment/barbell.webp
```

## Snapshot & updates

The free tier is a **dated snapshot** (2026-07-04) of the RepDB dataset:
the oldest 400 exercises at the cut-off date. We may refresh it from
time to time. It remains behind the paid dataset. Check `exercise-list.json`
to see what the current paid dataset contains.

## upgrade-samples/ — evaluation only

The `upgrade-samples/` folder contains five **Standard-tier** looping exercise
animations — transparent-background WebP, the same clips shown on
https://repdb.co. They are there so you can judge the paid-tier animation
quality before buying — they are licensed for **evaluation only** and may not
be used in production apps or redistributed (see the upgrade-samples clause in
`LICENSE.md`). The Standard tier adds looping animations like these for most
exercises.

## Upgrade: Free vs Starter vs Standard

|  | Free | Starter | Standard |
|---|---|---|---|
| Exercises | 400 (dated snapshot) | full dataset at purchase | full dataset at purchase |
| Image resolution | 512×512 | 1024×1024 | 1024×1024 |
| Flat style | ✓ | ✓ | ✓ |
| Classic style | — | ✓ white background | ✓ **transparent** background |
| Animations | — (5 preview samples) | — | ✓ looping transparent WebP (most exercises) |
| Future releases | may receive a newer snapshot | not included unless stated at purchase | not included unless stated at purchase |
| License | attribution, in-app use | commercial | commercial |

Current tiers and pricing: https://repdb.co/pricing

## Schema at a glance

Top-level JSON (full `free.json`):
- `schema_version` — integer, currently `3`.
- `generated_at` — ISO8601 UTC build timestamp.
- `locales` — `["de", "en", "es"]`.
- `exercises[]` — see below.
- `muscles` — lookup table with translations; each entry has an `image`
  filename. Serve from `images/muscles/`.
- `equipment` — same shape, served from `images/equipment/`.

Per-locale slim JSON (`free.{en,de,es}.json`) replaces `_en/_de/_es` suffixed
fields with bare `name`/`description`/`instructions`/`tips` for the chosen
locale, and adds an `enum_labels` map at the top level.

Per exercise:
- `id` (slug), `name_{en,de,es}`, `description_{en,de,es}`
- `instructions_{en,de,es}` (array of strings)
- `tips_{en,de,es}` (array of strings, where available)
- `category`, `force_type`, `mechanic`, `difficulty`
- `equipment`, `body_part`, `primary_muscles[]`, `secondary_muscles[]`
- `goals[]`, `tags[]`, `variation_group`
- `is_unilateral`, `is_bodyweight` — boolean flags
- `met` — MET value for calorie estimates
- `image_alias` — when present, build image paths from this slug instead of
  `id` (see "Aliased images" above)
- `images` — which image variants exist, e.g. `{"flat": ["start", "peak"]}`
  or `{"flat": ["main"]}` for static holds

## License summary

See `LICENSE.md` for the full text. In short:

1. Free for personal **and commercial** use inside applications.
2. Attribution required — a visible "Exercise data by RepDB (repdb.co)" link.
3. No redistribution as a dataset, dataset repo, or API — in-app use only.
4. Resize/crop/recolor for in-app use is fine; upscaled or bg-removed
   derivatives fall under the same no-redistribution rule.
5. No generative-AI derivation — the images may not be fed to image-to-image,
   style-transfer, or model-training pipelines; outputs count as derived datasets.
6. `upgrade-samples/` is evaluation-only — not for production use.
7. No warranty; not medical advice.

## Support

Questions? support@repdb.co
