export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return formatDate(new Date());
}

export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek % 7] ?? "";
}

export function shortDayName(dayOfWeek: number): string {
  const name = dayName(dayOfWeek);
  return name.slice(0, 3);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function initials(name: string): string {
  const source = name.trim();
  if (!source) return "AF";
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function bmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return round(weightKg / (h * h), 1);
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function muscleGroupName(mg: string): string {
  const map: Record<string, string> = {
    Chest: "Pecho",
    Back: "Espalda",
    Legs: "Piernas",
    Shoulders: "Hombros",
    Biceps: "Bíceps",
    Triceps: "Tríceps",
    Core: "Core",
  };
  return map[mg] ?? mg;
}

export function modalityName(m: string): string {
  const map: Record<string, string> = {
    Rest: "Descanso",
    Gym: "Gimnasio",
    Calisthenics: "Calistenia",
    Both: "Ambos",
  };
  return map[m] ?? m;
}

export function goalName(g: string): string {
  const map: Record<string, string> = {
    Recomposition: "Recomposición",
    Bulk: "Volumen",
    Cut: "Definición",
  };
  return map[g] ?? g;
}

export function mealTypeName(mt: string): string {
  const map: Record<string, string> = {
    Breakfast: "Desayuno",
    Lunch: "Comida",
    Dinner: "Cena",
    Snack: "Snack",
  };
  return map[mt] ?? mt;
}

export function gymModeName(gm: string): string {
  const map: Record<string, string> = {
    Bodybuilding: "Culturismo",
    Health: "Salud",
    Combined: "Combinado",
  };
  return map[gm] ?? gm;
}

export function calisthenicsModeName(cm: string): string {
  const map: Record<string, string> = {
    Classic: "Clásica",
    Military: "Militar",
    CrossFit: "CrossFit",
  };
  return map[cm] ?? cm;
}

export function licenseStatusName(status: string): string {
  const map: Record<string, string> = {
    Pending: "Pendiente",
    Active: "Activa",
    Suspended: "Suspendida",
    Expired: "Expirada",
    Revoked: "Revocada",
  };
  return map[status] ?? status;
}

export function goalTypeName(type: string): string {
  const map: Record<string, string> = {
    TargetWeight: "Peso objetivo",
    WeeklyWorkouts: "Entrenos semanales",
    DailyProtein: "Proteína diaria",
    Custom: "Personalizada",
  };
  return map[type] ?? type;
}

export function goalStatusName(status: string): string {
  const map: Record<string, string> = {
    Active: "Activa",
    Completed: "Completada",
    Abandoned: "Abandonada",
  };
  return map[status] ?? status;
}

export function achievementCategoryName(cat: string): string {
  const map: Record<string, string> = {
    Training: "Entrenamiento",
    Nutrition: "Nutrición",
    Consistency: "Constancia",
    Progress: "Progreso",
    Special: "Especial",
  };
  return map[cat] ?? cat;
}
