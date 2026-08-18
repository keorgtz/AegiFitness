import { useCallback, useEffect, useMemo, useState } from "react";
import { exerciseCatalogApi, workoutLogApi, workoutPlanApi } from "../api/resources";
import { Button, Chip, EmptyState, ErrorState, ExerciseGuideModal, Loading, Modal, SegmentedControl, Stepper } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { ExerciseDto, MuscleGroup, WorkoutLogEntryRequest, WorkoutPlanDayDto } from "../types/api";
import { addDays, dayName, exerciseImageUrl, modalityName, muscleGroupName, today } from "../utils/format";

type TrainingView = "today" | "plan" | "history";
interface WorkoutEntry { exerciseId: number; plannedSets: number; plannedReps: number; actualSets: number; actualReps: number; actualWeightKg: number; completed: boolean; isExtra: boolean; exercise: ExerciseDto }
const MUSCLE_VARIANT: Record<MuscleGroup, string> = { Chest: "info", Back: "primary", Legs: "success", Shoulders: "warning", Biceps: "danger", Triceps: "accent", Core: "accent" };

export default function TrainingPage() {
  const toast = useToastCtx();
  const [view, setView] = useState<TrainingView>("today");
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<WorkoutPlanDayDto | null>(null);
  const [guide, setGuide] = useState<ExerciseDto | null>(null);
  const [picker, setPicker] = useState<{ open: boolean; replaceIndex: number | null }>({ open: false, replaceIndex: null });
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const date = today();
  const { data, loading, error, run } = useAsync<{ plan: Awaited<ReturnType<typeof workoutPlanApi.current>>; history: Awaited<ReturnType<typeof workoutLogApi.get>> }>();

  const load = useCallback(() => {
    void run(Promise.all([workoutPlanApi.current(), workoutLogApi.get(addDays(date, -30), date)]).then(([plan, history]) => ({ plan, history })));
  }, [date, run]);
  useEffect(() => load(), [load]);
  const todayPlan = useMemo(() => data?.plan.days.find((day) => day.dayOfWeek === new Date().getDay()) ?? null, [data]);

  useEffect(() => {
    if (!data) return;
    const log = data.history.find((item) => item.date === date);
    if (log?.entries.length) {
      setEntries(log.entries.map((entry) => ({ exerciseId: entry.exerciseId, plannedSets: entry.plannedSets, plannedReps: entry.plannedReps, actualSets: entry.actualSets ?? entry.plannedSets, actualReps: entry.actualReps ?? entry.plannedReps, actualWeightKg: entry.actualWeightKg ?? 0, completed: entry.completed, isExtra: entry.isExtra, exercise: entry.exercise })));
    } else {
      setEntries((todayPlan?.items ?? []).map((item) => ({ exerciseId: item.exerciseId, plannedSets: item.sets, plannedReps: Math.round((item.repsMin + item.repsMax) / 2), actualSets: item.sets, actualReps: Math.round((item.repsMin + item.repsMax) / 2), actualWeightKg: 0, completed: false, isExtra: false, exercise: item.exercise })));
    }
  }, [data, date, todayPlan]);

  const updateEntry = (index: number, patch: Partial<WorkoutEntry>) => setEntries((current) => current.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  const selectExercise = (exercise: ExerciseDto) => {
    if (picker.replaceIndex !== null) {
      updateEntry(picker.replaceIndex, { exerciseId: exercise.id, exercise, actualWeightKg: 0, completed: false });
      toast.add(`Cambiado a ${exercise.name}`, "success");
    } else {
      setEntries((current) => [...current, { exerciseId: exercise.id, plannedSets: 3, plannedReps: 10, actualSets: 3, actualReps: 10, actualWeightKg: 0, completed: false, isExtra: true, exercise }]);
    }
    setPicker({ open: false, replaceIndex: null });
  };

  const saveWorkout = async () => {
    setSaving(true);
    try {
      const result = await workoutLogApi.log({ date, planDayId: todayPlan?.id, entries: entries.map((entry) => ({ exerciseId: entry.exerciseId, plannedSets: entry.plannedSets, plannedReps: entry.plannedReps, actualSets: entry.completed ? entry.actualSets : undefined, actualReps: entry.completed ? entry.actualReps : undefined, actualWeightKg: entry.completed && entry.actualWeightKg > 0 ? entry.actualWeightKg : undefined, completed: entry.completed, isExtra: entry.isExtra })) satisfies WorkoutLogEntryRequest[] });
      toast.add(result.totalXp ? `Entreno guardado · +${result.totalXp} XP` : "Entreno guardado", "success");
      load();
    } catch (err) { toast.add(err instanceof Error ? err.message : "No se pudo guardar el entreno", "error"); }
    finally { setSaving(false); }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try { await workoutPlanApi.regenerate(); toast.add("Plan regenerado", "success"); load(); }
    catch (err) { toast.add(err instanceof Error ? err.message : "No se pudo regenerar el plan", "error"); }
    finally { setRegenerating(false); }
  };

  if (loading && !data) return <Loading message="Cargando entrenamiento" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="event_busy" title="Sin plan de entrenamiento" />;
  const completed = entries.filter((entry) => entry.completed).length;

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label"><span className="icon">fitness_center</span><span>Entrenar</span></div>
        <h1 className="hero__title">Tu entrenamiento, en un solo lugar</h1>
        <p className="hero__subtitle">Completa la sesión de hoy, consulta tu rutina y revisa tu historial.</p>
      </div>
      <div className="mb-4"><SegmentedControl block value={view} onChange={setView} options={[{ value: "today", label: "Hoy" }, { value: "plan", label: "Rutina" }, { value: "history", label: "Historial" }]} /></div>

      {view === "today" && <section aria-labelledby="today-workout-title">
        <div className="section-title"><span id="today-workout-title">{dayName(new Date().getDay())}</span><span className="section-title__hint">{entries.length ? `${completed}/${entries.length} completados` : "Descanso"}</span></div>
        {todayPlan && <div className="label mb-3">{modalityName(todayPlan.modality)} · {todayPlan.focus}</div>}
        {!entries.length && <EmptyState icon="hotel" title="Hoy es día de descanso" description="Si vas a entrenar, puedes crear una sesión libre." action={<Button variant="ghost" onClick={() => setPicker({ open: true, replaceIndex: null })}>Añadir ejercicio</Button>} />}
        {entries.map((entry, index) => {
          const variant = MUSCLE_VARIANT[entry.exercise.muscleGroup];
          const planItem = todayPlan?.items[index];
          return <div key={`${entry.exerciseId}-${index}`} className={`exercise-card ${entry.completed ? "exercise-card--done" : ""}`}>
            <div className="exercise-card__head">
              <span className={`exercise-card__index exercise-card__index--${variant}`}>{index + 1}</span>
              <div className="exercise-card__heading"><span className="exercise-card__name">{entry.exercise.name}</span><div className="exercise-card__tags"><span className={`muscle-tag muscle-tag--${variant}`}>{muscleGroupName(entry.exercise.muscleGroup)}</span>{entry.isExtra && <Chip small>Extra</Chip>}</div></div>
              <div className="exercise-card__actions">
                <button type="button" className="icon-action" onClick={() => setPicker({ open: true, replaceIndex: index })} aria-label={`Cambiar ${entry.exercise.name}`} title="Cambiar ejercicio"><span className="icon">swap_horiz</span></button>
                <button type="button" className="icon-action" onClick={() => setGuide(entry.exercise)} aria-label={`Guía de ${entry.exercise.name}`} title="Ver guía"><span className="icon">info</span></button>
              </div>
            </div>
            <div className="exercise-card__plan"><span className="icon">exercise</span><span>Plan {entry.plannedSets}×{entry.plannedReps} · Descanso {planItem?.restSeconds ?? 60}s · {entry.exercise.equipment}</span></div>
            <div className="exercise-card__row">
              <Stepper label="Series" value={entry.actualSets} onChange={(value) => updateEntry(index, { actualSets: value })} min={0} max={20} size="sm" />
              <Stepper label="Reps" value={entry.actualReps} onChange={(value) => updateEntry(index, { actualReps: value })} min={0} max={100} size="sm" />
              <Stepper label="Peso (kg)" value={entry.actualWeightKg} onChange={(value) => updateEntry(index, { actualWeightKg: value })} min={0} max={500} step={2.5} size="sm" />
              <button type="button" className={`check-btn ${entry.completed ? "check-btn--active" : ""}`} onClick={() => updateEntry(index, { completed: !entry.completed })} aria-label={entry.completed ? "Marcar pendiente" : "Marcar completado"}><span className={`icon ${entry.completed ? "fill" : ""}`}>check</span></button>
            </div>
          </div>;
        })}
        {!!entries.length && <div className="training-actions"><Button variant="ghost" block onClick={() => setPicker({ open: true, replaceIndex: null })}>Añadir ejercicio extra</Button><Button block loading={saving} onClick={() => void saveWorkout()}>Guardar entreno</Button></div>}
      </section>}

      {view === "plan" && <section aria-labelledby="weekly-plan-title">
        <div className="section-title"><span id="weekly-plan-title">Rutina semanal</span><Button variant="ghost" size="sm" loading={regenerating} onClick={() => void regenerate()}>Regenerar</Button></div>
        <div className="grid-2">{data.plan.days.map((day) => <button key={day.dayOfWeek} type="button" className="card card--interactive" onClick={() => setSelectedDay(day)} style={{ textAlign: "left" }}><div className="card__title"><span className="icon">{day.modality === "Rest" ? "hotel" : "fitness_center"}</span>{dayName(day.dayOfWeek)}</div><div className="label mb-2">{modalityName(day.modality)} · {day.focus || "Descanso"}</div><div className="text-muted">{day.items.length} ejercicios</div></button>)}</div>
      </section>}

      {view === "history" && <section aria-labelledby="training-history-title">
        <div className="section-title"><span id="training-history-title">Últimos 30 días</span></div>
        {!data.history.length ? <EmptyState icon="history" title="Sin entrenos registrados" description="Tu primera sesión aparecerá aquí." /> : data.history.map((log) => <div key={log.id} className="list-item"><div className="list-item__main"><div className="list-item__title">{log.date}</div><div className="list-item__meta">{log.entries.filter((entry) => entry.completed).length}/{log.entries.length} ejercicios completados</div></div>{log.totalXp ? <div className="badge badge--success">+{log.totalXp} XP</div> : null}</div>)}
      </section>}

      <ExercisePickerModal open={picker.open} title={picker.replaceIndex === null ? "Añadir ejercicio" : "Cambiar ejercicio"} onClose={() => setPicker({ open: false, replaceIndex: null })} onSelect={selectExercise} />
      <ExerciseGuideModal exercise={guide} onClose={() => setGuide(null)} />
      <Modal open={!!selectedDay} onClose={() => setSelectedDay(null)} title={selectedDay ? dayName(selectedDay.dayOfWeek) : "Rutina"}>
        {selectedDay && (selectedDay.items.length ? selectedDay.items.map((item) => <div key={item.id} className="list-item"><div className="list-item__main"><div className="list-item__title">{item.exercise.name}</div><div className="list-item__meta">{item.sets} series · {item.repsMin}-{item.repsMax} reps · {item.restSeconds}s</div></div><Button variant="ghost" size="sm" onClick={() => setGuide(item.exercise)}>Guía</Button></div>) : <EmptyState icon="hotel" title="Día de descanso" />)}
      </Modal>
    </div>
  );
}

function ExercisePickerModal({ open, title, onClose, onSelect }: { open: boolean; title: string; onClose: () => void; onSelect: (exercise: ExerciseDto) => void }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ExerciseDto[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    exerciseCatalogApi.search({ search, pageSize: 30 }).then((result) => setItems(result.items)).finally(() => setLoading(false));
  }, [open, search]);
  return <Modal open={open} onClose={onClose} title={title} wide>
    <div className="catalog-picker__search"><span className="icon">search</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ejercicio..." autoFocus /></div>
    {loading ? <Loading message="Buscando ejercicios" /> : !items.length ? <EmptyState icon="search_off" title="Sin resultados" /> : <div className="catalog-picker__grid">{items.map((exercise) => { const image = exerciseImageUrl(exercise); return <button key={exercise.id} type="button" className="catalog-picker__item" onClick={() => onSelect(exercise)}>{image && <img src={image} alt="" className="catalog-picker__thumb" />}<div><div className="catalog-picker__item-title">{exercise.name}</div><div className="catalog-picker__item-meta">{muscleGroupName(exercise.muscleGroup)} · {exercise.equipment}</div></div></button>; })}</div>}
  </Modal>;
}
