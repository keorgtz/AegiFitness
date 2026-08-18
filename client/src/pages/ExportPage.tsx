import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { mealLogApi, mealPlanApi, workoutLogApi, workoutPlanApi } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorState, SegmentedControl } from "../components/ui";
import { useToastCtx } from "../hooks/useToastContext";
import { addDays, formatDate, parseDate, today } from "../utils/format";
import {
  buildHtmlReport,
  buildMarkdownReport,
  contentLabel,
  downloadText,
  humanDate,
  periodLabel,
  printHtmlReport,
  reportFilename,
  type ExportBundle,
  type ExportContent,
  type ExportPeriod,
} from "../utils/exportReport";

function getRange(period: ExportPeriod, anchor: string): { from: string; to: string } {
  if (period === "day") return { from: anchor, to: anchor };
  const date = parseDate(anchor);
  if (period === "week") {
    const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
    const from = addDays(anchor, mondayOffset);
    return { from, to: addDays(from, 6) };
  }
  const from = formatDate(new Date(date.getFullYear(), date.getMonth(), 1));
  const to = formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { from, to };
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let value = from; value <= to; value = addDays(value, 1)) dates.push(value);
  return dates;
}

async function loadMealPlans(dates: string[]) {
  const plans = new Array<Awaited<ReturnType<typeof mealPlanApi.forDate>>>(dates.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < dates.length) {
      const index = nextIndex++;
      plans[index] = await mealPlanApi.forDate(dates[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, dates.length) }, () => worker()));
  return plans;
}

export default function ExportPage() {
  const { user } = useAuth();
  const toast = useToastCtx();
  const [searchParams] = useSearchParams();
  const requestedContent = searchParams.get("content");
  const [content, setContent] = useState<ExportContent>(requestedContent === "training" || requestedContent === "nutrition" ? requestedContent : "both");
  const [period, setPeriod] = useState<ExportPeriod>("day");
  const [anchor, setAnchor] = useState(today());
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const range = useMemo(() => getRange(period, anchor), [period, anchor]);
  const dates = useMemo(() => enumerateDates(range.from, range.to), [range]);

  const invalidate = () => {
    setBundle(null);
    setError("");
  };

  const prepare = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const includesTraining = content !== "nutrition";
      const includesNutrition = content !== "training";
      const [workoutPlan, workoutLogs, mealPlans, mealLogs] = await Promise.all([
        includesTraining ? workoutPlanApi.current() : Promise.resolve(undefined),
        includesTraining ? workoutLogApi.get(range.from, range.to) : Promise.resolve([]),
        includesNutrition ? loadMealPlans(dates) : Promise.resolve([]),
        includesNutrition ? mealLogApi.get(range.from, range.to) : Promise.resolve([]),
      ]);
      setBundle({
        user: { displayName: user.displayName, username: user.username },
        content,
        period,
        from: range.from,
        to: range.to,
        generatedAt: new Date().toISOString(),
        workoutPlan,
        workoutLogs,
        mealPlans,
        mealLogs,
      });
    } catch (err) {
      setBundle(null);
      setError(err instanceof Error ? err.message : "No se pudo preparar la exportación.");
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!bundle) return null;
    const plannedExercises = dates.reduce((total, date) => total + (bundle.workoutPlan?.days.find((day) => day.dayOfWeek === parseDate(date).getDay())?.items.length ?? 0), 0);
    return {
      days: dates.length,
      plannedExercises,
      loggedExercises: bundle.workoutLogs.reduce((total, log) => total + log.entries.length, 0),
      plannedMeals: bundle.mealPlans.reduce((total, plan) => total + plan.items.length, 0),
      loggedMeals: bundle.mealLogs.reduce((total, log) => total + log.entries.length, 0),
    };
  }, [bundle, dates]);

  const downloadHtml = () => {
    if (!bundle) return;
    downloadText(reportFilename(bundle, "html"), buildHtmlReport(bundle), "text/html;charset=utf-8");
    toast.add("Reporte HTML descargado", "success");
  };

  const downloadMarkdown = () => {
    if (!bundle) return;
    downloadText(reportFilename(bundle, "md"), buildMarkdownReport(bundle), "text/markdown;charset=utf-8");
    toast.add("Reporte Markdown descargado", "success");
  };

  const exportPdf = () => {
    if (!bundle) return;
    if (printHtmlReport(buildHtmlReport(bundle))) toast.add("Selecciona “Guardar como PDF” en el diálogo de impresión", "info");
    else toast.add("El navegador bloqueó la ventana. Habilita ventanas emergentes e inténtalo de nuevo.", "error");
  };

  const rangeText = range.from === range.to ? humanDate(range.from) : `${humanDate(range.from)} al ${humanDate(range.to)}`;

  return <div className="page export-page">
    <div className="hero">
      <div className="hero__label"><span className="icon">download</span><span>Exportar</span></div>
      <h1 className="hero__title">Tu plan y tus registros, listos para llevar</h1>
      <p className="hero__subtitle">Crea un documento claro con el plan recomendado y lo que realmente registraste.</p>
    </div>

    <div className="export-layout">
      <section className="card export-builder" aria-labelledby="export-settings-title">
        <div className="section-title"><span id="export-settings-title">Configura el reporte</span><span className="section-title__hint">3 pasos</span></div>

        <div className="export-step">
          <div className="export-step__number">1</div>
          <div className="export-step__body"><label className="label">¿Qué quieres exportar?</label><div className="export-choice-grid">
            <button type="button" aria-pressed={content === "training"} className={`export-choice ${content === "training" ? "export-choice--active" : ""}`} onClick={() => { setContent("training"); invalidate(); }}><span className="icon">fitness_center</span><span><strong>Rutinas</strong><small>Plan y entrenamientos registrados</small></span><span className="icon export-choice__check">check_circle</span></button>
            <button type="button" aria-pressed={content === "nutrition"} className={`export-choice ${content === "nutrition" ? "export-choice--active" : ""}`} onClick={() => { setContent("nutrition"); invalidate(); }}><span className="icon">restaurant</span><span><strong>Dietas</strong><small>Plan y comidas registradas</small></span><span className="icon export-choice__check">check_circle</span></button>
            <button type="button" aria-pressed={content === "both"} className={`export-choice ${content === "both" ? "export-choice--active" : ""}`} onClick={() => { setContent("both"); invalidate(); }}><span className="icon">health_and_safety</span><span><strong>Todo</strong><small>Entrenamiento y nutrición</small></span><span className="icon export-choice__check">check_circle</span></button>
          </div></div>
        </div>

        <div className="export-step">
          <div className="export-step__number">2</div>
          <div className="export-step__body"><label className="label">Elige el período</label><SegmentedControl block value={period} onChange={(value) => { setPeriod(value); invalidate(); }} options={[{ value: "day", label: "Día" }, { value: "week", label: "Semana" }, { value: "month", label: "Mes" }]} /><div className="input-group export-date"><label className="input-group__label" htmlFor="export-date">{period === "day" ? "Fecha" : "Fecha dentro del período"}</label><input id="export-date" type="date" className="input" value={anchor} onChange={(event) => { setAnchor(event.target.value); invalidate(); }} /></div><div className="export-range"><span className="icon">date_range</span><span><small>Período que abarca</small><strong>{rangeText}</strong></span></div></div>
        </div>

        <div className="export-step export-step--last">
          <div className="export-step__number">3</div>
          <div className="export-step__body"><label className="label">Prepara la vista previa</label><p className="text-muted export-help">Se incluirá el usuario, fecha de generación, período, recomendaciones y registros reales.</p><Button block loading={loading} onClick={() => void prepare()}><span className="icon">preview</span>Preparar exportación</Button></div>
        </div>
        {error && <div className="mt-3"><ErrorState message={error} onRetry={() => void prepare()} /></div>}
      </section>

      <section className={`card export-preview ${bundle ? "export-preview--ready" : ""}`} aria-labelledby="export-preview-title">
        <div className="section-title"><span id="export-preview-title">Vista previa</span>{bundle && <span className="badge badge--success">Lista</span>}</div>
        {!bundle ? <div className="export-preview__empty"><span className="icon">description</span><strong>Tu documento aparecerá aquí</strong><p>Configura el contenido y prepara la exportación.</p></div> : <>
          <div className="export-document">
            <div className="export-document__brand">AEGIFITNESS</div>
            <h2>{contentLabel(bundle.content)}</h2>
            <p>Reporte personal {periodLabel(bundle.period).toLowerCase()}</p>
            <dl><div><dt>Usuario</dt><dd>{bundle.user.displayName}</dd></div><div><dt>Período</dt><dd>{rangeText}</dd></div><div><dt>Generado</dt><dd>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(bundle.generatedAt))}</dd></div></dl>
            {stats && <div className="export-summary">
              <div><strong>{stats.days}</strong><span>{stats.days === 1 ? "día" : "días"}</span></div>
              {bundle.content !== "nutrition" && <><div><strong>{stats.plannedExercises}</strong><span>ejercicios del plan</span></div><div><strong>{stats.loggedExercises}</strong><span>ejercicios registrados</span></div></>}
              {bundle.content !== "training" && <><div><strong>{stats.plannedMeals}</strong><span>comidas del plan</span></div><div><strong>{stats.loggedMeals}</strong><span>comidas registradas</span></div></>}
            </div>}
          </div>
          <div className="export-formats"><Button onClick={exportPdf}><span className="icon">picture_as_pdf</span>PDF</Button><Button variant="secondary" onClick={downloadHtml}><span className="icon">html</span>HTML</Button><Button variant="ghost" onClick={downloadMarkdown}><span className="icon">markdown</span>Markdown</Button></div>
          <p className="export-pdf-hint"><span className="icon">info</span>Para PDF, selecciona “Guardar como PDF” en la ventana de impresión.</p>
        </>}
      </section>
    </div>
  </div>;
}
