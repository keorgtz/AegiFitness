import { useCallback, useEffect, useState } from "react";
import { gamificationApi, goalsApi } from "../api/resources";
import { Button, Card, Chip, EmptyState, ErrorState, Input, Loading, Modal, Select } from "../components/ui";
import { RingProgress } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { GoalType, GoalStatus } from "../types/api";
import { formatDate, goalStatusName, goalTypeName } from "../utils/format";

const GOAL_TYPES: GoalType[] = ["TargetWeight", "WeeklyWorkouts", "DailyProtein", "Custom"];

export default function AchievementsPage() {
  const toast = useToastCtx();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, error, run } = useAsync<{
    summary: Awaited<ReturnType<typeof gamificationApi.summary>>;
  }>();

  const load = useCallback(() => {
    void run(gamificationApi.summary().then((summary) => ({ summary })));
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (id: number, status: GoalStatus) => {
    try {
      await goalsApi.update(id, { status });
      toast.add(`Meta ${goalStatusName(status).toLowerCase()}`, "success");
      load();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al actualizar meta";
      toast.add(message, "error");
    }
  };

  if (loading && !data) return <Loading message="Cargando logros" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="emoji_events" title="Sin datos" />;

  const s = data.summary;
  const unlocked = s.achievements.filter((a) => a.unlockedAt);
  const locked = s.achievements.filter((a) => !a.unlockedAt);

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label">
          <span className="icon">emoji_events</span>
          <span>Logros</span>
        </div>
        <h1 className="hero__title">
          Nivel {s.level} · <span className="accent">{s.levelTitle}</span>
        </h1>
        <p className="hero__subtitle">Racha de {s.streakDays} días · {s.xp} XP totales</p>
      </div>

      <Card title="Progreso de nivel" icon="stars" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <RingProgress value={s.xpInLevel} max={s.xpForLevel} size={120} stroke={10}>
            <span className="ring__value">{s.level}</span>
            <span className="ring__hint">Nivel</span>
          </RingProgress>
          <div>
            <div className="label">XP en nivel</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>
              {s.xpInLevel} / {s.xpForLevel}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {s.xpForLevel - s.xpInLevel} XP para el siguiente nivel
            </div>
          </div>
        </div>
      </Card>

      <div className="section-title">
        <span>Logros desbloqueados</span>
        <span className="section-title__hint">{unlocked.length}</span>
      </div>
      {unlocked.length === 0 ? (
        <EmptyState icon="emoji_events" title="Sin logros aún" description="Sigue entrenando para desbloquear el primero." />
      ) : (
        <div className="grid-3">
          {unlocked.map((a) => (
            <Card key={a.code} className="achievement achievement--unlocked">
              <div className="achievement__icon">
                <span className="icon fill">{a.icon}</span>
              </div>
              <div className="achievement__title">{a.name}</div>
              <div className="achievement__desc">{a.description}</div>
              <div className="achievement__progress">
                <span className="icon">stars</span>
                +{a.xpReward} XP · {a.unlockedAt ? formatDate(a.unlockedAt) : ""}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="section-title mt-4">
        <span>Logros pendientes</span>
        <span className="section-title__hint">{locked.length}</span>
      </div>
      {locked.length === 0 ? (
        <EmptyState icon="verified" title="Todos los logros desbloqueados" />
      ) : (
        <div className="grid-3">
          {locked.map((a) => (
            <Card key={a.code} className="achievement">
              <div className="achievement__icon">
                <span className="icon">{a.icon}</span>
              </div>
              <div className="achievement__title">{a.name}</div>
              <div className="achievement__desc">{a.description}</div>
              <div className="progress" style={{ marginTop: 10, height: 6 }}>
                <div
                  className="progress__bar progress__bar--primary"
                  style={{ width: `${Math.min((a.progress / a.threshold) * 100, 100)}%` }}
                />
              </div>
              <div className="achievement__progress" style={{ marginTop: 6 }}>
                {a.progress} / {a.threshold}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="section-title mt-4">
        <span>Mis metas</span>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Nueva meta
        </Button>
      </div>
      {s.goals.length === 0 ? (
        <EmptyState icon="target" title="Sin metas" description="Crea una meta para seguir tu progreso." />
      ) : (
        <div>
          {s.goals.map((g) => (
            <div key={g.id} className="list-item">
              <div className="list-item__main">
                <div className="list-item__title">{g.title}</div>
                <div className="list-item__meta">
                  {goalTypeName(g.type)} · {g.currentValue.toFixed(1)} / {g.targetValue.toFixed(1)} {g.unit}
                </div>
                <div className="progress" style={{ marginTop: 8, height: 5 }}>
                  <div
                    className="progress__bar progress__bar--success"
                    style={{ width: `${Math.min((g.currentValue / g.targetValue) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="row gap-2">
                {g.status === "Active" && (
                  <>
                    <Chip active onClick={() => void handleStatus(g.id, "Completed")}>
                      Completar
                    </Chip>
                    <Chip onClick={() => void handleStatus(g.id, "Abandoned")}>Abandonar</Chip>
                  </>
                )}
                <span className={`badge badge--${g.status === "Active" ? "info" : g.status === "Completed" ? "success" : "danger"}`}>
                  {goalStatusName(g.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateGoalModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}

function CreateGoalModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToastCtx();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const type = (form.elements.namedItem("type") as HTMLSelectElement).value as GoalType;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const targetValue = Number((form.elements.namedItem("targetValue") as HTMLInputElement).value);
    const unit = (form.elements.namedItem("unit") as HTMLInputElement).value;
    const deadline = (form.elements.namedItem("deadline") as HTMLInputElement).value || undefined;

    if (!title || !targetValue || !unit) {
      toast.add("Completa los campos obligatorios", "error");
      return;
    }

    setLoading(true);
    try {
      await goalsApi.create({ type, title, targetValue, unit, deadline });
      toast.add("Meta creada", "success");
      onCreated();
      onClose();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al crear meta";
      toast.add(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva meta">
      <form onSubmit={handleSubmit}>
        <Select
          name="type"
          label="Tipo"
          options={GOAL_TYPES.map((t) => ({ value: t, label: goalTypeName(t) }))}
        />
        <Input name="title" label="Título" placeholder="Pérdida de 5 kg" required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input name="targetValue" type="number" step="0.1" label="Valor objetivo" required />
          <Input name="unit" label="Unidad" placeholder="kg" required />
        </div>
        <Input name="deadline" type="date" label="Fecha límite (opcional)" />
        <div className="dialog__footer">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Crear
          </Button>
        </div>
      </form>
    </Modal>
  );
}


