import { useCallback, useEffect, useState } from "react";
import { metricsApi } from "../api/resources";
import { Button, Card, EmptyState, ErrorState, Input, Loading } from "../components/ui";
import { BarChart, LineChart, StatCard } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import { addDays, muscleGroupName, shortDayName, today } from "../utils/format";

export default function ProgressPage() {
  const toast = useToastCtx();
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, loading, error, run } = useAsync<{
    summary: Awaited<ReturnType<typeof metricsApi.summary>>;
    weights: Awaited<ReturnType<typeof metricsApi.weight>>;
  }>();

  const load = useCallback(() => {
    const from = addDays(today(), -90);
    void run(
      Promise.all([metricsApi.summary(today()), metricsApi.weight(from, today())]).then(
        ([summary, weights]) => ({ summary, weights }),
      ),
    );
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(weight);
    if (!value || value <= 0) {
      toast.add("Ingresa un peso válido", "error");
      return;
    }
    setSaving(true);
    try {
      await metricsApi.saveWeight({ date: today(), weightKg: value });
      toast.add("Peso registrado", "success");
      setWeight("");
      load();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al guardar peso";
      toast.add(message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <Loading message="Cargando progreso" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="monitor_weight" title="Sin datos" />;

  const summary = data.summary;
  const weightData = data.weights
    .slice(-14)
    .map((w) => ({ label: w.date.slice(5), value: w.weightKg }));

  const xpData = summary.xpByDay.map((value, i) => ({
    label: shortDayName((new Date().getDay() - 13 + i + 7) % 7),
    value,
  }));

  const volumeData = Object.entries(summary.volumeByMuscle).map(([muscle, value]) => {
    const name = muscleGroupName(muscle);
    return {
      label: name.length > 6 ? `${name.slice(0, 4)}.` : name,
      value,
    };
  });

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label">
          <span className="icon">trending_up</span>
          <span>Progreso</span>
        </div>
        <h1 className="hero__title">Tu evolución</h1>
      </div>

      <Card title="Registrar peso" icon="monitor_weight" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSaveWeight} className="weight-entry-form">
          <div className="weight-entry-form__field">
            <Input
              type="number"
              step="0.1"
              label="Peso (kg)"
              placeholder="75.0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </form>
      </Card>

      <div className="grid-2">
        <Card title="Historial de peso" icon="show_chart">
          {weightData.length === 0 ? (
            <EmptyState icon="monitor_weight" title="Sin registros" />
          ) : (
            <LineChart data={weightData} height={180} />
          )}
        </Card>
        <Card title="XP últimos 14 días" icon="local_fire_department">
          <BarChart data={xpData} height={180} />
        </Card>
      </div>

      <div className="grid-4 mt-4">
        <StatCard
          icon="percent"
          label="Adherencia 7 días"
          value={`${summary.adherence7d.toFixed(0)}%`}
          variant="primary"
        />
        <StatCard
          icon="percent"
          label="Adherencia 30 días"
          value={`${summary.adherence30d.toFixed(0)}%`}
          variant="success"
        />
        <StatCard
          icon="fitness_center"
          label="Entrenos semana"
          value={`${summary.workoutsThisWeek}`}
          variant="danger"
        />
        <StatCard
          icon="fitness_center"
          label="Entrenos total"
          value={`${summary.workoutsTotal}`}
          variant="accent"
        />
        <StatCard
          icon="local_fire_department"
          label="Racha actual"
          value={`${summary.currentStreak} días`}
          variant="primary"
        />
        <StatCard
          icon="monitor_weight"
          label="Delta peso 30 días"
          value={`${summary.weightDelta30d.toFixed(1)} kg`}
          variant={summary.weightDelta30d <= 0 ? "success" : "danger"}
        />
        <StatCard
          icon="restaurant"
          label="Kcal promedio 7d"
          value={`${Math.round(summary.caloriesAvg7d)}`}
          variant="accent"
        />
        <StatCard
          icon="egg_alt"
          label="Proteína promedio 7d"
          value={`${Math.round(summary.proteinAvg7d)}g`}
          variant="success"
        />
      </div>

      <Card title="Volumen por músculo (7 días)" icon="fitness_center" className="mt-4">
        {volumeData.length === 0 ? (
          <EmptyState icon="fitness_center" title="Sin volumen registrado" />
        ) : (
          <BarChart data={volumeData} height={200} />
        )}
      </Card>
    </div>
  );
}
