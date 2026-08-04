// Transforma repdb-free/free.es.json → server/AegiFitness.Api/Data/Seed/exercises.seed.json
// Mapea los 400 ejercicios RepDB (ES) al contrato del seed de AegiFitness,
// incluyendo slug/variantes de imagen para la guía visual.
// Valida contra los WebP reales en repdb-free/images/flat: si el slug no
// tiene archivos, intenta un fallback conocido y si no, deja sin imagen.
// Uso: node scripts/transform-repdb.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const ROOT = "C:/Users/kevin/KeorSoft/Development/Web/AegiFitness";
const SRC = `${ROOT}/repdb-free/free.es.json`;
const IMAGES = `${ROOT}/repdb-free/images/flat`;
const OUT = `${ROOT}/server/AegiFitness.Api/Data/Seed/exercises.seed.json`;

const data = JSON.parse(readFileSync(SRC, "utf8"));
const muscles = data.muscles;
const equipment = data.equipment;

// Archivos WebP realmente disponibles (el free tier no incluye todos)
const files = new Set(readdirSync(IMAGES));
const hasImage = (slug, variant) => files.has(`${slug}-${variant}.webp`);

// Slugs sin imágenes en el free tier → movimiento base con imágenes equivalentes
const FALLBACK_SLUG = {
  "barbell-lunge": "barbell-reverse-lunge",
  "pause-deadlift": "deadlift",
  "pause-squat": "squat",
  "paused-incline-bench-press": "incline-bench-press",
};

// Resuelve slug + variantes verificando archivos; null si no hay imagen real
function resolveImages(ex) {
  const wanted = (ex.images?.flat ?? []).filter(Boolean);
  const candidates = [ex.image_alias ?? ex.id, FALLBACK_SLUG[ex.image_alias ?? ex.id]].filter(Boolean);
  for (const slug of candidates) {
    const variants = wanted.filter((v) => hasImage(slug, v));
    if (variants.length > 0) return { imageSlug: slug, imageVariants: variants.join(",") };
  }
  return { imageSlug: null, imageVariants: null };
}

const muscleName = (slug) => muscles[slug]?.name ?? slug.replaceAll("_", " ");
const muscleRegion = (slug) => muscles[slug]?.region;
const equipmentName = (slug) => {
  if (!slug) return "Sin equipo";
  return (
    equipment[slug]?.name ?? slug.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())
  );
};

// Equipamiento que en la app cuenta como calistenia aunque use accesorio
const CALISTHENICS_EQUIPMENT = new Set([
  "bodyweight",
  "pull_up_bar",
  "dip_bar",
  "dip_station",
  "parallettes",
  "gymnastic_rings",
  "suspension_trainer",
  "resistance_band",
]);

function mapMuscleGroup(ex) {
  const bp = ex.body_part;
  if (bp === "chest") return "Chest";
  if (bp === "back") return "Back";
  if (bp === "shoulders") return "Shoulders";
  if (bp === "core") return "Core";
  if (bp === "upper_legs" || bp === "lower_legs") return "Legs";
  if (bp === "lower_arms") return "Biceps";
  if (bp === "upper_arms") return armGroup(ex.primary_muscles);
  if (bp === "full_body") {
    const region = muscleRegion(ex.primary_muscles[0]);
    if (region === "upper_arms") return armGroup(ex.primary_muscles);
    return (
      { chest: "Chest", back: "Back", shoulders: "Shoulders", core: "Core", upper_legs: "Legs", lower_legs: "Legs" }[region] ?? "Core"
    );
  }
  return "Core";
}

function armGroup(primaryMuscles) {
  const joined = primaryMuscles.join(" ");
  if (joined.includes("triceps")) return "Triceps";
  return "Biceps";
}

function mapType(ex) {
  if (ex.is_bodyweight) return "Calisthenics";
  if (CALISTHENICS_EQUIPMENT.has(ex.equipment)) return "Calisthenics";
  return "Gym";
}

function mapObjective(ex) {
  if (ex.category === "cardio" || ex.category === "stretching") return "Both";
  const g = new Set(ex.goals);
  const anabolic = g.has("hypertrophy") || g.has("strength") || g.has("power");
  const endurance = g.has("endurance") || g.has("mobility") || g.has("rehabilitation");
  if (anabolic && endurance) return "Both";
  if (anabolic) return "Bulk";
  if (endurance) return "Cut";
  return "Both";
}

const DIFFICULTY = { beginner: 1, intermediate: 2, advanced: 3 };

const seen = new Set();
const out = [];
for (const ex of data.exercises) {
  const name = ex.name.trim();
  if (seen.has(name.toLowerCase())) continue; // dedupe defensivo por nombre
  seen.add(name.toLowerCase());

  const primary = (ex.primary_muscles ?? []).map(muscleName);
  const secondary = (ex.secondary_muscles ?? []).map(muscleName);
  const target =
    primary.join(", ") + (secondary.length ? ` · Secundario: ${secondary.join(", ")}` : "");
  const tips = (ex.tips ?? []).map((t) => `• ${t}`).join("\n");
  const goalLabels = ex.goals.map((g) => data.enum_labels?.goals?.[g] ?? g).join(", ");

  out.push({
    name,
    muscleGroup: mapMuscleGroup(ex),
    type: mapType(ex),
    objective: mapObjective(ex),
    difficulty: DIFFICULTY[ex.difficulty] ?? 2,
    equipment: equipmentName(ex.equipment),
    description: ex.description,
    instructions: ex.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    target,
    effect: tips || `Objetivos: ${goalLabels}`,
    ...resolveImages(ex),
  });
}

writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");

// Estadísticas para validar cobertura del generador de planes
const byType = {};
const byMuscleType = {};
for (const e of out) {
  byType[e.type] = (byType[e.type] ?? 0) + 1;
  const key = `${e.type}/${e.muscleGroup}`;
  byMuscleType[key] = (byMuscleType[key] ?? 0) + 1;
}
console.log(`ejercicios escritos: ${out.length} → ${OUT}`);
console.log("por tipo:", byType);
const noImage = out.filter((e) => !e.imageSlug);
const fallback = out.filter((e) => e.imageSlug && Object.values(FALLBACK_SLUG).includes(e.imageSlug));
console.log(`sin imagen: ${noImage.length}`, noImage.map((e) => e.name));
console.log("por tipo/músculo:");
for (const [k, v] of Object.entries(byMuscleType).sort()) console.log(`  ${k}: ${v}`);
