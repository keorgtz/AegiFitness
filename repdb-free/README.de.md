# RepDB Free Tier — README

Danke, dass du RepDB heruntergeladen hast. Das ist das **Free Tier** des
RepDB-Übungs-Datensatzes: 400 Übungen mit WebP-Bildern im Flat-Stil
und vollständigen EN/DE/ES-Texten, kostenlos für persönliche **und
kommerzielle** Nutzung innerhalb deiner Anwendungen unter einer verständlichen
Attribution-Lizenz (siehe `LICENSE.de.md` und die Zusammenfassung unten).

## Inhalt

```
free.json          — 400 Übungen (Schema v3), vollständig EN + DE + ES
free.en.json       — einsprachige schlanke Variante (`name`/`description`/...)
free.de.json       — dasselbe, Deutsch
free.es.json       — dasselbe, Spanisch
exercise-list.json — Abdeckungs-Manifest: Slug + Name (EN/DE/ES) + Kategorie für ALLE Übungen des vollen kostenpflichtigen Datensatzes (nicht nur dieses Free Tier)
index.html         — eigenständiger Offline-Viewer: direkt im Browser öffnen (file://), kein Server nötig
images/
  flat/            — Flat-Style WebP, 512×512, gestalteter einfarbiger Hintergrund
  muscles/         — anatomische Muskeldiagramm-WebPs
  equipment/       — Equipment-Icons als WebP
upgrade-samples/   — Animations-Vorschauen in Standard-Tier-Qualität (5 loopende transparente WebP-Clips) — NUR ZUR EVALUATION, siehe die upgrade-samples-Klausel in LICENSE.md
  README.md        — Bedingungen der Beispiele: nur zur Evaluation, upgrade-samples-Klausel in LICENSE.md
README.md          — englische Version
README.de.md       — diese Datei (Deutsch)
README.es.md       — Spanisch
LICENSE.md         — Free-Tier-Attribution-Lizenz (Englisch)
LICENSE.de.md      — Deutsch
LICENSE.es.md      — Spanisch
ATTRIBUTION.md     — fertige Attribution für README, HTML oder App-Credits
```

Jede Übung kommt mit Namen, Beschreibungen, Schritt-für-Schritt-Anleitungen
und Tipps auf Englisch, Deutsch und Spanisch, plus Kategorie,
Schwierigkeitsgrad, primäre und sekundäre Muskeln, Equipment, Zielen, Tags
und einem MET-Wert für Kalorienschätzungen.

## Namensnennung (erforderlich)

Die Lizenz ist kostenlos für kommerzielle In-App-Nutzung, verlangt aber
**einen sichtbaren Link**:

> Exercise data by [RepDB](https://repdb.co)

Platziere ihn im Über/Credits-Bereich deiner App, im README deines Projekts
oder im Footer deiner Website — was am besten passt. Das ist der ganze Preis.
Siehe `LICENSE.de.md`.

## Schnellstart

### JSON — vollständig mehrsprachig

```js
const data = await fetch("/free.json").then(r => r.json());
console.log(data.exercises.length); // Übungen in diesem Free Tier
console.log(data.exercises[0].name_en, data.exercises[0].name_de);
```

### JSON — einzelne Sprache (kleiner, einfacher)

```js
const data = await fetch("/free.de.json").then(r => r.json());
console.log(data.exercises[0].name);              // "Bauchroller" — direktes Feld
console.log(data.enum_labels.category[data.exercises[0].category]); // "Kraft"
```

`enum_labels` deckt `category`, `force_type`, `mechanic`, `difficulty`,
`body_part` und `goals` ab — damit kannst du slug-basierte Felder anzeigen,
ohne eine eigene Übersetzungstabelle zu pflegen.

### Bilder

Übungsbilder sind 512×512 WebP im flachen Illustrationsstil (gestalteter
einfarbiger Hintergrund, direkt einsetzbar):

```
images/flat/bench-press-start.webp
images/flat/bench-press-peak.webp
```

Die meisten Übungen haben ein `start`-+-`peak`-Paar (Startposition und
Höhepunkt der Bewegung). **Statische Halteübungen** (Plank, Dead-Hang,
Wall-Sit, …) haben stattdessen ein einzelnes `main`-Bild:

```
images/flat/plank-main.webp
```

Hardcode das Paar nicht — das `images`-Feld jeder Übung listet genau, welche
Varianten existieren (`{"flat": ["start", "peak"]}` oder
`{"flat": ["main"]}`); baue deine Pfade daraus.

**Alias-Bilder.** Einige Übungen sind visuelle Varianten einer anderen Übung
und nutzen deren Bilder wieder, statt eigene mitzubringen. Diese tragen ein
`image_alias`-Feld — baue Bild-Dateinamen aus dem Alias-Slug, nicht aus der
`id`:

```js
const slug = ex.image_alias ?? ex.id;
const path = `images/flat/${slug}-${variant}.webp`;
```

Muskeln und Equipment werden über das `image`-Feld im JSON referenziert:

```js
const muscle = data.muscles["biceps_brachii"];
const imgPath = `images/muscles/${muscle.image}`;  // → images/muscles/biceps-brachii.webp

const equip = data.equipment["barbell"];
const imgPath = `images/equipment/${equip.image}`;  // → images/equipment/barbell.webp
```

## Snapshot & Updates

Das Free Tier ist ein **datierter Snapshot** (2026-07-04) des
RepDB-Datensatzes: die ältesten 400 Übungen zum Stichtag. Wir können
ihn von Zeit zu Zeit aktualisieren; er bleibt hinter dem kostenpflichtigen
Datensatz zurück. Wirf einen Blick in `exercise-list.json`, um zu sehen, was
der aktuelle kostenpflichtige Datensatz enthält.

## upgrade-samples/ — nur zur Evaluation

Der Ordner `upgrade-samples/` enthält fünf loopende Übungsanimationen in
**Standard-Tier-Qualität** — WebP mit transparentem Hintergrund, dieselben
Clips, die auf https://repdb.co gezeigt werden. Sie sind dafür da, dass du die
Animations-Qualität der bezahlten Tiers vor dem Kauf beurteilen kannst — sie
sind ausschließlich **zur Evaluation** lizenziert und dürfen nicht in
Produktiv-Apps verwendet oder weiterverbreitet werden (siehe die
upgrade-samples-Klausel in `LICENSE.md`). Der Standard-Tier fügt loopende
Animationen wie diese für die meisten Übungen hinzu.

## Upgrade: Free vs. Starter vs. Standard

|  | Free | Starter | Standard |
|---|---|---|---|
| Übungen | 400 (datierter Snapshot) | voller Datensatz beim Kauf | voller Datensatz beim Kauf |
| Bildauflösung | 512×512 | 1024×1024 | 1024×1024 |
| Flat-Stil | ✓ | ✓ | ✓ |
| Classic-Stil | — | ✓ weißer Hintergrund | ✓ **transparenter** Hintergrund |
| Animationen | — (5 Vorschau-Samples) | — | ✓ loopende transparente WebPs (die meisten Übungen) |
| Künftige Releases | kann einen neueren Snapshot erhalten | nur enthalten, wenn beim Kauf angegeben | nur enthalten, wenn beim Kauf angegeben |
| Lizenz | Namensnennung, In-App-Nutzung | kommerziell | kommerziell |

Aktuelle Tarife und Preise: https://repdb.co/pricing

## Schema-Überblick

JSON-Top-Level (vollständige `free.json`):
- `schema_version` — Ganzzahl, aktuell `3`.
- `generated_at` — ISO8601-UTC-Build-Zeitstempel.
- `locales` — `["de", "en", "es"]`.
- `exercises[]` — siehe unten.
- `muscles` — Lookup-Tabelle mit Übersetzungen; jeder Eintrag hat ein
  `image`-Feld. Aus `images/muscles/` ausliefern.
- `equipment` — gleiche Form, aus `images/equipment/`.

Die einsprachigen schlanken Dateien (`free.{en,de,es}.json`) ersetzen die mit
`_en/_de/_es` suffigierten Felder durch direkte
`name`/`description`/`instructions`/`tips` für die gewählte Sprache und
ergänzen oben ein `enum_labels`-Mapping.

Pro Übung:
- `id` (Slug), `name_{en,de,es}`, `description_{en,de,es}`
- `instructions_{en,de,es}` (Array von Strings)
- `tips_{en,de,es}` (Array von Strings, sofern vorhanden)
- `category`, `force_type`, `mechanic`, `difficulty`
- `equipment`, `body_part`, `primary_muscles[]`, `secondary_muscles[]`
- `goals[]`, `tags[]`, `variation_group`
- `is_unilateral`, `is_bodyweight` — boolesche Flags
- `met` — MET-Wert für Kalorienschätzungen
- `image_alias` — falls vorhanden, Bildpfade aus diesem Slug statt aus der
  `id` bauen (siehe „Alias-Bilder“ oben)
- `images` — welche Bildvarianten existieren, z. B.
  `{"flat": ["start", "peak"]}` oder `{"flat": ["main"]}` für statische
  Halteübungen

## Lizenz-Zusammenfassung

Vollständiger Text in `LICENSE.de.md` (maßgeblich: `LICENSE.md`). Kurz:

1. Kostenlos für persönliche **und kommerzielle** Nutzung innerhalb von
   Anwendungen.
2. Namensnennung erforderlich — ein sichtbarer Link „Exercise data by RepDB
   (repdb.co)“.
3. Keine Weiterverbreitung als Datensatz, Datensatz-Repo oder API — nur
   In-App-Nutzung.
4. Skalieren/Zuschneiden/Umfärben für In-App-Nutzung ist okay; hochskalierte
   oder freigestellte Ableitungen unterliegen derselben
   Weiterverbreitungs-Beschränkung.
5. Keine generative KI-Ableitung — die Bilder dürfen nicht in Image-to-Image-,
   Stiltransfer- oder Modelltraining-Pipelines verwendet werden; Ergebnisse
   gelten als abgeleitete Datensätze.
6. `upgrade-samples/` ist nur zur Evaluation — nicht für Produktiv-Nutzung.
7. Keine Gewährleistung; keine medizinische Beratung.

## Support

Fragen? support@repdb.co
