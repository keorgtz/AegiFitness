import type { MealLogDto, MealPlanDto, MeDto, WorkoutLogDto, WorkoutPlanDto } from "../types/api";
import { dayName, mealTypeName, modalityName, muscleGroupName, parseDate } from "./format";

export type ExportContent = "training" | "nutrition" | "both";
export type ExportPeriod = "day" | "week" | "month";

export interface ExportBundle {
  user: Pick<MeDto, "displayName" | "username">;
  content: ExportContent;
  period: ExportPeriod;
  from: string;
  to: string;
  generatedAt: string;
  workoutPlan?: WorkoutPlanDto;
  workoutLogs: WorkoutLogDto[];
  mealPlans: MealPlanDto[];
  mealLogs: MealLogDto[];
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" });

export function humanDate(value: string): string {
  return dateFormatter.format(parseDate(value));
}

export function periodLabel(period: ExportPeriod): string {
  return { day: "Diario", week: "Semanal", month: "Mensual" }[period];
}

export function contentLabel(content: ExportContent): string {
  return { training: "Entrenamiento", nutrition: "Nutrición", both: "Entrenamiento y nutrición" }[content];
}

export function reportFilename(bundle: ExportBundle, extension: "html" | "md"): string {
  const content = { training: "rutina", nutrition: "dieta", both: "bienestar" }[bundle.content];
  return `aegifitness-${content}-${bundle.period}-${bundle.from}-${bundle.to}.${extension}`;
}

export function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printHtmlReport(html: string): boolean {
  const popup = window.open("", "_blank", "popup,width=980,height=760");
  if (!popup) return false;
  popup.addEventListener("load", () => window.setTimeout(() => popup.print(), 250), { once: true });
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = parseDate(from);
  const end = parseDate(to);
  while (cursor <= end) {
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function md(value: unknown): string {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function html(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markdownTraining(bundle: ExportBundle, dates: string[]): string[] {
  const lines: string[] = ["## Entrenamiento", ""];
  const logs = new Map(bundle.workoutLogs.map((log) => [log.date, log]));
  for (const date of dates) {
    const weekday = parseDate(date).getDay();
    const planDay = bundle.workoutPlan?.days.find((day) => day.dayOfWeek === weekday);
    const log = logs.get(date);
    lines.push(`### ${dayName(weekday)}, ${humanDate(date)}`, "");
    if (planDay) {
      lines.push(`**Plan recomendado:** ${md(modalityName(planDay.modality))}${planDay.focus ? ` - ${md(planDay.focus)}` : ""}`, "");
      if (planDay.items.length) {
        lines.push("| Ejercicio | Grupo | Series | Repeticiones | Descanso |", "|---|---|---:|---:|---:|");
        for (const item of planDay.items) lines.push(`| ${md(item.exercise.name)} | ${md(muscleGroupName(item.exercise.muscleGroup))} | ${item.sets} | ${item.repsMin}-${item.repsMax} | ${item.restSeconds}s |`);
        lines.push("");
      } else lines.push("Día de descanso.", "");
    }
    lines.push("**Registro realizado**", "");
    if (!log?.entries.length) {
      lines.push("Sin entrenamiento registrado.", "");
    } else {
      lines.push("| Ejercicio | Estado | Series | Repeticiones | Peso |", "|---|---|---:|---:|---:|");
      for (const entry of log.entries) lines.push(`| ${md(entry.exercise.name)} | ${entry.completed ? "Completado" : "Pendiente"} | ${entry.actualSets ?? entry.plannedSets} | ${entry.actualReps ?? entry.plannedReps} | ${entry.actualWeightKg ? `${entry.actualWeightKg} kg` : "-"} |`);
      lines.push("");
    }
  }
  return lines;
}

function markdownNutrition(bundle: ExportBundle, dates: string[]): string[] {
  const lines: string[] = ["## Nutrición", ""];
  const plans = new Map(bundle.mealPlans.map((plan) => [plan.date, plan]));
  const logs = new Map(bundle.mealLogs.map((log) => [log.date, log]));
  for (const date of dates) {
    const weekday = parseDate(date).getDay();
    const plan = plans.get(date);
    const log = logs.get(date);
    lines.push(`### ${dayName(weekday)}, ${humanDate(date)}`, "");
    lines.push("**Plan recomendado**", "");
    if (!plan?.items.length) {
      lines.push("Sin dieta planificada.", "");
    } else {
      lines.push(`Objetivo diario: ${plan.targetCalories} kcal, ${plan.targetProteinG} g proteína, ${plan.targetCarbsG} g carbohidratos y ${plan.targetFatG} g grasas.`, "");
      lines.push("| Tiempo | Platillo | Porciones | Kcal | Proteína | Carbos | Grasas |", "|---|---|---:|---:|---:|---:|---:|");
      for (const item of plan.items) lines.push(`| ${md(mealTypeName(item.mealType))} | ${md(item.food.name)} | ${item.servings} | ${Math.round(item.food.calories * item.servings)} | ${Math.round(item.food.proteinG * item.servings)} g | ${Math.round(item.food.carbsG * item.servings)} g | ${Math.round(item.food.fatG * item.servings)} g |`);
      lines.push("");
    }
    lines.push("**Registro realizado**", "");
    if (!log?.entries.length) {
      lines.push("Sin comidas registradas.", "");
    } else {
      lines.push("| Tiempo | Alimento | Porciones | Kcal | Proteína | Carbos | Grasas |", "|---|---|---:|---:|---:|---:|---:|");
      for (const entry of log.entries) lines.push(`| ${md(mealTypeName(entry.mealType))} | ${md(entry.food?.name ?? entry.customName ?? "Comida")} | ${entry.servings} | ${entry.calories} | ${entry.proteinG} g | ${entry.carbsG} g | ${entry.fatG} g |`);
      lines.push("");
    }
  }
  return lines;
}

export function buildMarkdownReport(bundle: ExportBundle): string {
  const dates = dateRange(bundle.from, bundle.to);
  const period = bundle.from === bundle.to ? humanDate(bundle.from) : `${humanDate(bundle.from)} al ${humanDate(bundle.to)}`;
  const lines = [
    "# AegiFitness - Reporte personal",
    "",
    `**Usuario:** ${md(bundle.user.displayName)} (@${md(bundle.user.username)})`,
    `**Contenido:** ${contentLabel(bundle.content)}`,
    `**Período:** ${periodLabel(bundle.period)} - ${period}`,
    `**Generado:** ${dateTimeFormatter.format(new Date(bundle.generatedAt))}`,
    "",
    "> Este documento distingue el plan recomendado del registro realmente realizado.",
    "",
  ];
  if (bundle.content !== "nutrition") lines.push(...markdownTraining(bundle, dates));
  if (bundle.content !== "training") lines.push(...markdownNutrition(bundle, dates));
  lines.push("---", "Generado por AegiFitness.");
  return lines.join("\n");
}

function htmlTraining(bundle: ExportBundle, dates: string[]): string {
  const logs = new Map(bundle.workoutLogs.map((log) => [log.date, log]));
  return `<section><h2><span class="section-icon training">T</span> Entrenamiento</h2>${dates.map((date) => {
    const weekday = parseDate(date).getDay();
    const planDay = bundle.workoutPlan?.days.find((day) => day.dayOfWeek === weekday);
    const log = logs.get(date);
    const planRows = planDay?.items.map((item) => `<tr><td>${html(item.exercise.name)}</td><td>${html(muscleGroupName(item.exercise.muscleGroup))}</td><td>${item.sets}</td><td>${item.repsMin}-${item.repsMax}</td><td>${item.restSeconds}s</td></tr>`).join("") ?? "";
    const logRows = log?.entries.map((entry) => `<tr><td>${html(entry.exercise.name)}</td><td><span class="status ${entry.completed ? "done" : "pending"}">${entry.completed ? "Completado" : "Pendiente"}</span></td><td>${entry.actualSets ?? entry.plannedSets}</td><td>${entry.actualReps ?? entry.plannedReps}</td><td>${entry.actualWeightKg ? `${entry.actualWeightKg} kg` : "-"}</td></tr>`).join("") ?? "";
    return `<article class="day"><h3>${html(dayName(weekday))}<small>${html(humanDate(date))}</small></h3><div class="subsection"><h4>Plan recomendado</h4>${planDay ? `<p class="context">${html(modalityName(planDay.modality))}${planDay.focus ? ` · ${html(planDay.focus)}` : ""}</p>${planRows ? `<div class="table-wrap"><table><thead><tr><th>Ejercicio</th><th>Grupo</th><th>Series</th><th>Reps</th><th>Descanso</th></tr></thead><tbody>${planRows}</tbody></table></div>` : `<p class="empty">Día de descanso.</p>`}` : `<p class="empty">Sin rutina recomendada.</p>`}</div><div class="subsection"><h4>Registro realizado</h4>${logRows ? `<div class="table-wrap"><table><thead><tr><th>Ejercicio</th><th>Estado</th><th>Series</th><th>Reps</th><th>Peso</th></tr></thead><tbody>${logRows}</tbody></table></div>` : `<p class="empty">Sin entrenamiento registrado.</p>`}</div></article>`;
  }).join("")}</section>`;
}

function htmlNutrition(bundle: ExportBundle, dates: string[]): string {
  const plans = new Map(bundle.mealPlans.map((plan) => [plan.date, plan]));
  const logs = new Map(bundle.mealLogs.map((log) => [log.date, log]));
  return `<section><h2><span class="section-icon nutrition">N</span> Nutrición</h2>${dates.map((date) => {
    const weekday = parseDate(date).getDay();
    const plan = plans.get(date);
    const log = logs.get(date);
    const planRows = plan?.items.map((item) => `<tr><td>${html(mealTypeName(item.mealType))}</td><td>${html(item.food.name)}</td><td>${item.servings}</td><td>${Math.round(item.food.calories * item.servings)}</td><td>${Math.round(item.food.proteinG * item.servings)} g</td><td>${Math.round(item.food.carbsG * item.servings)} g</td><td>${Math.round(item.food.fatG * item.servings)} g</td></tr>`).join("") ?? "";
    const logRows = log?.entries.map((entry) => `<tr><td>${html(mealTypeName(entry.mealType))}</td><td>${html(entry.food?.name ?? entry.customName ?? "Comida")}</td><td>${entry.servings}</td><td>${entry.calories}</td><td>${entry.proteinG} g</td><td>${entry.carbsG} g</td><td>${entry.fatG} g</td></tr>`).join("") ?? "";
    return `<article class="day"><h3>${html(dayName(weekday))}<small>${html(humanDate(date))}</small></h3><div class="subsection"><h4>Plan recomendado</h4>${plan ? `<div class="targets"><span>${plan.targetCalories} kcal</span><span>${plan.targetProteinG} g proteína</span><span>${plan.targetCarbsG} g carbos</span><span>${plan.targetFatG} g grasas</span></div>${planRows ? `<div class="table-wrap"><table><thead><tr><th>Tiempo</th><th>Platillo</th><th>Porciones</th><th>Kcal</th><th>Proteína</th><th>Carbos</th><th>Grasas</th></tr></thead><tbody>${planRows}</tbody></table></div>` : `<p class="empty">Sin dieta planificada.</p>`}` : `<p class="empty">Sin dieta planificada.</p>`}</div><div class="subsection"><h4>Registro realizado</h4>${logRows ? `<div class="table-wrap"><table><thead><tr><th>Tiempo</th><th>Alimento</th><th>Porciones</th><th>Kcal</th><th>Proteína</th><th>Carbos</th><th>Grasas</th></tr></thead><tbody>${logRows}</tbody></table></div>` : `<p class="empty">Sin comidas registradas.</p>`}</div></article>`;
  }).join("")}</section>`;
}

export function buildHtmlReport(bundle: ExportBundle): string {
  const dates = dateRange(bundle.from, bundle.to);
  const period = bundle.from === bundle.to ? humanDate(bundle.from) : `${humanDate(bundle.from)} al ${humanDate(bundle.to)}`;
  const body = `${bundle.content !== "nutrition" ? htmlTraining(bundle, dates) : ""}${bundle.content !== "training" ? htmlNutrition(bundle, dates) : ""}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AegiFitness - ${html(contentLabel(bundle.content))}</title><style>
  :root{font-family:Inter,Arial,sans-serif;color:#1b1c2c;background:#f5f6fb}*{box-sizing:border-box}body{margin:0;padding:32px}.report{max-width:1050px;margin:auto;background:#fff;border:1px solid #e7e9f4;border-radius:24px;overflow:hidden;box-shadow:0 12px 35px #24254218}.cover{padding:34px;background:linear-gradient(135deg,#f0edff,#fff0f5 58%,#eafbf5)}.brand{font-weight:800;color:#6f54ee;letter-spacing:.02em}.cover h1{margin:12px 0 8px;font-size:30px}.subtitle{margin:0;color:#5b5e75}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:26px}.meta div{padding:12px 14px;background:#ffffffb8;border:1px solid #ddd9f4;border-radius:14px}.meta small{display:block;color:#777b8c;margin-bottom:4px}.notice{margin:18px 34px 0;padding:12px 15px;border-left:4px solid #7b61ff;background:#f5f2ff;color:#4f496f;border-radius:8px}.content{padding:20px 34px 38px}section{margin-top:28px}h2{display:flex;align-items:center;gap:10px;font-size:22px;border-bottom:2px solid #eceaf7;padding-bottom:10px}.section-icon{width:30px;height:30px;display:inline-grid;place-items:center;border-radius:9px;font-size:13px}.section-icon.training{background:#eeeaff;color:#674ee0}.section-icon.nutrition{background:#e5f8f1;color:#087c5e}.day{break-inside:avoid;margin:18px 0 28px;border:1px solid #e7e9f4;border-radius:16px;overflow:hidden}.day h3{margin:0;padding:14px 18px;background:#f7f7fb;font-size:17px}.day h3 small{display:block;margin-top:3px;color:#777b8c;font-size:12px;font-weight:500}.subsection{padding:15px 18px}.subsection+.subsection{border-top:1px solid #eceef5}h4{margin:0 0 10px;color:#4e5064}.context{color:#686b80;margin:-3px 0 10px}.targets{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:11px}.targets span{padding:5px 9px;background:#f1efff;border-radius:99px;color:#5946bd;font-size:11px;font-weight:700}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #eceef5;vertical-align:top}th{color:#686b80;background:#fafafd;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.status{font-weight:700}.status.done{color:#087c5e}.status.pending{color:#a85d09}.empty{margin:0;color:#8b8ea5;font-style:italic}.footer{text-align:center;padding:16px;color:#777b8c;font-size:11px;border-top:1px solid #eceef5}@page{size:A4;margin:12mm}@media print{:root{background:#fff}body{padding:0}.report{max-width:none;border:0;border-radius:0;box-shadow:none}.cover{padding:20px 24px}.content{padding:10px 24px 20px}.notice{margin:12px 24px 0}.day{break-inside:avoid}section{break-before:auto}a{color:inherit}}@media(max-width:640px){body{padding:10px}.cover,.content{padding:20px}.meta{grid-template-columns:1fr}.notice{margin:14px 20px 0}.day{border-radius:12px}}
  </style></head><body><main class="report"><header class="cover"><div class="brand">AEGIFITNESS</div><h1>${html(contentLabel(bundle.content))}</h1><p class="subtitle">Reporte personal ${html(periodLabel(bundle.period).toLowerCase())}</p><div class="meta"><div><small>Usuario</small><strong>${html(bundle.user.displayName)}</strong><br><small>@${html(bundle.user.username)}</small></div><div><small>Período cubierto</small><strong>${html(period)}</strong></div><div><small>Fecha de generación</small><strong>${html(dateTimeFormatter.format(new Date(bundle.generatedAt)))}</strong></div><div><small>Contenido</small><strong>${html(contentLabel(bundle.content))}</strong></div></div></header><div class="notice">El plan recomendado y el registro realizado se presentan por separado para evitar confusiones.</div><div class="content">${body}</div><footer class="footer">Generado por AegiFitness</footer></main></body></html>`;
}
