import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi } from "../api/resources";
import { Button, Card, EmptyState, ErrorState, Loading } from "../components/ui";
import { MacroBar, RingProgress, StatCard } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { formatNumber, modalityName } from "../utils/format";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, run } = useAsync<{
    summary: Awaited<ReturnType<typeof dashboardApi.summary>>;
  }>();

  const load = useCallback(() => {
    void run(dashboardApi.summary().then((summary) => ({ summary })));
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <Loading message="Cargando dashboard" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="dashboard" title="Sin datos" />;

  const s = data.summary;
  const xp = s.user.xp;
  const xpToNext = s.user.xpToNext;

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label">
          <span className="icon">calendar_today</span>
          <span>Resumen diario</span>
        </div>
        <h1 className="hero__title">
          Hola, <span className="accent">{s.user.displayName}</span>
        </h1>
        <p className="hero__subtitle">
          Nivel {s.user.level} · {s.user.levelTitle} · Racha de {s.user.streakDays} días
        </p>
      </div>

      <div className="grid-2">
        <StatCard
          icon="local_fire_department"
          label="XP"
          value={
            <RingProgress value={xp} max={xpToNext} size={52} stroke={5}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{s.user.level}</span>
            </RingProgress>
          }
          variant="primary"
          hint={`${formatNumber(xpToNext - xp)} XP para el siguiente nivel`}
        />
        <StatCard
          icon="fitness_center"
          label="Entrenos esta semana"
          value={`${s.week.workoutsDone}/${s.week.workoutsPlanned}`}
          variant="success"
        />
        <StatCard
          icon="monitor_weight"
          label="Peso actual"
          value={`${s.latestWeight?.toFixed(1) ?? "--"} kg`}
          variant="danger"
          hint={s.weightDelta7d ? `Δ ${s.weightDelta7d.toFixed(1)} kg / 7 días` : undefined}
        />
        <StatCard
          icon="emoji_events"
          label="Logros recientes"
          value={s.recentAchievements.length}
          variant="accent"
        />
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Card title="Entrenamiento de hoy" icon="fitness_center">
          {s.today.workout.exerciseCount === 0 ? (
            <EmptyState
              icon="event_busy"
              title="Descanso"
              description="Hoy no tienes entrenamiento programado."
            />
          ) : (
            <>
              <div className="label" style={{ marginBottom: 6 }}>
                {modalityName(s.today.workout.modality)} · {s.today.workout.focus}
              </div>
              <div style={{ marginBottom: 14 }}>
                {s.today.workout.completed ? (
                  <span className="badge badge--success">Completado</span>
                ) : (
                  <span className="badge badge--warning">Pendiente</span>
                )}
              </div>
              <Button
                variant={s.today.workout.completed ? "ghost" : "primary"}
                block
                onClick={() => navigate("/today")}
              >
                {s.today.workout.completed ? "Ver registro" : "Ir a entrenar"}
              </Button>
            </>
          )}
        </Card>

        <Card title="Nutrición de hoy" icon="restaurant">
          <MacroBar
            label="Kcal"
            current={s.today.meals.loggedCalories}
            target={s.today.meals.targetCalories}
            unit=""
            color="primary"
          />
          <MacroBar
            label="Proteína"
            current={s.today.meals.loggedProteinG}
            target={s.today.meals.targetProteinG}
            unit="g"
            color="success"
          />
          <div className="label mt-3" style={{ textAlign: "right" }}>
            {s.today.meals.itemsLogged}/{s.today.meals.itemsTotal} comidas registradas
          </div>
          <Button variant="ghost" block onClick={() => navigate("/nutrition")}>
            Ver nutrición
          </Button>
        </Card>
      </div>

      <div className="card mt-4">
        <div className="card__title">
          <span className="icon">trending_up</span>
          Últimos logros
        </div>
        {s.recentAchievements.length === 0 ? (
          <EmptyState
            icon="emoji_events"
            title="Sin logros recientes"
            description="Sigue entrenando para desbloquear el primero."
          />
        ) : (
          <div className="grid-3">
            {s.recentAchievements.map((a) => (
              <Card key={a.code} className="achievement">
                <div className="achievement__icon">
                  <span className="icon fill">{a.icon}</span>
                </div>
                <div className="achievement__title">{a.name}</div>
                <div className="achievement__desc">{a.description}</div>
                <div className="achievement__progress">
                  <span className="icon">stars</span>
                  +{a.xpReward} XP
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
