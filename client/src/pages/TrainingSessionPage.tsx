import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { workoutLogApi, workoutPlanApi } from "../api/resources";
import { Button, EmptyState, ErrorState, Loading } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { ExerciseDto, WorkoutSetRequest } from "../types/api";
import { today } from "../utils/format";

interface SessionExercise { exercise: ExerciseDto; planDayId?: string; isExtra: boolean; restSeconds: number; sets: WorkoutSetRequest[] }
interface SavedSession { startedAt: string; current: number; notes: string; exercises: SessionExercise[] }
const STORAGE_KEY = "aegi_active_training_v1";

const secondsLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function TrainingSessionPage() {
  const navigate = useNavigate(); const toast = useToastCtx();
  const [session, setSession] = useState<SavedSession | null>(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SavedSession | null; } catch { return null; } });
  const [elapsed, setElapsed] = useState(0); const [rest, setRest] = useState(0); const [saving, setSaving] = useState(false);
  const { data: plan, loading, error, run } = useAsync<Awaited<ReturnType<typeof workoutPlanApi.current>>>();
  const load = useCallback(() => void run(workoutPlanApi.current()), [run]);
  useEffect(() => { if (!session) load(); }, [load, session]);
  useEffect(() => { if (!session) return; localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }, [session]);
  useEffect(() => { if (!session) return; const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))); tick(); const id = window.setInterval(tick, 1000); return () => clearInterval(id); }, [session?.startedAt]);
  useEffect(() => { if (rest <= 0) return; const id = window.setInterval(() => setRest((value) => { if (value <= 1) { if ("vibrate" in navigator) navigator.vibrate([180, 100, 180]); toast.add("Descanso terminado", "success"); return 0; } return value - 1; }), 1000); return () => clearInterval(id); }, [rest, toast]);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (!session) return; event.preventDefault(); }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [session]);

  const start = () => {
    const day = plan?.days.find((item) => item.dayOfWeek === new Date().getDay());
    if (!day?.items.length) return;
    setSession({ startedAt: new Date().toISOString(), current: 0, notes: "", exercises: day.items.map((item) => ({ exercise: item.exercise, planDayId: day.id as unknown as string, isExtra: false, restSeconds: item.restSeconds, sets: Array.from({ length: item.sets }, (_, index) => ({ setNumber: index + 1, plannedReps: Math.round((item.repsMin + item.repsMax) / 2), actualReps: Math.round((item.repsMin + item.repsMax) / 2), actualWeightKg: 0, rir: 2, completed: false })) })) });
  };
  const updateSet = (setIndex: number, patch: Partial<WorkoutSetRequest>) => setSession((current) => current && ({ ...current, exercises: current.exercises.map((exercise, index) => index === current.current ? { ...exercise, sets: exercise.sets.map((set, i) => i === setIndex ? { ...set, ...patch } : set) } : exercise) }));
  const completeSet = (setIndex: number) => { if (!session) return; const currentExercise = session.exercises[session.current]; const set = currentExercise?.sets[setIndex]; if (!currentExercise || !set) return; updateSet(setIndex, { completed: !set.completed, completedAt: !set.completed ? new Date().toISOString() : undefined }); if (!set.completed) setRest(currentExercise.restSeconds); };
  const addSet = () => setSession((current) => current && ({ ...current, exercises: current.exercises.map((exercise, index) => index === current.current ? { ...exercise, sets: [...exercise.sets, { setNumber: exercise.sets.length + 1, plannedReps: exercise.sets.at(-1)?.plannedReps ?? 10, actualReps: exercise.sets.at(-1)?.actualReps ?? 10, actualWeightKg: exercise.sets.at(-1)?.actualWeightKg ?? 0, rir: 2, completed: false }] } : exercise) }));
  const finish = async () => {
    if (!session) return; const completedSets = session.exercises.flatMap((x) => x.sets).filter((x) => x.completed).length;
    if (!completedSets) { toast.add("Completa al menos una serie antes de finalizar", "error"); return; }
    setSaving(true);
    try {
      const firstPlanDay = session.exercises.find((x) => x.planDayId)?.planDayId;
      const result = await workoutLogApi.log({ date: today(), planDayId: firstPlanDay as never, startedAt: session.startedAt, finishedAt: new Date().toISOString(), notes: session.notes || undefined, entries: session.exercises.map((item) => { const done = item.sets.filter((set) => set.completed); return { exerciseId: item.exercise.id, plannedSets: item.sets.length, plannedReps: item.sets[0]?.plannedReps ?? 0, actualSets: done.length, actualReps: done.length ? Math.round(done.reduce((sum, set) => sum + (set.actualReps ?? 0), 0) / done.length) : undefined, actualWeightKg: done.length ? Math.max(...done.map((set) => set.actualWeightKg ?? 0)) : undefined, completed: done.length === item.sets.length, isExtra: item.isExtra, sets: item.sets }; }) });
      localStorage.removeItem(STORAGE_KEY); setSession(null); toast.add(`Sesión guardada${result.totalXp ? ` · +${result.totalXp} XP` : ""}`, "success"); navigate("/training");
    } catch (err) { toast.add(err instanceof Error ? err.message : "No se pudo guardar la sesión", "error"); } finally { setSaving(false); }
  };
  const discard = () => { if (!window.confirm("¿Descartar la sesión activa? No se guardarán las series.")) return; localStorage.removeItem(STORAGE_KEY); setSession(null); navigate("/training"); };

  if (!session) {
    if (loading) return <Loading message="Preparando tu sesión" />; if (error) return <ErrorState message={error} onRetry={load} />;
    const day = plan?.days.find((item) => item.dayOfWeek === new Date().getDay());
    return <div className="page training-session-start"><div className="hero"><div className="hero__label"><span className="icon">timer</span>Modo entrenamiento</div><h1 className="hero__title">Entrená sin distracciones</h1><p className="hero__subtitle">Registrá cada serie, controlá descansos y conservá tu progreso real.</p></div>{!day?.items.length ? <EmptyState icon="hotel" title="Hoy no hay rutina programada" description="Creá un entrenamiento libre desde la vista Entrenar." action={<Button onClick={() => navigate("/training?quick=exercise")}>Crear sesión libre</Button>} /> : <div className="card session-preview"><div><strong>{day.focus}</strong><p className="text-muted">{day.items.length} ejercicios · {day.items.reduce((sum, x) => sum + x.sets, 0)} series</p></div><ol>{day.items.map((item) => <li key={item.id}>{item.exercise.name} <span>{item.sets} × {item.repsMin}-{item.repsMax}</span></li>)}</ol><Button block onClick={start}><span className="icon">play_arrow</span>Comenzar sesión</Button></div>}</div>;
  }

  const exercise = session.exercises[session.current]!; const done = session.exercises.flatMap((x) => x.sets).filter((x) => x.completed).length; const total = session.exercises.flatMap((x) => x.sets).length;
  return <div className="page training-session"><header className="session-top"><button className="icon-action" onClick={() => navigate("/training")} aria-label="Minimizar sesión"><span className="icon">keyboard_arrow_down</span></button><div><span className="session-top__eyebrow">Sesión en curso</span><strong>{secondsLabel(elapsed)}</strong></div><Button variant="ghost" size="sm" onClick={() => void finish()} loading={saving}>Finalizar</Button></header><div className="session-progress" aria-label={`${done} de ${total} series`}><span style={{ width: `${total ? done / total * 100 : 0}%` }} /></div><div className="session-counter">Ejercicio {session.current + 1} de {session.exercises.length} · {done}/{total} series</div><section className="session-exercise"><div className="session-exercise__head"><div><span className="text-muted">Ahora</span><h1>{exercise.exercise.name}</h1><p>{exercise.exercise.equipment} · descanso {exercise.restSeconds}s</p></div></div><div className="set-table"><div className="set-row set-row--head"><span>Serie</span><span>kg</span><span>Reps</span><span>RIR</span><span>Hecha</span></div>{exercise.sets.map((set, index) => <div className={`set-row ${set.completed ? "set-row--done" : ""}`} key={set.setNumber}><strong>{set.setNumber}</strong><input aria-label={`Peso serie ${set.setNumber}`} type="number" min="0" step="0.5" value={set.actualWeightKg ?? 0} onChange={(e) => updateSet(index, { actualWeightKg: Number(e.target.value) })} /><input aria-label={`Repeticiones serie ${set.setNumber}`} type="number" min="0" value={set.actualReps ?? 0} onChange={(e) => updateSet(index, { actualReps: Number(e.target.value) })} /><input aria-label={`RIR serie ${set.setNumber}`} type="number" min="0" max="10" value={set.rir ?? 0} onChange={(e) => updateSet(index, { rir: Number(e.target.value) })} /><button className={`check-btn ${set.completed ? "check-btn--active" : ""}`} onClick={() => completeSet(index)} aria-label={set.completed ? "Desmarcar serie" : "Completar serie"}><span className="icon">check</span></button></div>)}</div><Button variant="ghost" block onClick={addSet}>Añadir serie</Button></section>{rest > 0 && <div className="rest-timer"><div><span>Descanso</span><strong>{secondsLabel(rest)}</strong></div><div><button onClick={() => setRest((x) => Math.max(0, x - 15))}>−15s</button><button onClick={() => setRest(0)}>Omitir</button><button onClick={() => setRest((x) => x + 15)}>+15s</button></div></div>}<nav className="session-nav"><Button variant="ghost" disabled={session.current === 0} onClick={() => setSession({ ...session, current: session.current - 1 })}>Anterior</Button><Button disabled={session.current === session.exercises.length - 1} onClick={() => setSession({ ...session, current: session.current + 1 })}>Siguiente</Button></nav><textarea className="textarea" placeholder="Notas de la sesión..." value={session.notes} onChange={(e) => setSession({ ...session, notes: e.target.value })} /><button className="session-discard" onClick={discard}>Descartar sesión</button></div>;
}
