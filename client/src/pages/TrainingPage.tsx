import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exerciseCatalogApi, workoutLogApi, workoutPlanApi } from "../api/resources";
import { Button, Chip, EmptyState, ErrorState, ExerciseGuideModal, Loading, Modal, SegmentedControl, Stepper } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { ExerciseDto, MuscleGroup, WorkoutLogDto, WorkoutLogEntryRequest, WorkoutPlanDayDto } from "../types/api";
import { addDays, dayName, exerciseImageUrl, modalityName, muscleGroupName, today } from "../utils/format";

type TrainingView = "today" | "plan" | "history";
interface WorkoutEntry { exerciseId: number; plannedSets: number; plannedReps: number; actualSets: number; actualReps: number; actualWeightKg: number; completed: boolean; isExtra: boolean; exercise: ExerciseDto }
const MUSCLE_VARIANT: Record<MuscleGroup, string> = { Chest: "info", Back: "primary", Legs: "success", Shoulders: "warning", Biceps: "danger", Triceps: "accent", Core: "accent" };
const EXERCISE_TYPES = ["Gym", "Calisthenics", "Both"] as const;
const MUSCLE_GROUPS: MuscleGroup[] = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core"];
const EXERCISE_PAGE_SIZE = 24;

export default function TrainingPage() {
  const toast = useToastCtx();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<TrainingView>("today");
  const [freeSession, setFreeSession] = useState(false);
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<WorkoutPlanDayDto | null>(null);
  const [selectedLog, setSelectedLog] = useState<WorkoutLogDto | null>(null);
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
  useEffect(() => {
    if (searchParams.get("quick") !== "exercise") return;
    setView("today");
    setFreeSession(true);
    setEntries([]);
    setPicker({ open: true, replaceIndex: null });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const todayPlan = useMemo(() => data?.plan.days.find((day) => day.dayOfWeek === new Date().getDay()) ?? null, [data]);

  useEffect(() => {
    if (!data) return;
    if (freeSession) {
      setEntries([]);
      return;
    }
    const log = data.history.find((item) => item.date === date);
    if (log?.entries.length) {
      setEntries(log.entries.map((entry) => ({ exerciseId: entry.exerciseId, plannedSets: entry.plannedSets, plannedReps: entry.plannedReps, actualSets: entry.actualSets ?? entry.plannedSets, actualReps: entry.actualReps ?? entry.plannedReps, actualWeightKg: entry.actualWeightKg ?? 0, completed: entry.completed, isExtra: entry.isExtra, exercise: entry.exercise })));
    } else {
      setEntries((todayPlan?.items ?? []).map((item) => ({ exerciseId: item.exerciseId, plannedSets: item.sets, plannedReps: Math.round((item.repsMin + item.repsMax) / 2), actualSets: item.sets, actualReps: Math.round((item.repsMin + item.repsMax) / 2), actualWeightKg: 0, completed: false, isExtra: false, exercise: item.exercise })));
    }
  }, [data, date, freeSession, todayPlan]);

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
      const result = await workoutLogApi.log({ date, planDayId: freeSession ? undefined : todayPlan?.id, entries: entries.map((entry) => ({ exerciseId: entry.exerciseId, plannedSets: entry.plannedSets, plannedReps: entry.plannedReps, actualSets: entry.completed ? entry.actualSets : undefined, actualReps: entry.completed ? entry.actualReps : undefined, actualWeightKg: entry.completed && entry.actualWeightKg > 0 ? entry.actualWeightKg : undefined, completed: entry.completed, isExtra: entry.isExtra })) satisfies WorkoutLogEntryRequest[] });
      toast.add(result.totalXp ? `Entreno guardado · +${result.totalXp} XP` : "Entreno guardado", "success");
      setFreeSession(false);
      load();
    } catch (err) { toast.add(err instanceof Error ? err.message : "No se pudo guardar el entreno", "error"); }
    finally { setSaving(false); }
  };

  const startFocusedWorkout = () => {
    if (!entries.length) return;
    localStorage.setItem("aegi_active_training_v1", JSON.stringify({
      startedAt: new Date().toISOString(), current: 0, notes: "",
      exercises: entries.map((entry, index) => ({
        exercise: entry.exercise, planDayId: freeSession ? undefined : todayPlan?.id,
        isExtra: entry.isExtra || freeSession, restSeconds: todayPlan?.items[index]?.restSeconds ?? 60,
        sets: Array.from({ length: Math.max(1, entry.actualSets) }, (_, setIndex) => ({
          setNumber: setIndex + 1, plannedReps: entry.plannedReps, actualReps: entry.actualReps,
          actualWeightKg: entry.actualWeightKg, rir: 2, completed: false,
        })),
      })),
    }));
    navigate("/training/session");
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
        <div className="hero__actions"><Button onClick={() => navigate("/training/session")}><span className="icon">play_arrow</span>Iniciar entrenamiento</Button><Button variant="ghost" size="sm" onClick={() => navigate("/export?content=training")}><span className="icon">download</span>Exportar rutina</Button></div>
      </div>
      <div className="mb-4"><SegmentedControl block value={view} onChange={setView} options={[{ value: "today", label: "Hoy" }, { value: "plan", label: "Rutina" }, { value: "history", label: "Historial" }]} /></div>

      {view === "today" && <section aria-labelledby="today-workout-title">
        <div className="section-title"><span id="today-workout-title">{dayName(new Date().getDay())}</span><span className="section-title__hint">{entries.length ? `${completed}/${entries.length} completados` : "Descanso"}</span></div>
        <div className="training-mode-row">
          <div className="label">{freeSession ? "Entrenamiento libre" : todayPlan ? `${modalityName(todayPlan.modality)} · ${todayPlan.focus}` : "Día de descanso"}</div>
          {freeSession ? <Button variant="ghost" size="sm" onClick={() => setFreeSession(false)}>Volver a la rutina</Button> : <Button variant="ghost" size="sm" onClick={() => { setFreeSession(true); setEntries([]); setPicker({ open: true, replaceIndex: null }); }}>Entrenamiento libre</Button>}
        </div>
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
        {!!entries.length && <div className="training-actions"><Button variant="ghost" block onClick={() => setPicker({ open: true, replaceIndex: null })}>Añadir ejercicio extra</Button><Button variant="ghost" block loading={saving} onClick={() => void saveWorkout()}>Registro rápido</Button><Button block onClick={startFocusedWorkout}><span className="icon">play_arrow</span>Modo entrenamiento</Button></div>}
      </section>}

      {view === "plan" && <section aria-labelledby="weekly-plan-title">
        <div className="section-title"><span id="weekly-plan-title">Rutina semanal</span><Button variant="ghost" size="sm" loading={regenerating} onClick={() => void regenerate()}>Regenerar</Button></div>
        <div className="grid-2">{data.plan.days.map((day) => <button key={day.dayOfWeek} type="button" className="card card--interactive" onClick={() => setSelectedDay(day)} style={{ textAlign: "left" }}><div className="card__title"><span className="icon">{day.modality === "Rest" ? "hotel" : "fitness_center"}</span>{dayName(day.dayOfWeek)}</div><div className="label mb-2">{modalityName(day.modality)} · {day.focus || "Descanso"}</div><div className="text-muted">{day.items.length} ejercicios</div></button>)}</div>
      </section>}

      {view === "history" && <section aria-labelledby="training-history-title">
        <div className="section-title"><span id="training-history-title">Últimos 30 días</span></div>
        {!data.history.length ? <EmptyState icon="history" title="Sin entrenos registrados" description="Tu primera sesión aparecerá aquí." /> : data.history.map((log) => <button type="button" key={log.id} className="list-item list-item--button" onClick={() => setSelectedLog(log)}><div className="list-item__main"><div className="list-item__title">{log.date}</div><div className="list-item__meta">{log.entries.reduce((sum, entry) => sum + (entry.sets?.filter((set) => set.completed).length || entry.actualSets || 0), 0)} series · {log.entries.length} ejercicios</div></div><span className="icon">chevron_right</span></button>)}
      </section>}

      <ExercisePickerModal open={picker.open} title={picker.replaceIndex === null ? "Añadir ejercicio" : "Cambiar ejercicio"} onClose={() => setPicker({ open: false, replaceIndex: null })} onSelect={selectExercise} />
      <ExerciseGuideModal exercise={guide} onClose={() => setGuide(null)} />
      <Modal open={!!selectedDay} onClose={() => setSelectedDay(null)} title={selectedDay ? dayName(selectedDay.dayOfWeek) : "Rutina"}>
        {selectedDay && (selectedDay.items.length ? selectedDay.items.map((item) => <div key={item.id} className="list-item"><div className="list-item__main"><div className="list-item__title">{item.exercise.name}</div><div className="list-item__meta">{item.sets} series · {item.repsMin}-{item.repsMax} reps · {item.restSeconds}s</div></div><Button variant="ghost" size="sm" onClick={() => setGuide(item.exercise)}>Guía</Button></div>) : <EmptyState icon="hotel" title="Día de descanso" />)}
      </Modal>
      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} title={selectedLog ? `Entrenamiento · ${selectedLog.date}` : "Entrenamiento"} wide>
        {selectedLog && <div className="workout-detail"><div className="workout-detail__summary"><span><strong>{selectedLog.entries.length}</strong> ejercicios</span><span><strong>{selectedLog.entries.reduce((sum, entry) => sum + (entry.sets?.filter((set) => set.completed).length || entry.actualSets || 0), 0)}</strong> series</span><span><strong>{selectedLog.startedAt && selectedLog.finishedAt ? Math.max(1, Math.round((new Date(selectedLog.finishedAt).getTime() - new Date(selectedLog.startedAt).getTime()) / 60000)) : "—"}</strong> min</span></div>{selectedLog.entries.map((entry) => <section key={entry.id} className="workout-detail__exercise"><h3>{entry.exercise.name}</h3>{entry.sets?.length ? <div className="workout-detail__sets"><div><span>Serie</span><span>Peso</span><span>Reps</span><span>RIR</span></div>{entry.sets.map((set) => <div key={set.setNumber} className={set.completed ? "is-done" : ""}><strong>{set.setNumber}</strong><span>{set.actualWeightKg ? `${set.actualWeightKg} kg` : "—"}</span><span>{set.actualReps ?? "—"}</span><span>{set.rir ?? "—"}</span></div>)}</div> : <p className="text-muted">{entry.actualSets ?? 0} series · {entry.actualReps ?? 0} reps · {entry.actualWeightKg ?? 0} kg</p>}</section>)}{selectedLog.notes && <p className="workout-detail__notes">{selectedLog.notes}</p>}</div>}
      </Modal>
    </div>
  );
}

function ExercisePickerModal({ open, title, onClose, onSelect }: { open: boolean; title: string; onClose: () => void; onSelect: (exercise: ExerciseDto) => void }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [items, setItems] = useState<ExerciseDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalCount / EXERCISE_PAGE_SIZE));

  useEffect(() => {
    if (open) return;
    setSearch("");
    setType("");
    setMuscleGroup("");
    setPage(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    exerciseCatalogApi.search({ search, type, muscleGroup, page, pageSize: EXERCISE_PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotalCount(result.totalCount);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, search, type, muscleGroup, page]);

  return <Modal open={open} onClose={onClose} title={title} wide>
    <div className="catalog-picker__filters">
      <select className="select" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} aria-label="Filtrar por tipo de entrenamiento"><option value="">Todos los tipos</option>{EXERCISE_TYPES.map((item) => <option key={item} value={item}>{modalityName(item)}</option>)}</select>
      <select className="select" value={muscleGroup} onChange={(event) => { setMuscleGroup(event.target.value); setPage(1); }} aria-label="Filtrar por grupo muscular"><option value="">Todo el cuerpo</option>{MUSCLE_GROUPS.map((item) => <option key={item} value={item}>{muscleGroupName(item)}</option>)}</select>
    </div>
    <div className="catalog-picker__search"><span className="icon">search</span><input className="input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar cualquier ejercicio..." autoFocus /></div>
    {loading ? <Loading message="Buscando ejercicios" /> : !items.length ? <EmptyState icon="search_off" title="Sin resultados" description="Prueba quitando los filtros o cambiando la búsqueda." /> : <><div className="catalog-picker__grid">{items.map((exercise) => { const image = exerciseImageUrl(exercise); return <button key={exercise.id} type="button" className="catalog-picker__item" onClick={() => onSelect(exercise)}>{image && <img src={image} alt="" className="catalog-picker__thumb" />}<div><div className="catalog-picker__item-title">{exercise.name}</div><div className="catalog-picker__item-meta">{modalityName(exercise.type)} · {muscleGroupName(exercise.muscleGroup)} · {exercise.equipment}</div></div></button>; })}</div><div className="catalog-picker__pagination"><Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button><span className="text-muted">{totalCount} ejercicios · {page}/{totalPages}</span><Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button></div></>}
  </Modal>;
}
