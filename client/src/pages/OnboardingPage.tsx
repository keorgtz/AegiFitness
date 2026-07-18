import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { profileApi, trainingConfigApi } from "../api/resources";
import { Button, Card, Chip, Input, Select } from "../components/ui";
import { DayConfigEditor } from "../components/DayConfigEditor";
import { useToastCtx } from "../hooks/useToastContext";
import type {
  CalisthenicsMode,
  Goal,
  GymMode,
  MealType,
  Modality,
  MuscleGroup,
  ProfileDto,
  TrainingConfigDto,
  TrainingDayConfigDto,
} from "../types/api";
import { goalName, mealTypeName } from "../utils/format";

const GOALS: Goal[] = ["Recomposition", "Bulk", "Cut"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const GYM_MODES: GymMode[] = ["Bodybuilding", "Health", "Combined"];
const CALI_MODES: CalisthenicsMode[] = ["Classic", "Military", "CrossFit"];

function emptyDays(): TrainingDayConfigDto[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    modality: "Rest" as Modality,
    muscleGroups: [] as MuscleGroup[],
  }));
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const toast = useToastCtx();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState<ProfileDto>({
    sex: "Male",
    birthDate: "1990-01-01",
    heightCm: 175,
    weightKg: 75,
    targetWeightKg: undefined,
    bodyType: "mesomorfo",
    activityFactor: 1.4,
    goal: "Recomposition",
    mealTypes: ["Breakfast", "Lunch", "Dinner", "Snack"],
    onboardingCompleted: true,
    bmi: 0,
    tdee: 0,
    targets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  });

  const [config, setConfig] = useState<TrainingConfigDto>({
    gymMode: "Bodybuilding",
    calisthenicsMode: "Classic",
    days: emptyDays(),
  });

  const toggleMealType = (mt: MealType) => {
    setProfile((p) => {
      const has = p.mealTypes.includes(mt);
      return {
        ...p,
        mealTypes: has ? p.mealTypes.filter((m) => m !== mt) : [...p.mealTypes, mt],
      };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await profileApi.update(profile);
      await trainingConfigApi.update(config);
      toast.add("Perfil completado", "success");
      navigate("/", { replace: true });
      window.location.reload();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al guardar el perfil";
      toast.add(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-layout__form">
        <div className="auth-card">
          <div className="auth-card__logo">
            <div className="brand-mark">
              <span className="icon">fitness_center</span>
            </div>
            <div className="brand-text">
              <strong>AegiFitness</strong>
              <span>Configuración inicial</span>
            </div>
          </div>

          {step === 1 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Tus datos</h2>
              <p className="wizard-step__desc">
                Necesitamos algunos datos para calcular tu plan.
              </p>
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
                  onChange={(e) =>
                    setProfile({ ...profile, heightCm: Number(e.target.value) })
                  }
                />
                <Input
                  label="Peso actual (kg)"
                  type="number"
                  step="0.1"
                  value={profile.weightKg}
                  onChange={(e) =>
                    setProfile({ ...profile, weightKg: Number(e.target.value) })
                  }
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
                  onChange={(e) =>
                    setProfile({ ...profile, activityFactor: Number(e.target.value) })
                  }
                  options={[
                    { value: "1.2", label: "Sedentario" },
                    { value: "1.375", label: "Ligero" },
                    { value: "1.4", label: "Moderado" },
                    { value: "1.55", label: "Activo" },
                    { value: "1.725", label: "Muy activo" },
                  ]}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <Button onClick={() => setStep(2)}>Continuar</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Objetivo y comidas</h2>
              <p className="wizard-step__desc">
                Selecciona tu objetivo principal y las comidas que harás al día.
              </p>

              <div className="grid-3" style={{ marginBottom: 20 }}>
                {GOALS.map((g) => (
                  <Card
                    key={g}
                    interactive
                    className={`goal-card ${profile.goal === g ? "goal-card--active" : ""}`}
                    onClick={() => setProfile({ ...profile, goal: g })}
                  >
                    <div className="goal-card__icon">
                      <span className="icon">
                        {g === "Bulk" ? "fitness_center" : g === "Cut" ? "water_drop" : "cycle"}
                      </span>
                    </div>
                    <div className="goal-card__title">{goalName(g)}</div>
                    <div className="goal-card__desc">
                      {g === "Bulk"
                        ? "Ganar masa muscular con superávit calórico."
                        : g === "Cut"
                          ? "Reducir grasa manteniendo músculo."
                          : "Perder grasa y ganar músculo simultáneamente."}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="section-title">Comidas del día</div>
              <div className="day-config__chips" style={{ marginBottom: 20 }}>
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

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button onClick={() => setStep(3)}>Continuar</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Configuración semanal</h2>
              <p className="wizard-step__desc">
                Define qué días entrenas y qué músculos trabajarás.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <Select
                  label="Modo gimnasio"
                  value={config.gymMode}
                  onChange={(e) =>
                    setConfig({ ...config, gymMode: e.target.value as GymMode })
                  }
                  options={GYM_MODES.map((m) => ({ value: m, label: m }))}
                />
                <Select
                  label="Modo calistenia"
                  value={config.calisthenicsMode}
                  onChange={(e) =>
                    setConfig({ ...config, calisthenicsMode: e.target.value as CalisthenicsMode })
                  }
                  options={CALI_MODES.map((m) => ({ value: m, label: m }))}
                />
              </div>

              <DayConfigEditor days={config.days} onChange={(days) => setConfig({ ...config, days })} />

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Atrás
                </Button>
                <Button onClick={() => void handleSubmit()} loading={loading}>
                  Guardar y continuar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
