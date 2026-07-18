import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { workoutPlanApi, workoutLogApi } from "../api/resources";
import { Button, Card, EmptyState, ErrorState, Loading, Modal } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { ExerciseDto, WorkoutPlanDayDto } from "../types/api";
import { addDays, dayName, modalityName, muscleGroupName, today } from "../utils/format";

export default function TrainingPage() {
  const navigate = useNavigate();
  const toast = useToastCtx();
  const [selectedDay, setSelectedDay] = useState<WorkoutPlanDayDto | null>(null);
  const [guide, setGuide] = useState<ExerciseDto | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const { data, loading, error, run } = useAsync<{
    plan: Awaited<ReturnType<typeof workoutPlanApi.current>>;
    history: Awaited<ReturnType<typeof workoutLogApi.get>>;
  }>();

  const load = useCallback(() => {
    const from = addDays(today(), -30);
    void run(
      Promise.all([
        workoutPlanApi.current(),
        workoutLogApi.get(from, today()),
      ]).then(([plan, history]) => ({ plan, history })),
    );
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await workoutPlanApi.regenerate();
      toast.add("Plan regenerado", "success");
      load();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al regenerar";
      toast.add(message, "error");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !data) return <Loading message="Cargando plan" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="event_busy" title="Sin plan" />;

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label">
          <span className="icon">calendar_month</span>
          <span>Plan semanal</span>
        </div>
        <h1 className="hero__title">Entrenamiento programado</h1>
        <p className="hero__subtitle">
          {data.plan.days.filter((d) => d.modality !== "Rest").length} días activos esta semana.
        </p>
      </div>

      <div className="section-title">
        <span>Vista semanal</span>
        <Button variant="ghost" size="sm" loading={regenerating} onClick={() => void handleRegenerate()}>
          Regenerar
        </Button>
      </div>

      <div className="grid-2">
        {data.plan.days.map((day) => (
          <Card
            key={day.dayOfWeek}
            interactive
            className={day.modality === "Rest" ? "card" : "card card--elevated"}
            onClick={() => setSelectedDay(day)}
          >
            <div className="card__title">
              <span className="icon">{day.modality === "Rest" ? "hotel" : "fitness_center"}</span>
              {dayName(day.dayOfWeek)}
            </div>
            <div className="label mb-2">
              {modalityName(day.modality)} · {day.focus || "Descanso"}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {day.items.length} ejercicios
            </div>
          </Card>
        ))}
      </div>

      <div className="section-title mt-4">
        <span>Historial reciente</span>
      </div>
      {data.history.length === 0 ? (
        <EmptyState icon="history" title="Sin registros" description="Empieza a entrenar para ver tu historial." />
      ) : (
        <div>
          {data.history.slice(0, 10).map((log) => (
            <div key={log.id} className="list-item">
              <div className="list-item__main">
                <div className="list-item__title">{log.date}</div>
                <div className="list-item__meta">
                  {log.entries.filter((e) => e.completed).length}/{log.entries.length} ejercicios
                </div>
              </div>
              <div className="badge badge--success">{log.entries.reduce((acc, e) => acc + (e.completed ? 1 : 0), 0)}</div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? dayName(selectedDay.dayOfWeek) : "Día"}
        footer={
          <Button variant="primary" onClick={() => navigate("/today")}>
            Ir a hoy
          </Button>
        }
      >
        {selectedDay && (
          <>
            <div className="label mb-3">
              {modalityName(selectedDay.modality)} · {selectedDay.focus}
            </div>
            {selectedDay.items.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-item__main">
                  <div className="list-item__title">{item.exercise.name}</div>
                  <div className="list-item__meta">
                    {item.sets} series · {item.repsMin}-{item.repsMax} reps · {item.restSeconds}s
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGuide(item.exercise);
                  }}
                >
                  Guía
                </Button>
              </div>
            ))}
          </>
        )}
      </Modal>

      <Modal
        open={!!guide}
        onClose={() => setGuide(null)}
        title={guide?.name ?? "Guía"}
        wide
      >
        {guide && (
          <>
            <div className="label mb-2">
              {muscleGroupName(guide.muscleGroup)} · {guide.equipment}
            </div>
            <p style={{ color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
              {guide.description}
            </p>
            <div className="section-title">Instrucciones</div>
            <p style={{ lineHeight: 1.6, marginBottom: 16 }}>{guide.instructions}</p>
            <div className="section-title">Objetivo</div>
            <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>{guide.target}</p>
            <div className="section-title">Efecto</div>
            <p style={{ color: "var(--text-muted)" }}>{guide.effect}</p>
          </>
        )}
      </Modal>
    </div>
  );
}
