import { useCallback, useEffect, useMemo, useState } from "react";
import { mealLogApi, mealPlanApi, workoutLogApi, workoutPlanApi } from "../api/resources";
import {
  exerciseCatalogApi,
  foodCatalogApi,
} from "../api/resources";
import { Button, Card, Chip, EmptyState, ErrorState, Loading, Modal } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type {
  ExerciseDto,
  FoodDto,
  MealLogEntryRequest,
  MealPlanDto,
  WorkoutLogEntryRequest,
  WorkoutPlanDayDto,
} from "../types/api";
import { dayName, mealTypeName, modalityName, muscleGroupName, today } from "../utils/format";

interface WorkoutEntry {
  exerciseId: number;
  plannedSets: number;
  plannedReps: number;
  actualSets?: number;
  actualReps?: number;
  actualWeightKg?: number;
  completed: boolean;
  isExtra: boolean;
  exercise: ExerciseDto;
}

interface MealEntry {
  foodId?: number;
  customName?: string;
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isExtra: boolean;
  food?: FoodDto;
}

export default function TodayPage() {
  const toast = useToastCtx();
  const [saving, setSaving] = useState(false);
  const [exerciseModal, setExerciseModal] = useState(false);
  const [foodModal, setFoodModal] = useState(false);
  const [customMealModal, setCustomMealModal] = useState(false);

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
        mealPlanApi.today(),
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

  useEffect(() => {
    if (!data) return;

    const existing = data.workoutLog[0];
    if (existing && existing.entries.length > 0) {
      setWorkoutEntries(
        existing.entries.map((e) => ({
          exerciseId: e.exerciseId,
          plannedSets: e.plannedSets,
          plannedReps: e.plannedReps,
          actualSets: e.actualSets,
          actualReps: e.actualReps,
          actualWeightKg: e.actualWeightKg,
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
          actualWeightKg: undefined,
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
      setMealEntries(
        data.mealPlan.items.map((item) => ({
          foodId: item.foodId,
          mealType: item.mealType,
          servings: item.servings,
          calories: Math.round(item.food.calories * item.servings),
          proteinG: Math.round(item.food.proteinG * item.servings),
          carbsG: Math.round(item.food.carbsG * item.servings),
          fatG: Math.round(item.food.fatG * item.servings),
          isExtra: false,
          food: item.food,
        })),
      );
    }
  }, [data]);

  const updateWorkoutEntry = (index: number, patch: Partial<WorkoutEntry>) => {
    setWorkoutEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const updateMealEntry = (index: number, patch: Partial<MealEntry>) => {
    setMealEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const next = { ...e, ...patch };
        if (next.food && patch.servings !== undefined) {
          const ratio = next.servings;
          next.calories = Math.round(next.food.calories * ratio);
          next.proteinG = Math.round(next.food.proteinG * ratio);
          next.carbsG = Math.round(next.food.carbsG * ratio);
          next.fatG = Math.round(next.food.fatG * ratio);
        }
        return next;
      }),
    );
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await workoutLogApi.log({
        date: todayStr,
        planDayId: data?.planDay?.id,
        entries: workoutEntries.map((e) => ({
          exerciseId: e.exerciseId,
          plannedSets: e.plannedSets,
          plannedReps: e.plannedReps,
          actualSets: e.actualSets,
          actualReps: e.actualReps,
          actualWeightKg: e.actualWeightKg,
          completed: e.completed,
          isExtra: e.isExtra,
        })) satisfies WorkoutLogEntryRequest[],
      });
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
      toast.add("Registro guardado", "success");
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
        completed: false,
        isExtra: true,
        exercise,
      },
    ]);
    setExerciseModal(false);
  };

  const addFood = (food: FoodDto, mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack") => {
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

  const addCustomMeal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    setMealEntries((prev) => [
      ...prev,
      {
        customName: f.customName.value,
        mealType: f.mealType.value as MealEntry["mealType"],
        servings: 1,
        calories: Number(f.calories.value),
        proteinG: Number(f.proteinG.value),
        carbsG: Number(f.carbsG.value),
        fatG: Number(f.fatG.value),
        isExtra: true,
      },
    ]);
    setCustomMealModal(false);
    f.reset();
  };

  if (loading && !data) return <Loading message="Cargando día" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="event_busy" title="Sin datos" />;

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="hero__title">Hoy · {dayName(new Date().getDay())}</h1>
      </div>

      {data.planDay && (
        <Card title="Entrenamiento" icon="fitness_center" style={{ marginBottom: 16 }}>
          <div className="label mb-3">
            {modalityName(data.planDay.modality)} · {data.planDay.focus}
          </div>
          {workoutEntries.map((entry, index) => (
            <div key={`${entry.exerciseId}-${index}`} className="log-exercise">
              <div className="log-exercise__head">
                <div>
                  <div className="log-exercise__name">{entry.exercise.name}</div>
                  <div className="log-exercise__meta">
                    {muscleGroupName(entry.exercise.muscleGroup)} · Plan: {entry.plannedSets}x{entry.plannedReps}
                  </div>
                </div>
                <Chip
                  active={entry.completed}
                  secondary={entry.completed}
                  onClick={() => updateWorkoutEntry(index, { completed: !entry.completed })}
                >
                  {entry.completed ? "Hecho" : "Pendiente"}
                </Chip>
              </div>
              <div className="log-fields">
                <div className="log-field">
                  <span className="log-field__label">Series</span>
                  <input
                    className="log-field__input"
                    type="number"
                    value={entry.actualSets ?? ""}
                    onChange={(e) =>
                      updateWorkoutEntry(index, { actualSets: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="log-field">
                  <span className="log-field__label">Reps</span>
                  <input
                    className="log-field__input"
                    type="number"
                    value={entry.actualReps ?? ""}
                    onChange={(e) =>
                      updateWorkoutEntry(index, { actualReps: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="log-field">
                  <span className="log-field__label">Peso (kg)</span>
                  <input
                    className="log-field__input"
                    type="number"
                    step="0.25"
                    value={entry.actualWeightKg ?? ""}
                    onChange={(e) =>
                      updateWorkoutEntry(index, { actualWeightKg: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <Button variant="ghost" block onClick={() => setExerciseModal(true)}>
            Añadir ejercicio
          </Button>
        </Card>
      )}

      <Card title="Nutrición" icon="restaurant">
        <div className="grid-2 mb-4">
          <div className="stat-card stat-card--primary">
            <div className="stat-card__label">Kcal registradas</div>
            <div className="stat-card__value">{totals.calories}</div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-card__label">Proteína</div>
            <div className="stat-card__value">{totals.protein}g</div>
          </div>
        </div>

        {mealEntries.map((entry, index) => (
          <div key={`${entry.foodId ?? entry.customName}-${index}`} className="log-meal">
            <div className="log-meal__head">
              <div>
                <div className="log-meal__name">
                  {entry.food?.name ?? entry.customName ?? "Comida"}
                </div>
                <div className="log-meal__meta">
                  {mealTypeName(entry.mealType)} · {entry.calories} kcal · {entry.proteinG}g P
                </div>
              </div>
              <Chip
                active
                secondary
                onClick={() => {
                  const next = [...mealEntries];
                  next.splice(index, 1);
                  setMealEntries(next);
                }}
              >
                Quitar
              </Chip>
            </div>
            <div className="log-fields log-fields--2">
              <div className="log-field">
                <span className="log-field__label">Porciones</span>
                <input
                  className="log-field__input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={entry.servings}
                  onChange={(e) => updateMealEntry(index, { servings: Number(e.target.value) })}
                />
              </div>
              <div className="log-field">
                <span className="log-field__label">Kcal</span>
                <input
                  className="log-field__input"
                  type="number"
                  value={entry.calories}
                  onChange={(e) => updateMealEntry(index, { calories: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Button variant="ghost" onClick={() => setFoodModal(true)}>
            Añadir del catálogo
          </Button>
          <Button variant="ghost" onClick={() => setCustomMealModal(true)}>
            Añadir manual
          </Button>
        </div>
      </Card>

      <div style={{ marginTop: 20 }}>
        <Button variant="primary" block loading={saving} onClick={() => void handleSave()}>
          Guardar registro del día
        </Button>
      </div>

      <ExercisePickerModal open={exerciseModal} onClose={() => setExerciseModal(false)} onSelect={addExercise} />
      <FoodPickerModal open={foodModal} onClose={() => setFoodModal(false)} onSelect={addFood} />
      <CustomMealModal open={customMealModal} onClose={() => setCustomMealModal(false)} onSubmit={addCustomMeal} />
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

function FoodPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (f: FoodDto, mealType: MealEntry["mealType"]) => void;
}) {
  const [items, setItems] = useState<FoodDto[]>([]);
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<MealEntry["mealType"]>("Snack");
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
        onChange={(e) => setMealType(e.target.value as MealEntry["mealType"])}
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

function CustomMealModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Comida personalizada">
      <form onSubmit={onSubmit}>
        <input name="customName" className="input mb-3" placeholder="Nombre" required />
        <select name="mealType" className="select mb-3" required>
          {(["Breakfast", "Lunch", "Dinner", "Snack"] as const).map((mt) => (
            <option key={mt} value={mt}>
              {mealTypeName(mt)}
            </option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input name="calories" className="input" type="number" placeholder="Kcal" required />
          <input name="proteinG" className="input" type="number" placeholder="Proteína" required />
          <input name="carbsG" className="input" type="number" placeholder="Carbos" required />
          <input name="fatG" className="input" type="number" placeholder="Grasas" required />
        </div>
        <div className="dialog__footer">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit">Añadir</Button>
        </div>
      </form>
    </Modal>
  );
}
