import { useCallback, useEffect, useState } from "react";
import { profileApi, trainingConfigApi } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Chip, EmptyState, ErrorState, Input, Loading, Modal, Select } from "../components/ui";
import { DayConfigEditor } from "../components/DayConfigEditor";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type {
  CalisthenicsMode,
  Goal,
  GymMode,
  MealType,
  ProfileDto,
  TrainingConfigDto,
} from "../types/api";
import { formatNumber, goalName, licenseStatusName, mealTypeName } from "../utils/format";

const GOALS: Goal[] = ["Recomposition", "Bulk", "Cut"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const GYM_MODES: GymMode[] = ["Bodybuilding", "Health", "Combined"];
const CALI_MODES: CalisthenicsMode[] = ["Classic", "Military", "CrossFit"];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToastCtx();
  const [activeTab, setActiveTab] = useState<"profile" | "training" | "account">("profile");
  const [confirmGoal, setConfirmGoal] = useState(false);
  const [pendingGoal, setPendingGoal] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, run } = useAsync<{
    profile: ProfileDto;
    config: TrainingConfigDto;
  }>();

  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [config, setConfig] = useState<TrainingConfigDto | null>(null);

  const load = useCallback(() => {
    void run(
      Promise.all([profileApi.get(), trainingConfigApi.get()]).then(([profile, config]) => ({
        profile,
        config,
      })),
    );
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data) {
      setProfile(data.profile);
      setConfig(data.config);
    }
  }, [data]);

  const handleGoalChange = (g: Goal) => {
    setPendingGoal(g);
    setConfirmGoal(true);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await profileApi.update(profile);
      toast.add("Perfil actualizado", "success");
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al guardar perfil";
      toast.add(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await trainingConfigApi.update(config);
      toast.add("Configuración de entrenamiento actualizada", "success");
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al guardar configuración";
      toast.add(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmGoalChange = async () => {
    if (!profile || !pendingGoal) return;
    setProfile({ ...profile, goal: pendingGoal });
    setConfirmGoal(false);
    setPendingGoal(null);
    await saveProfile();
  };

  const toggleMealType = (mt: MealType) => {
    setProfile((p) => {
      if (!p) return p;
      const has = p.mealTypes.includes(mt);
      return {
        ...p,
        mealTypes: has ? p.mealTypes.filter((m) => m !== mt) : [...p.mealTypes, mt],
      };
    });
  };

  if (loading && !data) return <Loading message="Cargando ajustes" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!profile || !config) return <EmptyState icon="settings" title="Sin datos" />;

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label">
          <span className="icon">settings</span>
          <span>Ajustes</span>
        </div>
        <h1 className="hero__title">Configuración</h1>
      </div>

      <div className="seg mb-4">
        {[
          { value: "profile", label: "Perfil" },
          { value: "training", label: "Entrenamiento" },
          { value: "account", label: "Cuenta" },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            className={`seg__btn ${activeTab === t.value ? "active" : ""}`}
            onClick={() => setActiveTab(t.value as typeof activeTab)}
          >
            {t.label}
          </button>
        ))}
        <div
          className="seg__indicator"
          style={{
            left: `calc(4px + (100% - 8px) * ${["profile", "training", "account"].indexOf(activeTab)} / 3)`,
            width: `calc((100% - 8px) / 3)`,
          }}
        />
      </div>

      {activeTab === "profile" && (
        <div>
          <Card title="Datos personales" icon="person" style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select
                label="Sexo"
                value={profile.sex}
                onChange={(e) => setProfile({ ...profile, sex: e.target.value as "Male" | "Female" })}
                options={[
                  { value: "Male", label: "Masculino" },
                  { value: "Female", label: "Femenino" },
                ]}
              />
              <Input
                label="Fecha de nacimiento"
                type="date"
                value={profile.birthDate}
                onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })}
              />
              <Input
                label="Altura (cm)"
                type="number"
                value={profile.heightCm}
                onChange={(e) => setProfile({ ...profile, heightCm: Number(e.target.value) })}
              />
              <Input
                label="Peso (kg)"
                type="number"
                step="0.1"
                value={profile.weightKg}
                onChange={(e) => setProfile({ ...profile, weightKg: Number(e.target.value) })}
              />
              <Input
                label="Peso objetivo (kg)"
                type="number"
                step="0.1"
                value={profile.targetWeightKg ?? ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    targetWeightKg: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
              <Select
                label="Actividad"
                value={String(profile.activityFactor)}
                onChange={(e) => setProfile({ ...profile, activityFactor: Number(e.target.value) })}
                options={[
                  { value: "1.2", label: "Sedentario" },
                  { value: "1.375", label: "Ligero" },
                  { value: "1.4", label: "Moderado" },
                  { value: "1.55", label: "Activo" },
                  { value: "1.725", label: "Muy activo" },
                ]}
              />
            </div>
          </Card>

          <Card title="Objetivo y comidas" icon="track_changes" style={{ marginBottom: 16 }}>
            <div className="label mb-2">Objetivo</div>
            <div className="grid-3 mb-4">
              {GOALS.map((g) => (
                <Card
                  key={g}
                  interactive
                  className={`goal-card ${profile.goal === g ? "goal-card--active" : ""}`}
                  onClick={() => handleGoalChange(g)}
                >
                  <div className="goal-card__title">{goalName(g)}</div>
                  <div className="goal-card__desc">
                    {g === "Bulk"
                      ? "Ganar masa muscular"
                      : g === "Cut"
                        ? "Reducir grasa"
                        : "Recomposición corporal"}
                  </div>
                </Card>
              ))}
            </div>
            <div className="label mb-2">Comidas del día</div>
            <div className="day-config__chips">
              {MEAL_TYPES.map((mt) => (
                <Chip
                  key={mt}
                  active={profile.mealTypes.includes(mt)}
                  onClick={() => toggleMealType(mt)}
                >
                  {mealTypeName(mt)}
                </Chip>
              ))}
            </div>
          </Card>

          <Card title="Cálculos" icon="monitoring" style={{ marginBottom: 16 }}>
            <div className="grid-2">
              <div className="stat-card">
                <div className="stat-card__label">TDEE</div>
                <div className="stat-card__value">{formatNumber(profile.tdee)} kcal</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">IMC</div>
                <div className="stat-card__value">{profile.bmi.toFixed(1)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Calorías objetivo</div>
                <div className="stat-card__value">{formatNumber(profile.targets.calories)} kcal</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Proteína objetivo</div>
                <div className="stat-card__value">{formatNumber(profile.targets.proteinG)}g</div>
              </div>
            </div>
          </Card>

          <Button variant="primary" block loading={saving} onClick={() => void saveProfile()}>
            Guardar perfil
          </Button>
        </div>
      )}

      {activeTab === "training" && (
        <div>
          <Card title="Modos de entrenamiento" icon="fitness_center" style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select
                label="Modo gimnasio"
                value={config.gymMode}
                onChange={(e) => setConfig({ ...config, gymMode: e.target.value as GymMode })}
                options={GYM_MODES.map((m) => ({ value: m, label: m }))}
              />
              <Select
                label="Modo calistenia"
                value={config.calisthenicsMode}
                onChange={(e) => setConfig({ ...config, calisthenicsMode: e.target.value as CalisthenicsMode })}
                options={CALI_MODES.map((m) => ({ value: m, label: m }))}
              />
            </div>
          </Card>
          <Card title="Configuración semanal" icon="calendar_month" style={{ marginBottom: 16 }}>
            <DayConfigEditor
              days={config.days}
              onChange={(days) => setConfig({ ...config, days })}
            />
          </Card>
          <Button variant="primary" block loading={saving} onClick={() => void saveConfig()}>
            Guardar configuración
          </Button>
        </div>
      )}

      {activeTab === "account" && (
        <div>
          <Card title="Cuenta" icon="account_circle" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div className="label">Usuario</div>
              <div>{user?.username}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="label">Correo</div>
              <div>{user?.email}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="label">Licencia</div>
              <span className={`badge badge--${user?.license.status === "Active" ? "success" : "warning"}`}>
                {licenseStatusName(user?.license.status ?? "Pending")}
              </span>
              {user?.license.expiresAt && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 4 }}>
                  Expira: {new Date(user.license.expiresAt).toLocaleDateString("es-ES")}
                </div>
              )}
            </div>
            <Button variant="danger" block onClick={() => void logout()}>
              Cerrar sesión
            </Button>
          </Card>
        </div>
      )}

      <Modal
        open={confirmGoal}
        onClose={() => setConfirmGoal(false)}
        title="Cambiar objetivo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmGoal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmGoalChange()} loading={saving}>
              Confirmar
            </Button>
          </>
        }
      >
        <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
          Cambiar el objetivo regenerará tus planes de entrenamiento y comidas. Esta
          acción afecta los planes futuros.
        </p>
      </Modal>
    </div>
  );
}
