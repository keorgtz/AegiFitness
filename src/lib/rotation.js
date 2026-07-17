// ==========================================================
// ROTATION HELPERS
// Smart cycling logic for diets and routines:
// - avoids meals/exercises eaten/done in the last 7 days
// - cycles back to the full pool when the recent window empties
// - keeps everything scoped to the user's current objective
// ==========================================================

import mealsData from "../data/meals.json";
import exercisesData from "../data/exercises.json";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const DAY_NAMES_ES = [
	"Domingo",
	"Lunes",
	"Martes",
	"Miércoles",
	"Jueves",
	"Viernes",
	"Sábado",
];

export const WEEK_DAYS = [
	"Lunes",
	"Martes",
	"Miércoles",
	"Jueves",
	"Viernes",
	"Sábado",
	"Domingo",
];

export const EMPTY_TRAINING_SPLIT = WEEK_DAYS.reduce((acc, day) => {
	acc[day] = [];
	return acc;
}, {});

// Today's name in Spanish (e.g. "Lunes")
export const getTodayName = () => DAY_NAMES_ES[new Date().getDay()];

// ----- safe localStorage reads -----
function readJSON(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw);
		return parsed == null ? fallback : parsed;
	} catch {
		return fallback;
	}
}

function writeJSON(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* ignore quota errors */
	}
}

// ----- DIET ROTATION -----

// Returns a Set of meal IDs consumed within the last 7 days.
export function getRecentMealIds() {
	const history = readJSON("aegifitness_diet_history", []);
	if (!Array.isArray(history)) return new Set();
	const cutoff = Date.now() - SEVEN_DAYS_MS;
	return new Set(
		history
			.filter((h) => h && h.date && new Date(h.date).getTime() > cutoff)
			.map((h) => h.mealId),
	);
}

// Pick a meal for the given type + objective, avoiding recent ones.
// Falls back to the full pool of matching meals if everything was recent.
export function pickMeal(type, objective, recentMealIds) {
	const allowedObjective = (m) =>
		m.objective === objective || m.objective === "Ambos";
	const sameType = mealsData.filter(
		(m) => m.type === type && allowedObjective(m),
	);

	if (sameType.length === 0) return null;

	const fresh = sameType.filter((m) => !recentMealIds.has(m.id));
	const pool = fresh.length > 0 ? fresh : sameType;

	return pool[Math.floor(Math.random() * pool.length)];
}

// Append a record to the diet history (id + date + calories).
export function appendDietHistory({ mealId, calories }) {
	const history = readJSON("aegifitness_diet_history", []);
	history.push({
		date: new Date().toISOString(),
		mealId,
		calories: Number(calories) || 0,
	});
	writeJSON("aegifitness_diet_history", history);
}

// ----- EXERCISE ROTATION -----

// Returns a Set of exercise IDs performed within the last 7 days.
export function getRecentExerciseIds() {
	const history = readJSON("aegifitness_exercise_history", []);
	if (!Array.isArray(history)) return new Set();
	const cutoff = Date.now() - SEVEN_DAYS_MS;
	return new Set(
		history
			.filter((h) => h && h.date && new Date(h.date).getTime() > cutoff)
			.map((h) => h.exerciseId),
	);
}

// Pick N exercises for the given objective + muscle-group + type filters.
// Always tries to return `count` items by progressively relaxing preferences
// through 8 priority buckets:
//
//   Bucket 0: matches type + muscles, fresh         (best)
//   Bucket 1: matches type + muscles, recent
//   Bucket 2: matches muscles, drops type, fresh
//   Bucket 3: matches muscles, drops type, recent
//   Bucket 4: matches type,   drops muscles, fresh
//   Bucket 5: matches type,   drops muscles, recent
//   Bucket 6: matches objective only, fresh
//   Bucket 7: matches objective only, recent       (worst)
//
// We pull from the buckets in priority order, deduplicating by id, until
// we've collected `count` items. If the whole objective pool has fewer than
// `count` exercises we just return whatever exists.
export function pickExercises(
	objective,
	muscleGroups,
	prefType,
	recentIds,
	count,
) {
	const muscleArr =
		Array.isArray(muscleGroups) && muscleGroups.length > 0 ? muscleGroups : [];
	const useType = prefType && prefType !== "Ambos" ? prefType : null;

	const matchesType = (ex) => !useType || ex.type === useType;
	const matchesMuscle = (ex) =>
		muscleArr.length === 0 || muscleArr.includes(ex.muscleGroup);
	const isFresh = (ex) => !recentIds.has(ex.id);

	const buckets = [[], [], [], [], [], [], [], []];

	for (const ex of exercisesData) {
		if (ex.objective !== objective) continue;

		const t = matchesType(ex);
		const m = matchesMuscle(ex);
		const f = isFresh(ex);

		// (t, m, f) → bucket index
		if (t && m && f) buckets[0].push(ex);
		else if (t && m && !f) buckets[1].push(ex);
		else if (!t && m && f) buckets[2].push(ex);
		else if (!t && m && !f) buckets[3].push(ex);
		else if (t && !m && f) buckets[4].push(ex);
		else if (t && !m && !f) buckets[5].push(ex);
		else if (!t && !m && f) buckets[6].push(ex);
		else if (!t && !m && !f) buckets[7].push(ex);
	}

	const result = [];
	const usedIds = new Set();

	for (const bucket of buckets) {
		shuffle(bucket);
		for (const ex of bucket) {
			if (result.length >= count) break;
			if (!usedIds.has(ex.id)) {
				result.push(ex);
				usedIds.add(ex.id);
			}
		}
		if (result.length >= count) break;
	}

	return result;
}

// In-place Fisher–Yates shuffle (used by pickExercises)
function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// Persist exercises that were actually completed in a routine.
export function saveCompletedExercises(exercises) {
	if (!Array.isArray(exercises) || exercises.length === 0) return;
	const history = readJSON("aegifitness_exercise_history", []);
	const now = new Date().toISOString();
	for (const ex of exercises) {
		history.push({ date: now, exerciseId: ex.id });
	}
	writeJSON("aegifitness_exercise_history", history);
}
