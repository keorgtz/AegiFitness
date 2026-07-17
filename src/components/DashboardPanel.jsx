import { useState, useEffect, useMemo } from "react";
import {
	ChevronLeft,
	ChevronRight,
	TrendingUp,
	TrendingDown,
	Utensils,
	Dumbbell,
	Scale,
	Flame,
	Target,
	Activity,
	CalendarDays,
	Apple,
	Sparkles,
	Trophy,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import mealsData from "../data/meals.json";
import BarChart from "./BarChart";
import RingProgress from "./RingProgress";
import SegmentedControl from "./SegmentedControl";

const DAY_LABELS_ES = ["L", "M", "X", "J", "V", "S", "D"];

const imcMeta = (imc) => {
	if (imc < 18.5)
		return {
			label: "Bajo peso",
			shortLabel: "Bajo",
			status: "warn",
			color: "#fbbf24",
		};
	if (imc < 24.9)
		return {
			label: "Peso ideal",
			shortLabel: "Normal",
			status: "good",
			color: "#34d399",
		};
	if (imc < 29.9)
		return {
			label: "Sobrepeso",
			shortLabel: "Sobrepeso",
			status: "warn",
			color: "#fb923c",
		};
	return {
		label: "Obesidad",
		shortLabel: "Obesidad",
		status: "danger",
		color: "#f87171",
	};
};

const DashboardPanel = ({ userData }) => {
	const [viewMode, setViewMode] = useState("week");
	const [currentDate, setCurrentDate] = useState(new Date());

	const [dietHistory, setDietHistory] = useState([]);
	const [routineHistory, setRoutineHistory] = useState([]);

	useEffect(() => {
		try {
			setDietHistory(
				JSON.parse(localStorage.getItem("aegifitness_diet_history") || "[]"),
			);
			setRoutineHistory(
				JSON.parse(localStorage.getItem("aegifitness_history") || "[]"),
			);
		} catch {
			setDietHistory([]);
			setRoutineHistory([]);
		}
	}, []);

	const {
		imc,
		imcInfo,
		targetAumento,
		targetDefinicion,
		currentObj,
		dailyTarget,
	} = useMemo(() => {
		const w = parseFloat(userData.weight) || 70;
		const h = parseFloat(userData.height) || 175;
		const i = (w / Math.pow(h / 100, 2)).toFixed(1);
		const info = imcMeta(parseFloat(i));
		const m = 10 * w + 6.25 * h - 5 * 25 + 5;
		const maint = Math.round(m * 1.55);
		const inc = maint + 400;
		const cut = maint - 400;
		const planKey = Object.keys(localStorage).find((k) =>
			k.startsWith("aegifitness_diet_plan_"),
		);
		const obj = planKey
			? planKey.replace("aegifitness_diet_plan_", "")
			: "Aumento";
		const target = obj === "Aumento" ? inc : cut;
		return {
			imc: i,
			imcInfo: info,
			targetAumento: inc,
			targetDefinicion: cut,
			currentObj: obj,
			dailyTarget: target,
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userData, dietHistory]);

	// Period boundaries
	const { startOf, endOf } = useMemo(() => {
		const start = new Date(currentDate);
		if (viewMode === "week") {
			const day = start.getDay();
			const diff = day === 0 ? -6 : 1 - day;
			start.setDate(start.getDate() + diff);
		} else {
			start.setDate(1);
		}
		start.setHours(0, 0, 0, 0);
		const end = new Date(start);
		if (viewMode === "week") {
			end.setDate(start.getDate() + 6);
		} else {
			end.setMonth(start.getMonth() + 1);
			end.setDate(0);
		}
		end.setHours(23, 59, 59, 999);
		return { startOf: start, endOf: end };
	}, [currentDate, viewMode]);

	const periodDiet = useMemo(
		() =>
			dietHistory.filter((h) => {
				const d = new Date(h.date);
				return d >= startOf && d <= endOf;
			}),
		[dietHistory, startOf, endOf],
	);
	const periodRout = useMemo(
		() =>
			routineHistory.filter((h) => {
				const d = new Date(h.date);
				return d >= startOf && d <= endOf;
			}),
		[routineHistory, startOf, endOf],
	);

	// Today
	const today = new Date();
	const todayData = useMemo(() => {
		const todayKey = new Date().toDateString();
		const isSame = (d) => new Date(d).toDateString() === todayKey;
		const diets = dietHistory.filter((h) => isSame(h.date));
		const routines = routineHistory.filter((h) => isSame(h.date));
		return {
			calsIn: diets.reduce((s, d) => s + d.calories, 0),
			calsOut: routines.reduce((s, r) => s + r.caloriesBurned, 0),
			diets,
			routines,
		};
	}, [dietHistory, routineHistory]);

	const calsDiff = todayData.calsIn - dailyTarget;

	// Last 7 days chart (independent of view mode — always weekly)
	const chartData = useMemo(() => {
		const out = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const isSame = (date) =>
				new Date(date).toDateString() === d.toDateString();
			const cIn = dietHistory
				.filter((h) => isSame(h.date))
				.reduce((s, x) => s + x.calories, 0);
			const cOut = routineHistory
				.filter((h) => isSame(h.date))
				.reduce((s, x) => s + x.caloriesBurned, 0);
			out.push({
				label: DAY_LABELS_ES[d.getDay() === 0 ? 6 : d.getDay() - 1],
				values: [cIn, cOut],
			});
		}
		return out;
	}, [dietHistory, routineHistory]);

	const navPrev = () => {
		const d = new Date(currentDate);
		if (viewMode === "week") d.setDate(d.getDate() - 7);
		else d.setMonth(d.getMonth() - 1);
		setCurrentDate(d);
	};
	const navNext = () => {
		const d = new Date(currentDate);
		if (viewMode === "week") d.setDate(d.getDate() + 7);
		else d.setMonth(d.getMonth() + 1);
		setCurrentDate(d);
	};

	const formatDateLabel = () => {
		if (viewMode === "month") {
			return currentDate.toLocaleString("es-ES", {
				month: "long",
				year: "numeric",
			});
		}
		const d1 = startOf.getDate();
		const m1 = startOf.toLocaleString("es-ES", { month: "short" });
		const d2 = endOf.getDate();
		const m2 = endOf.toLocaleString("es-ES", { month: "short" });
		return `${d1} ${m1} – ${d2} ${m2}`;
	};

	// Timeline
	const daysInPeriod = useMemo(() => {
		const days = [];
		const curr = new Date(startOf);
		while (curr <= endOf) {
			days.push(new Date(curr));
			curr.setDate(curr.getDate() + 1);
		}
		return days.reverse();
	}, [startOf, endOf]);

	const getDayData = (date) => {
		const isSame = (dStr) =>
			new Date(dStr).toDateString() === date.toDateString();
		const diets = dietHistory.filter((h) => isSame(h.date));
		const routines = routineHistory.filter((h) => isSame(h.date));
		return {
			calsIn: diets.reduce((s, d) => s + d.calories, 0),
			calsOut: routines.reduce((s, r) => s + r.caloriesBurned, 0),
			diets,
			routines,
		};
	};

	const getMealName = (id) =>
		mealsData.find((m) => m.id === id)?.name || "Comida";

	// Streak: consecutive days with at least one routine recorded
	const streak = useMemo(() => {
		const set = new Set(
			routineHistory.map((r) => new Date(r.date).toDateString()),
		);
		let count = 0;
		const cursor = new Date();
		while (set.has(cursor.toDateString())) {
			count++;
			cursor.setDate(cursor.getDate() - 1);
		}
		return count;
	}, [routineHistory]);

	const periodCalsIn = periodDiet.reduce((s, h) => s + h.calories, 0);
	const periodCalsOut = periodRout.reduce((s, h) => s + h.caloriesBurned, 0);

	return (
		<div className="panel">
			{/* HERO */}
			<section className="hero hero--dashboard">
				<div className="hero__label">
					<Sparkles size={14} /> Tu progreso
				</div>
				<h1 className="hero__title">
					¡Vamos, <span className="accent">constancia</span> es todo!
				</h1>
				<p className="hero__subtitle">
					Revisa tus calorías, rutinas y evolución. Ajusta lo necesario para
					mantener el rumbo.
				</p>
			</section>

			{/* IMC big card */}
			<div className="imc-card">
				<RingProgress
					value={Math.max(0, parseFloat(imc) - 16)}
					max={20}
					color={["#22d3ee", "#bef264"]}
					insideValue={Math.round(parseFloat(imc) * 10) / 10}
					insideUnit=""
					showPercent={false}
					unit=""
					size={110}
					label="kg/m²"
				/>
				<div className="imc-card__meta">
					<span
						style={{
							fontSize: "0.75rem",
							textTransform: "uppercase",
							letterSpacing: "0.1em",
							color: "var(--text-muted)",
							fontWeight: 700,
						}}
					>
						<Scale size={12} style={{ display: "inline", marginRight: 4 }} />{" "}
						Índice de masa corporal
					</span>
					<div
						className={`imc-card__status imc-card__status--${imcInfo.status}`}
					>
						<span
							style={{
								width: 8,
								height: 8,
								borderRadius: "50%",
								background: imcInfo.color,
								boxShadow: `0 0 8px ${imcInfo.color}`,
							}}
						/>
						{imcInfo.label}
					</div>
					<div className="imc-card__scale">
						<span>16</span>
						<span>22</span>
						<span>28</span>
						<span>34+</span>
					</div>
				</div>
			</div>

			{/* Today balance — main attraction */}
			<div className="balance-card">
				<RingProgress
					value={todayData.calsIn}
					max={dailyTarget}
					color={
						todayData.calsIn > dailyTarget
							? ["#fb7185", "#be123c"]
							: ["#bef264", "#84cc16"]
					}
					label="de meta"
					showPercent={true}
				/>
				<div className="balance-card__meta">
					<span className="balance-card__title">
						<Target
							size={16}
							style={{
								display: "inline",
								marginRight: 6,
								color: "var(--brand-primary)",
							}}
						/>
						Balance de hoy · {currentObj}
					</span>
					<div className="balance-card__kcal">
						{todayData.calsIn} <small>kcal ingeridas</small>
					</div>
					<p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
						de {dailyTarget} kcal recomendadas para {currentObj.toLowerCase()}.
					</p>

					<div style={{ marginTop: 12 }}>
						<div className="balance-card__row">
							<span>Quemadas (rutinas)</span>
							<strong style={{ color: "var(--brand-coral)" }}>
								{todayData.calsOut} kcal
							</strong>
						</div>
						<div className="balance-card__row">
							<span>Comidas registradas</span>
							<strong>{todayData.diets.length}</strong>
						</div>
						<div className="balance-card__row">
							<span>Rutinas registradas</span>
							<strong>{todayData.routines.length}</strong>
						</div>
					</div>

					<div
						style={{
							marginTop: 12,
							padding: "10px 14px",
							borderRadius: 12,
							background:
								calsDiff > 0
									? "rgba(248, 113, 113, 0.12)"
									: "rgba(52, 211, 153, 0.12)",
							color: calsDiff > 0 ? "var(--brand-coral)" : "var(--success)",
							fontSize: "0.85rem",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: 8,
						}}
					>
						{calsDiff > 0 ? (
							<>
								<AlertCircle size={16} /> +{calsDiff} kcal por encima de la meta
							</>
						) : calsDiff < 0 ? (
							<>
								<CheckCircle2 size={16} /> Aún tienes {Math.abs(calsDiff)} kcal
								de margen
							</>
						) : (
							<>
								<CheckCircle2 size={16} /> ¡Meta exacta! Excelente control.
							</>
						)}
					</div>
				</div>
			</div>

			{/* STAT CARDS */}
			<div className="stat-grid">
				<div className="stat-card stat-card--cyan">
					<div className="stat-card__icon">
						<TrendingUp size={18} color="#22d3ee" />
					</div>
					<div className="stat-card__label">Aumento</div>
					<div className="stat-card__value">
						{targetAumento}
						<span className="stat-card__unit">kcal</span>
					</div>
					<span className="stat-card__trend stat-card__trend--up">
						<TrendingUp size={12} /> superávit
					</span>
				</div>

				<div className="stat-card stat-card--lime">
					<div className="stat-card__icon">
						<TrendingDown size={18} color="#bef264" />
					</div>
					<div className="stat-card__label">Definición</div>
					<div className="stat-card__value">
						{targetDefinicion}
						<span className="stat-card__unit">kcal</span>
					</div>
					<span className="stat-card__trend stat-card__trend--down">
						<TrendingDown size={12} /> déficit
					</span>
				</div>

				<div className="stat-card stat-card--coral">
					<div className="stat-card__icon">
						<Flame size={18} color="#fb7185" />
					</div>
					<div className="stat-card__label">Quemadas</div>
					<div className="stat-card__value">
						{todayData.calsOut}
						<span className="stat-card__unit">kcal</span>
					</div>
					<span className="stat-card__trend stat-card__trend--neutral">
						hoy
					</span>
				</div>

				<div className="stat-card stat-card--violet">
					<div className="stat-card__icon">
						<Trophy size={18} color="#a78bfa" />
					</div>
					<div className="stat-card__label">Racha</div>
					<div className="stat-card__value">
						{streak}
						<span className="stat-card__unit">días</span>
					</div>
					<span className="stat-card__trend stat-card__trend--up">
						<Trophy size={12} /> {streak > 0 ? "¡Sigue así!" : "¡Empieza hoy!"}
					</span>
				</div>
			</div>

			{/* WEEKLY CHART */}
			<div className="card card--elevated mb-4">
				<h3 className="card__title">
					<Activity size={20} /> Última semana
				</h3>
				<BarChart data={chartData} />
			</div>

			{/* TIMELINE TOOLBAR */}
			<div className="section-title">
				<span>Tu historial</span>
				<span className="section-title__hint">Detalle por día</span>
			</div>

			<div className="timeline-toolbar">
				<SegmentedControl
					value={viewMode}
					onChange={setViewMode}
					options={[
						{ value: "week", label: "Semana" },
						{ value: "month", label: "Mes" },
					]}
				/>
				<div className="timeline-nav">
					<button
						type="button"
						className="btn-icon"
						onClick={navPrev}
						aria-label="Periodo anterior"
					>
						<ChevronLeft size={18} />
					</button>
					<span className="timeline-nav__label">{formatDateLabel()}</span>
					<button
						type="button"
						className="btn-icon"
						onClick={navNext}
						aria-label="Periodo siguiente"
					>
						<ChevronRight size={18} />
					</button>
				</div>
			</div>

			{/* Period summary pills */}
			<div className="timeline-pills">
				<span className="chip">
					<Apple size={14} color="var(--brand-primary)" /> {periodCalsIn} kcal
					ingeridas
				</span>
				<span className="chip">
					<Flame size={14} color="var(--brand-coral)" /> {periodCalsOut} kcal
					quemadas
				</span>
				<span className="chip">
					<Activity size={14} color="var(--brand-violet)" /> {periodRout.length}{" "}
					rutinas
				</span>
			</div>

			{/* TIMELINE */}
			<div className="timeline">
				{daysInPeriod.length === 0 && (
					<div className="empty">
						<div className="empty__icon">
							<CalendarDays size={28} />
						</div>
						<p className="empty__title">Sin actividad en este periodo</p>
						<p>Prueba navegar a otro rango de fechas.</p>
					</div>
				)}

				{daysInPeriod.map((date) => {
					const day = getDayData(date);
					const isToday = date.toDateString() === today.toDateString();

					if (day.calsIn === 0 && day.calsOut === 0 && !isToday) return null;

					return (
						<div
							key={date.toISOString()}
							className={`timeline__day ${isToday ? "timeline__day--today" : ""}`}
						>
							<div className="timeline__day-head">
								<div
									className={`timeline__day-title ${isToday ? "timeline__day-title--today" : ""}`}
								>
									<CalendarDays size={16} />
									{isToday
										? "Hoy"
										: date.toLocaleDateString("es-ES", {
												weekday: "long",
												day: "numeric",
												month: "short",
											})}
								</div>
								<div className="row gap-2">
									<span className="chip">
										<Utensils size={12} color="var(--brand-primary)" />{" "}
										{day.calsIn}
									</span>
									<span className="chip">
										<Dumbbell size={12} color="var(--brand-coral)" />{" "}
										{day.calsOut}
									</span>
								</div>
							</div>

							<div>
								{day.routines.map((r, i) => (
									<div key={`r-${i}`} className="timeline__event">
										<div className="timeline__event-icon timeline__event-icon--rout">
											<Activity size={16} />
										</div>
										<div className="timeline__event-meta">
											<span className="timeline__event-name">
												Rutina {r.type} completada
											</span>
											<span className="timeline__event-sub">
												{r.timeSpent} min ·{" "}
												{(r.completionRate * 100).toFixed(0)}% completado
											</span>
										</div>
									</div>
								))}

								{day.diets.length > 0 && (
									<div className="timeline__event">
										<div className="timeline__event-icon timeline__event-icon--diet">
											<Apple size={16} />
										</div>
										<div className="timeline__event-meta">
											<span className="timeline__event-name">
												{day.diets.length} comidas registradas
											</span>
											<span className="timeline__event-sub">
												{day.diets.map((d) => getMealName(d.mealId)).join(", ")}
											</span>
										</div>
									</div>
								)}

								{day.calsIn === 0 && day.calsOut === 0 && isToday && (
									<p
										style={{
											color: "var(--text-dim)",
											fontSize: "0.85rem",
											fontStyle: "italic",
										}}
									>
										Aún no hay registros. Pasa por Rutinas o Dieta para empezar.
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default DashboardPanel;
