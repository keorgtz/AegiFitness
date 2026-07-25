import { useCallback, useEffect, useMemo, useState } from "react";
import {
  exerciseCatalogApi,
  foodCatalogApi,
  mealLogApi,
  mealPlanApi,
  workoutLogApi,
  workoutPlanApi,
} from "../api/resources";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ExerciseGuideModal,
  Loading,
  Modal,
  RecipeModal,
  SegmentedControl,
  Stepper,
} from "../components/ui";
import { MacroBar } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type {
  ExerciseDto,
  FoodDto,
  MealLogEntryRequest,
  MealPlanDto,
  MealPlanItemDto,
  MealType,
  Modality,
  MuscleGroup,
  WorkoutLogEntryRequest,
  WorkoutPlanDayDto,
} from "../types/api";
import { dayName, mealTypeName, modalityName, muscleGroupName, today } from "../utils/format";

// Acento por grupo muscular (tokens semánticos existentes, sin colores nuevos)
const MUSCLE_VARIANT: Record<MuscleGroup, string> = {
  Chest: "info",
  Back: "primary",
  Legs: "success",
  Shoulders: "warning",
  Biceps: "danger",
  Triceps: "accent",
  Core: "accent",
};

interface WorkoutEntry {
  exerciseId: number;
  plannedSets: number;
  plannedReps: number;
  actualSets: number;
  actualReps: number;
  actualWeightKg: number;
  completed: boolean;
  isExtra: boolean;
  exercise: ExerciseDto;
}

interface MealEntry {
  foodId?: number;
  customName?: string;
  mealType: MealType;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isExtra: boolean;
  food?: FoodDto;
  baseServings?: number;
  baseCalories?: number;
  baseProteinG?: number;
  baseCarbsG?: number;
  baseFatG?: number;
}

export default function TodayPage() {
  const toast = useToastCtx();
  const [saving, setSaving] = useState(false);
  const [mealTab, setMealTab] = useState<"recommended" | "log">("recommended");
  const [exerciseModal, setExerciseModal] = useState(false);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [foodModal, setFoodModal] = useState(false);
  const [quickMealModal, setQuickMealModal] = useState(false);
  const [guide, setGuide] = useState<ExerciseDto | null>(null);
  const [recipe, setRecipe] = useState<FoodDto | null>(null);

  const todayStr = today();

  const { data, loading, error, run } = useAsync<{
    planDay: WorkoutPlanDayDto | null;
    workoutLog: Awaited<ReturnType<typeof workoutLogApi.get>>;
    mealPlan: MealPlanDto;
    mealLog: Awaited<ReturnType<typeof mealLogApi.get>>;
  }>();

  const load = useCallback(() => {
    void run(
      Promise.all([
        workoutPlanApi.current().then((p) => {
          const day = p.days.find((d) => d.dayOfWeek === new Date().getDay());
          return day ?? null;
        }),
        workoutLogApi.get(todayStr, todayStr),
        mealPlanApi.forDate(todayStr),
        mealLogApi.get(todayStr, todayStr),
      ]).then(([planDay, workoutLog, mealPlan, mealLog]) => ({
        planDay,
        workoutLog,
        mealPlan,
        mealLog,
      })),
    );
  }, [run, todayStr]);

  useEffect(() => {
    load();
  }, [load]);

  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [planServings, setPlanServings] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!data) return;

    const existing = data.workoutLog[0];
    if (existing && existing.entries.length > 0) {
      setWorkoutEntries(
        existing.entries.map((e) => ({
          exerciseId: e.exerciseId,
          plannedSets: e.plannedSets,
          plannedReps: e.plannedReps,
          actualSets: e.actualSets ?? e.plannedSets,
          actualReps: e.actualReps ?? e.plannedReps,
          actualWeightKg: e.actualWeightKg ?? 0,
          completed: e.completed,
          isExtra: e.isExtra,
          exercise: e.exercise,
        })),
      );
    } else if (data.planDay) {
      setWorkoutEntries(
        data.planDay.items.map((item) => ({
          exerciseId: item.exerciseId,
          plannedSets: item.sets,
          plannedReps: Math.round((item.repsMin + item.repsMax) / 2),
          actualSets: item.sets,
          actualReps: Math.round((item.repsMin + item.repsMax) / 2),
          actualWeightKg: 0,
          completed: false,
          isExtra: false,
          exercise: item.exercise,
        })),
      );
    } else {
      setWorkoutEntries([]);
    }

    const existingMeal = data.mealLog[0];
    if (existingMeal && existingMeal.entries.length > 0) {
      setMealEntries(
        existingMeal.entries.map((e) => ({
          foodId: e.foodId,
          customName: e.customName,
          mealType: e.mealType,
          servings: e.servings,
          calories: e.calories,
          proteinG: e.proteinG,
          carbsG: e.carbsG,
          fatG: e.fatG,
          isExtra: e.isExtra,
          food: e.food,
        })),
      );
    } else {
      setMealEntries([]);
    }

    const servings: Record<number, number> = {};
    for (const item of data.mealPlan.items) {
      servings[item.id] = item.servings;
    }
    setPlanServings(servings);
  }, [data]);

  const updateWorkoutEntry = (index: number, patch: Partial<WorkoutEntry>) => {
    setWorkoutEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const updateMealEntry = (index: number, patch: Partial<MealEntry>) => {
    setMealEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const removeMealEntry = (index: number) => {
    setMealEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const totals = useMemo(() => {
    return mealEntries.reduce(
      (acc, e) => {
        acc.calories += e.calories;
        acc.protein += e.proteinG;
        acc.carbs += e.carbsG;
        acc.fat += e.fatG;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [mealEntries]);

  const handleSaveWorkout = async () => {
    setSaving(true);
    try {
      const res = await workoutLogApi.log({
        date: todayStr,
        planDayId: data?.planDay?.id,
        entries: workoutEntries.map((e) => ({
          exerciseId: e.exerciseId,
          plannedSets: e.plannedSets,
          plannedReps: e.plannedReps,
          actualSets: e.completed ? e.actualSets : undefined,
          actualReps: e.completed ? e.actualReps : undefined,
          actualWeightKg: e.completed && e.actualWeightKg > 0 ? e.actualWeightKg : undefined,
          completed: e.completed,
          isExtra: e.isExtra,
        })) satisfies WorkoutLogEntryRequest[],
      });
      const xp = res.totalXp;
      toast.add(xp ? `Entreno guardado · +${xp} XP` : "Entreno guardado", "success");
      load();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al guardar";
      toast.add(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeals = async () => {
    setSaving(true);
    try {
      await mealLogApi.log({
        date: todayStr,
        entries: mealEntries.map((e) => ({
          foodId: e.foodId,
          customName: e.customName,
          mealType: e.mealType,
          servings: e.servings,
          calories: e.calories,
          proteinG: e.proteinG,
          carbsG: e.carbsG,
          fatG: e.fatG,
          isExtra: e.isExtra,
        })) satisfies MealLogEntryRequest[],
      });
      toast.add("Comidas guardadas", "success");
      load();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al guardar";
      toast.add(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const addExercise = (exercise: ExerciseDto) => {
    setWorkoutEntries((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        plannedSets: 3,
        plannedReps: 10,
        actualSets: 3,
        actualReps: 10,
        actualWeightKg: 0,
        completed: false,
        isExtra: true,
        exercise,
      },
    ]);
    setExerciseModal(false);
  };

  // El plan es una recomendación: el usuario puede sustituir un ejercicio
  // por otro del mismo grupo muscular y registrar lo que realmente hizo.
  const swapExercise = (index: number, exercise: ExerciseDto) => {
    setWorkoutEntries((prev) =>
      prev.map((e, i) =>
        i === index
          ? {
              ...e,
              exerciseId: exercise.id,
              exercise,
              completed: false,
              actualSets: e.plannedSets,
              actualReps: e.plannedReps,
              actualWeightKg: 0,
            }
          : e,
      ),
    );
    setSwapIndex(null);
    toast.add(`Cambiado a ${exercise.name}`, "success");
  };

  const eatRecommended = (item: MealPlanItemDto) => {
    const servings = planServings[item.id] ?? item.servings;
    setMealEntries((prev) => [
      ...prev,
      {
        foodId: item.foodId,
        mealType: item.mealType,
        servings,
        calories: Math.round(item.food.calories * servings),
        proteinG: Math.round(item.food.proteinG * servings),
        carbsG: Math.round(item.food.carbsG * servings),
        fatG: Math.round(item.food.fatG * servings),
        isExtra: true,
        food: item.food,
      },
    ]);
    setMealTab("log");
  };

  const addFoodToLog = (food: FoodDto, mealType: MealType) => {
    setMealEntries((prev) => [
      ...prev,
      {
        foodId: food.id,
        mealType,
        servings: 1,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        isExtra: true,
        food,
      },
    ]);
    setFoodModal(false);
  };

  const addQuickMeal = (entry: {
    name: string;
    mealType: MealType;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => {
    setMealEntries((prev) => [
      ...prev,
      {
        customName: entry.name,
        mealType: entry.mealType,
        servings: 1,
        calories: entry.calories,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
        isExtra: true,
      },
    ]);
    setQuickMealModal(false);
  };

  if (loading && !data) return <Loading message="Cargando día" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="event_busy" title="Sin datos" />;

  const targets = data.mealPlan;
  const hasPlan = !!data.planDay;
  const workoutDone = workoutEntries.filter((e) => e.completed).length;

  return (
    <div className="page">
      <div className="page__header mb-4">
        <h1 className="hero__title" style={{ fontSize: "1.6rem" }}>
          Hoy · {dayName(new Date().getDay())}
        </h1>
      </div>

      <div className="today-grid">
        <div>
          <div className="section-title">
            <span>Entrenamiento</span>
            <span className="section-title__hint">
              {hasPlan
                ? `${workoutDone}/${workoutEntries.length} hechos`
                : "Día de descanso"}
            </span>
          </div>

          {!hasPlan && workoutEntries.length === 0 && (
            <EmptyState
              icon="hotel"
              title="Hoy es descanso"
              description="Puedes registrar un entreno libre si entrenaste igual."
              action={
                <Button variant="ghost" onClick={() => setExerciseModal(true)}>
                  Añadir ejercicio
                </Button>
              }
            />
          )}

          {hasPlan && (
            <div className="label mb-3">
              {modalityName(data.planDay!.modality)} · {data.planDay!.focus}
            </div>
          )}

          {workoutEntries.map((entry, index) => {
            const variant = MUSCLE_VARIANT[entry.exercise.muscleGroup];
            const planItem =
              data.planDay?.items.find((i) => i.exerciseId === entry.exerciseId) ??
              (data.planDay && index < data.planDay.items.length
                ? data.planDay.items[index]
                : undefined);
            const swapped =
              !entry.isExtra &&
              hasPlan &&
              !data.planDay!.items.some((i) => i.exerciseId === entry.exerciseId);
            return (
              <div
                key={`${entry.exerciseId}-${index}`}
                className={`exercise-card ${entry.completed ? "exercise-card--done" : ""}`}
              >
                <div className="exercise-card__head">
                  <span className={`exercise-card__index exercise-card__index--${variant}`}>
                    {index + 1}
                  </span>
                  <div className="exercise-card__heading">
                    <span className="exercise-card__name">{entry.exercise.name}</span>
                    <div className="exercise-card__tags">
                      <span className={`muscle-tag muscle-tag--${variant}`}>
                        {muscleGroupName(entry.exercise.muscleGroup)}
                      </span>
                      {entry.isExtra && <Chip small>Extra</Chip>}
                      {swapped && <Chip small>Cambiado</Chip>}
                    </div>
                  </div>
                  <div className="exercise-card__actions">
                    <button
                      type="button"
                      className="icon-action"
                      onClick={() => setSwapIndex(index)}
                      aria-label={`Cambiar ${entry.exercise.name}`}
                      title="Cambiar ejercicio"
                    >
                      <span className="icon">swap_horiz</span>
                    </button>
                    <button
                      type="button"
                      className="icon-action"
                      onClick={() => setGuide(entry.exercise)}
                      aria-label={`Guía de ${entry.exercise.name}`}
                      title="Ver guía"
                    >
                      <span className="icon">info</span>
                    </button>
                  </div>
                </div>
                <div className="exercise-card__plan">
                  <span className="icon">exercise</span>
                  <span>
                    Plan {entry.plannedSets}×{entry.plannedReps} · Descanso{" "}
                    {planItem?.restSeconds ?? 60}s · {entry.exercise.equipment}
                  </span>
                </div>
                <div className="exercise-card__row">
                  <Stepper
                    label="Series"
                    value={entry.actualSets}
                    onChange={(v) => updateWorkoutEntry(index, { actualSets: v })}
                    min={0}
                    max={20}
                    size="sm"
                  />
                  <Stepper
                    label="Reps"
                    value={entry.actualReps}
                    onChange={(v) => updateWorkoutEntry(index, { actualReps: v })}
                    min={0}
                    max={100}
                    size="sm"
                  />
                  <Stepper
                    label="Peso"
                    value={entry.actualWeightKg}
                    onChange={(v) => updateWorkoutEntry(index, { actualWeightKg: v })}
                    min={0}
                    max={500}
                    step={2.5}
                    unit="kg"
                    size="sm"
                  />
                  <button
                    type="button"
                    className={`check-btn ${entry.completed ? "check-btn--active" : ""}`}
                    onClick={() => updateWorkoutEntry(index, { completed: !entry.completed })}
                    aria-label={entry.completed ? "Marcar pendiente" : "Marcar hecho"}
                  >
                    <span className={`icon ${entry.completed ? "fill" : ""}`}>check</span>
                  </button>
                </div>
              </div>
            );
          })}

          {workoutEntries.length > 0 && (
            <>
              <Button variant="ghost" block onClick={() => setExerciseModal(true)} className="mb-3">
                Añadir ejercicio extra
              </Button>
              <Button variant="primary" block loading={saving} onClick={() => void handleSaveWorkout()}>
                Guardar entreno
              </Button>
            </>
          )}
        </div>

        <div>
          <div className="section-title">
            <span>Comidas</span>
          </div>

          <div className="mb-3">
            <SegmentedControl
              options={[
                { value: "recommended", label: "Recomendadas" },
                { value: "log", label: "Mi registro" },
              ]}
              value={mealTab}
              onChange={(v) => setMealTab(v as "recommended" | "log")}
            />
          </div>

          {mealTab === "recommended" && (
            <>
              {data.mealPlan.items.length === 0 ? (
                <EmptyState icon="no_meals" title="Sin plan" description="No hay comidas planificadas para hoy." />
              ) : (
                data.mealPlan.items.map((item) => {
                  const servings = planServings[item.id] ?? item.servings;
                  return (
                    <div key={item.id} className="meal-rec-card">
                      <div className="meal-rec-card__head">
                        <div className="meal-rec-card__name">{item.food.name}</div>
                        <Chip small>{mealTypeName(item.mealType)}</Chip>
                      </div>
                      <div className="meal-rec-card__macros">
                        <span>
                          <strong>{Math.round(item.food.calories * servings)}</strong> kcal
                        </span>
                        <span>
                          <strong>{Math.round(item.food.proteinG * servings)}</strong>g P
                        </span>
                        <span>
                          <strong>{Math.round(item.food.carbsG * servings)}</strong>g C
                        </span>
                        <span>
                          <strong>{Math.round(item.food.fatG * servings)}</strong>g G
                        </span>
                      </div>
                      <div className="meal-rec-card__row">
                        <Button size="sm" onClick={() => eatRecommended(item)}>
                          La comí
                        </Button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setRecipe(item.food)}
                          aria-label="Ver receta"
                        >
                          <span className="icon">menu_book</span>
                        </button>
                        <Stepper
                          label="Porciones"
                          value={servings}
                          onChange={(v) => setPlanServings((s) => ({ ...s, [item.id]: v }))}
                          min={0.5}
                          max={5}
                          step={0.5}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {mealTab === "log" && (
            <>
              {mealEntries.length === 0 ? (
                <EmptyState
                  icon="restaurant"
                  title="Sin registros"
                  description="Añade comidas del catálogo o una entrada rápida."
                />
              ) : (
                mealEntries.map((entry, index) => (
                  <div key={index} className="meal-entry">
                    <div className="meal-entry__head">
                      <div>
                        <div className="meal-entry__name">
                          {entry.food?.name ?? entry.customName ?? "Comida"}
                        </div>
                        <div className="meal-entry__meta">
                          {mealTypeName(entry.mealType)} · {entry.calories} kcal · {entry.proteinG}g P ·{" "}
                          {entry.carbsG}g C · {entry.fatG}g G
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => removeMealEntry(index)}
                        aria-label="Eliminar"
                      >
                        <span className="icon">delete</span>
                      </button>
                    </div>
                    <div className="meal-entry__row">
                      <span className="label">Porciones</span>
                      <Stepper
                        value={entry.servings}
                        onChange={(v) => {
                          const base = entry.baseServings ?? 1;
                          const ratio = v / base;
                          updateMealEntry(index, {
                            servings: v,
                            calories: Math.round((entry.baseCalories ?? entry.calories) * ratio * base) / base,
                            proteinG: Math.round((entry.baseProteinG ?? entry.proteinG) * ratio * base) / base,
                            carbsG: Math.round((entry.baseCarbsG ?? entry.carbsG) * ratio * base) / base,
                            fatG: Math.round((entry.baseFatG ?? entry.fatG) * ratio * base) / base,
                          });
                        }}
                        min={0.5}
                        max={5}
                        step={0.5}
                        size="sm"
                      />
                    </div>
                  </div>
                ))
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mb-4">
                <Button variant="ghost" onClick={() => setFoodModal(true)}>
                  Del catálogo
                </Button>
                <Button variant="ghost" onClick={() => setQuickMealModal(true)}>
                  Entrada rápida
                </Button>
              </div>

              <div className="card">
                <div className="card__title">
                  <span className="icon">monitoring</span>
                  Totales del día
                </div>
                <MacroBar label="Kcal" current={totals.calories} target={targets.targetCalories} unit="" color="primary" />
                <MacroBar label="Proteína" current={totals.protein} target={targets.targetProteinG} unit="g" color="success" />
                <MacroBar label="Carbos" current={totals.carbs} target={targets.targetCarbsG} unit="g" color="danger" />
                <MacroBar label="Grasas" current={totals.fat} target={targets.targetFatG} unit="g" color="primary" />
              </div>

              <Button variant="primary" block loading={saving} onClick={() => void handleSaveMeals()} className="mt-3">
                Guardar comidas
              </Button>
            </>
          )}
        </div>
      </div>

      <ExercisePickerModal open={exerciseModal} onClose={() => setExerciseModal(false)} onSelect={addExercise} />
      <ExerciseSwapModal
        entry={swapIndex !== null ? (workoutEntries[swapIndex] ?? null) : null}
        excludeIds={workoutEntries.map((e) => e.exerciseId)}
        planModality={data.planDay?.modality ?? null}
        onClose={() => setSwapIndex(null)}
        onSelect={(ex) => {
          if (swapIndex !== null) swapExercise(swapIndex, ex);
        }}
      />
      <FoodPickerModal open={foodModal} onClose={() => setFoodModal(false)} onSelect={addFoodToLog} />
      <QuickMealModal open={quickMealModal} onClose={() => setQuickMealModal(false)} onAdd={addQuickMeal} />
      <ExerciseGuideModal exercise={guide} onClose={() => setGuide(null)} />
      <RecipeModal food={recipe} onClose={() => setRecipe(null)} />
    </div>
  );
}

function ExercisePickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (e: ExerciseDto) => void;
}) {
  const [items, setItems] = useState<ExerciseDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    exerciseCatalogApi
      .search({ search, pageSize: 20 })
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [open, search]);

  return (
    <Modal open={open} onClose={onClose} title="Añadir ejercicio">
      <div className="catalog-picker__search">
        <span className="icon">search</span>
        <input
          className="input"
          placeholder="Buscar ejercicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <Loading message="Buscando..." />
      ) : (
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {items.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="catalog-picker__item"
              onClick={() => onSelect(ex)}
            >
              <div className="catalog-picker__item-title">{ex.name}</div>
              <div className="catalog-picker__item-meta">
                {muscleGroupName(ex.muscleGroup)} · {ex.equipment}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ExerciseSwapModal({
  entry,
  excludeIds,
  planModality,
  onClose,
  onSelect,
}: {
  entry: WorkoutEntry | null;
  excludeIds: number[];
  planModality: Modality | null;
  onClose: () => void;
  onSelect: (e: ExerciseDto) => void;
}) {
  const [items, setItems] = useState<ExerciseDto[]>([]);
  const [search, setSearch] = useState("");
  const [sameMuscle, setSameMuscle] = useState(true);
  const [loading, setLoading] = useState(false);

  // La modalidad del día acota el catálogo: gym ↔ gym, calistenia ↔ calistenia
  const typeFilter =
    planModality === "Gym" || planModality === "Calisthenics" ? planModality : undefined;

  useEffect(() => {
    if (!entry) return;
    setSearch("");
    setSameMuscle(true);
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    setLoading(true);
    // Excluir el ejercicio actual y los ya presentes en otras tarjetas del
    // entreno: sustituir no debe crear duplicados en la sesión.
    const excluded = new Set(excludeIds);
    exerciseCatalogApi
      .search({
        search,
        muscleGroup: sameMuscle ? entry.exercise.muscleGroup : undefined,
        type: typeFilter,
        pageSize: 20,
      })
      .then((r) => {
        // El catálogo seed tiene nombres repetidos (mismo ejercicio, otro
        // objetivo): para sustituir, una sola fila por nombre.
        const seen = new Set<string>();
        setItems(
          r.items.filter((ex) => {
            if (excluded.has(ex.id) || seen.has(ex.name)) return false;
            seen.add(ex.name);
            return true;
          }),
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, search, sameMuscle]);

  if (!entry) return null;
  const variant = MUSCLE_VARIANT[entry.exercise.muscleGroup];

  return (
    <Modal open onClose={onClose} title="Cambiar ejercicio">
      <div className="swap-modal__current">
        <span className="label">Sustituyendo</span>
        <div className="swap-modal__current-name">{entry.exercise.name}</div>
        <div className="row gap-2 mt-2" style={{ flexWrap: "wrap" }}>
          <button
            type="button"
            className={`muscle-tag muscle-tag--${variant} muscle-tag--btn ${sameMuscle ? "" : "muscle-tag--off"}`}
            onClick={() => setSameMuscle((v) => !v)}
            title={sameMuscle ? "Mostrando solo este músculo (clic para ver todos)" : "Mostrando todos los músculos"}
          >
            {muscleGroupName(entry.exercise.muscleGroup)}
          </button>
          {typeFilter && <span className="muscle-tag muscle-tag--info">{modalityName(typeFilter)}</span>}
        </div>
      </div>
      <div className="catalog-picker__search">
        <span className="icon">search</span>
        <input
          className="input"
          placeholder="Buscar sustituto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <Loading message="Buscando..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="exercise"
          title="Sin alternativas"
          description="No hay otros ejercicios con estos filtros. Desactiva el filtro de músculo para ver más."
        />
      ) : (
        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {items.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="catalog-picker__item"
              onClick={() => onSelect(ex)}
            >
              <div className="catalog-picker__item-title">{ex.name}</div>
              <div className="catalog-picker__item-meta">
                {muscleGroupName(ex.muscleGroup)} · {ex.equipment} · Nivel {ex.difficulty}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function FoodPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (f: FoodDto, mealType: MealType) => void;
}) {
  const [items, setItems] = useState<FoodDto[]>([]);
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<MealType>("Snack");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    foodCatalogApi
      .search({ search, pageSize: 20 })
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [open, search]);

  return (
    <Modal open={open} onClose={onClose} title="Añadir comida">
      <select
        className="select mb-3"
        value={mealType}
        onChange={(e) => setMealType(e.target.value as MealType)}
      >
        {(["Breakfast", "Lunch", "Dinner", "Snack"] as const).map((mt) => (
          <option key={mt} value={mt}>
            {mealTypeName(mt)}
          </option>
        ))}
      </select>
      <div className="catalog-picker__search">
        <span className="icon">search</span>
        <input
          className="input"
          placeholder="Buscar comida..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <Loading message="Buscando..." />
      ) : (
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {items.map((food) => (
            <button
              key={food.id}
              type="button"
              className="catalog-picker__item"
              onClick={() => onSelect(food, mealType)}
            >
              <div className="catalog-picker__item-title">{food.name}</div>
              <div className="catalog-picker__item-meta">
                {food.calories} kcal · {food.proteinG}g P · {mealTypeName(food.mealType)}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function QuickMealModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (entry: {
    name: string;
    mealType: MealType;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<MealType>("Snack");
  const [calories, setCalories] = useState(300);
  const [proteinG, setProteinG] = useState(0);
  const [carbsG, setCarbsG] = useState(0);
  const [fatG, setFatG] = useState(0);

  useEffect(() => {
    if (open) {
      setName("");
      setMealType("Snack");
      setCalories(300);
      setProteinG(0);
      setCarbsG(0);
      setFatG(0);
    }
  }, [open]);

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), mealType, calories, proteinG, carbsG, fatG });
  };

  return (
    <Modal open={open} onClose={onClose} title="Entrada rápida">
      <div className="input-group">
        <label className="input-group__label">Nombre</label>
        <input
          className="input"
          placeholder="Lo que comiste"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="input-group">
        <label className="input-group__label">Tipo</label>
        <select className="select" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
          {(["Breakfast", "Lunch", "Dinner", "Snack"] as const).map((mt) => (
            <option key={mt} value={mt}>
              {mealTypeName(mt)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid-2 mb-3">
        <Stepper label="Kcal" value={calories} onChange={setCalories} min={0} max={3000} step={50} />
        <Stepper label="Proteína (g)" value={proteinG} onChange={setProteinG} min={0} max={300} step={5} />
        <Stepper label="Carbos (g)" value={carbsG} onChange={setCarbsG} min={0} max={500} step={5} />
        <Stepper label="Grasas (g)" value={fatG} onChange={setFatG} min={0} max={200} step={5} />
      </div>
      <div className="dialog__footer">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!name.trim()}>
          Añadir
        </Button>
      </div>
    </Modal>
  );
}
