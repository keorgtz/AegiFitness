import { useState, useEffect, useMemo, useCallback } from "react";
import {
	Utensils,
	RefreshCw,
	CheckCircle,
	Search,
	Flame,
	Drumstick,
	Wheat,
	Cookie,
	Soup,
	Salad,
	Coffee,
	ArrowLeft,
	Sparkles,
	GlassWater,
	BookOpen,
	ChevronRight,
} from "lucide-react";
import SegmentedControl from "./SegmentedControl";
import RingProgress from "./RingProgress";
import RecipeDialog from "./RecipeDialog";
import { getRecentMealIds, pickMeal, appendDietHistory } from "../lib/rotation";
import mealsData from "../data/meals.json";

const MEAL_TYPES = ["Desayuno", "Almuerzo", "Cena", "Bebida"];

const MEAL_META = {
	Desayuno: {
		label: "Desayuno",
		hint: "Energía para arrancar",
		artClass: "",
		icon: Coffee,
	},
	Almuerzo: {
		label: "Almuerzo",
		hint: "Tu comida fuerte",
		artClass: "meal-card__art--lunch",
		icon: Salad,
	},
	Cena: {
		label: "Cena",
		hint: "Recuperación y descanso",
		artClass: "meal-card__art--dinner",
		icon: Soup,
	},
	Bebida: {
		label: "Bebida",
		hint: "Hidratación inteligente",
		artClass: "meal-card__art--drink",
		icon: GlassWater,
	},
};

const DietPanel = ({ userData, setUserData }) => {
	const currentObjective = userData?.currentObjective || "Aumento";
	const [objective, setObjective] = useState(currentObjective);

	// Stay in sync with userData.currentObjective (e.g. when toggled in Settings)
	useEffect(() => {
		setObjective(currentObjective);
	}, [currentObjective]);

	const handleObjectiveChange = (v) => {
		setObjective(v);
		if (setUserData && userData) {
			setUserData({ ...userData, currentObjective: v });
		}
	};

	const [todayMeals, setTodayMeals] = useState({
		Desayuno: null,
		Almuerzo: null,
		Cena: null,
		Bebida: null,
	});
	const [eaten, setEaten] = useState({
		Desayuno: false,
		Almuerzo: false,
		Cena: false,
		Bebida: false,
	});
	const [swapState, setSwapState] = useState(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [pulseEaten, setPulseEaten] = useState(null);
	const [recipeFor, setRecipeFor] = useState(null);

	// ---- persistence ----
	const generatePlan = useCallback((target) => {
		const recentMealIds = getRecentMealIds();
		const newPlan = {
			Desayuno: pickMeal("Desayuno", target, recentMealIds),
			Almuerzo: pickMeal("Almuerzo", target, recentMealIds),
			Cena: pickMeal("Cena", target, recentMealIds),
			Bebida: pickMeal("Bebida", target, recentMealIds),
		};
		setTodayMeals(newPlan);
		setEaten({
			Desayuno: false,
			Almuerzo: false,
			Cena: false,
			Bebida: false,
		});
		try {
			const today = new Date().toDateString();
			localStorage.setItem(
				`aegifitness_diet_plan_${target}`,
				JSON.stringify({
					date: today,
					meals: newPlan,
					eaten: {
						Desayuno: false,
						Almuerzo: false,
						Cena: false,
						Bebida: false,
					},
				}),
			);
		} catch {
			/* storage full */
		}
	}, []);

	useEffect(() => {
		const today = new Date().toDateString();
		let savedPlan = {};
		try {
			savedPlan = JSON.parse(
				localStorage.getItem(`aegifitness_diet_plan_${objective}`) || "{}",
			);
		} catch {
			savedPlan = {};
		}

		if (savedPlan.date === today && savedPlan.meals) {
			setTodayMeals(savedPlan.meals);
			setEaten(
				savedPlan.eaten || {
					Desayuno: false,
					Almuerzo: false,
					Cena: false,
					Bebida: false,
				},
			);
		} else {
			generatePlan(objective);
		}
		// generatePlan is stable via useCallback; safe to omit
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [objective, generatePlan]);

	const markEaten = (type) => {
		const newEaten = { ...eaten, [type]: true };
		setEaten(newEaten);
		setPulseEaten(type);
		window.setTimeout(() => setPulseEaten(null), 600);

		try {
			const today = new Date().toDateString();
			localStorage.setItem(
				`aegifitness_diet_plan_${objective}`,
				JSON.stringify({
					date: today,
					meals: todayMeals,
					eaten: newEaten,
				}),
			);
			// Use the shared helper so rotation logic stays consistent.
			appendDietHistory({
				mealId: todayMeals[type].id,
				calories: todayMeals[type].calories,
			});
		} catch {
			/* storage full */
		}
	};

	const swapMeal = (mealItem) => {
		const newMeals = { ...todayMeals, [swapState]: mealItem };
		setTodayMeals(newMeals);
		try {
			const today = new Date().toDateString();
			localStorage.setItem(
				`aegifitness_diet_plan_${objective}`,
				JSON.stringify({
					date: today,
					meals: newMeals,
					eaten: eaten,
				}),
			);
		} catch {
			/* storage full */
		}
		setSwapState(null);
		setSearchQuery("");
	};

	// ---- derived ----
	const totalKcal = useMemo(() => {
		return MEAL_TYPES.reduce((sum, t) => {
			const meal = todayMeals[t];
			return sum + (meal && eaten[t] ? meal.calories : 0);
		}, 0);
	}, [todayMeals, eaten]);

	const totalProtein = useMemo(() => {
		return MEAL_TYPES.reduce((sum, t) => {
			const meal = todayMeals[t];
			return sum + (meal && eaten[t] ? meal.protein : 0);
		}, 0);
	}, [todayMeals, eaten]);

	const totalCarbs = useMemo(() => {
		return MEAL_TYPES.reduce((sum, t) => {
			const meal = todayMeals[t];
			return sum + (meal && eaten[t] ? meal.carbs : 0);
		}, 0);
	}, [todayMeals, eaten]);

	const eatenCount = MEAL_TYPES.filter((t) => eaten[t]).length;
	const totalCount = MEAL_TYPES.length;

	// ---- swap view ----
	if (swapState) {
		const currentMeal = todayMeals[swapState];
		if (!currentMeal) {
			setSwapState(null);
			return null;
		}

		const available = mealsData.filter(
			(m) =>
				(m.objective === objective || m.objective === "Ambos") &&
				m.type === swapState &&
				m.id !== currentMeal.id,
		);

		const filteredBySearch = available.filter(
			(m) =>
				m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(m.recipe?.ingredients || []).some((ing) =>
					ing.toLowerCase().includes(searchQuery.toLowerCase()),
				),
		);

		if (searchQuery === "") {
			filteredBySearch.sort(
				(a, b) =>
					Math.abs(a.calories - currentMeal.calories) -
					Math.abs(b.calories - currentMeal.calories),
			);
		}

		return (
			<div className="panel">
				<div className="row between" style={{ marginBottom: 18 }}>
					<button
						className="btn btn--ghost btn--sm"
						onClick={() => {
							setSwapState(null);
							setSearchQuery("");
						}}
					>
						<ArrowLeft size={16} /> Volver
					</button>
					<h2
						style={{
							fontSize: "1.25rem",
							fontWeight: 700,
							fontFamily: "var(--font-display)",
						}}
					>
						Cambiar {MEAL_META[swapState].label.toLowerCase()}
					</h2>
					<span style={{ width: 88 }} />
				</div>

				<div className="swap-source">
					<div>
						<div className="swap-source__label">Reemplazando</div>
						<div className="swap-source__name">{currentMeal.name}</div>
					</div>
					<span className="chip__tag chip__tag--cyan swap-source__meta">
						{currentMeal.calories} kcal
					</span>
				</div>

				<div className="swap-search">
					<Search size={18} />
					<input
						type="text"
						className="input"
						placeholder={`Buscar ${MEAL_META[swapState].label.toLowerCase()} por nombre o ingrediente...`}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				{searchQuery === "" && (
					<p
						style={{
							color: "var(--text-muted)",
							fontSize: "0.85rem",
							marginBottom: 14,
						}}
					>
						Ordenado por similitud calórica a{" "}
						<strong style={{ color: "var(--text)" }}>{currentMeal.name}</strong>
						.
					</p>
				)}

				<div>
					{filteredBySearch.slice(0, 15).map((m) => (
						<div key={m.id} className="swap-item">
							<div className="swap-item__head">
								<div>
									<div className="swap-item__name">{m.name}</div>
									<div
										style={{
											display: "flex",
											gap: 6,
											marginTop: 6,
											flexWrap: "wrap",
										}}
									>
										<span className="chip__tag chip__tag--cyan">
											{m.calories} kcal
										</span>
										<span className="chip__tag chip__tag--coral">
											P {m.protein}g
										</span>
										<span className="chip__tag chip__tag--lime">
											C {m.carbs}g
										</span>
									</div>
								</div>
							</div>
							{m.description && (
								<p className="swap-item__desc">{m.description}</p>
							)}
							<button
								className="btn btn--primary btn--block"
								onClick={() => swapMeal(m)}
							>
								<CheckCircle size={16} /> Elegir este platillo
							</button>
						</div>
					))}
					{filteredBySearch.length === 0 && (
						<div className="empty">
							<div className="empty__icon">
								<Search size={28} />
							</div>
							<p className="empty__title">Sin resultados</p>
							<p>No encontramos platillos que coincidan con tu búsqueda.</p>
						</div>
					)}
				</div>
			</div>
		);
	}

	// ---- main view ----
	return (
		<div className="panel">
			<section className="hero hero--diet">
				<div className="hero__label">
					<Sparkles size={14} /> Menú de hoy
				</div>
				<h1 className="hero__title">
					Come con <span className="accent">inteligencia</span>, entrena con
					ganas
				</h1>
				<p className="hero__subtitle">
					Selecciona tu objetivo y te preparamos un menú balanceado. Cambia
					cualquier platillo cuando quieras.
				</p>
			</section>

			<div style={{ marginBottom: 22 }}>
				<SegmentedControl
					value={objective}
					onChange={handleObjectiveChange}
					options={[
						{ value: "Aumento", label: "🥩 Superávit" },
						{ value: "Definición", label: "🔥 Déficit" },
					]}
				/>
			</div>

			{/* Today overview */}
			<div className="balance-card" style={{ marginBottom: 22 }}>
				<RingProgress
					value={eatenCount}
					max={totalCount}
					color={["#f472b6", "#a78bfa"]}
					label="comidas"
					showPercent={false}
					unit=""
				/>
				<div className="balance-card__meta">
					<span className="balance-card__title">
						<Utensils
							size={16}
							style={{
								display: "inline",
								marginRight: 6,
								color: "var(--brand-magenta)",
							}}
						/>
						Tu día · {objective}
					</span>
					<div className="balance-card__kcal">
						{totalKcal} <small>kcal consumidas</small>
					</div>
					<div className="macro-stat-row">
						<div
							className="macro-stat"
							style={{ background: "rgba(34, 211, 238, 0.08)" }}
						>
							<div className="macro-stat__value">
								{totalProtein}
								<span>g</span>
							</div>
							<div className="macro-stat__label">Proteína</div>
						</div>
						<div
							className="macro-stat"
							style={{ background: "rgba(190, 242, 100, 0.08)" }}
						>
							<div className="macro-stat__value">
								{totalCarbs}
								<span>g</span>
							</div>
							<div className="macro-stat__label">Carbos</div>
						</div>
						<div
							className="macro-stat"
							style={{ background: "rgba(244, 114, 182, 0.08)" }}
						>
							<div className="macro-stat__value">
								{eatenCount}
								<span>/{totalCount}</span>
							</div>
							<div className="macro-stat__label">Comidas</div>
						</div>
					</div>
				</div>
			</div>

			{/* Meal cards */}
			<div>
				{MEAL_TYPES.map((type) => {
					const meal = todayMeals[type];
					const isEaten = eaten[type];
					const meta = MEAL_META[type];
					const Icon = meta.icon;
					if (!meal) return null;

					return (
						<div
							key={type}
							className={`meal-card ${isEaten ? "meal-card--eaten" : ""} ${pulseEaten === type ? "shake-once" : ""}`}
						>
							<div className={`meal-card__art ${meta.artClass}`}>
								<Icon size={26} strokeWidth={2.4} />
							</div>

							<div className="meal-card__body">
								<span className="meal-card__type">
									{meta.label} · {meta.hint}
								</span>
								<span className="meal-card__name">{meal.name}</span>
								{meal.description && (
									<p className="meal-card__desc">{meal.description}</p>
								)}
								<div className="meal-card__macros">
									<span>
										<Drumstick
											size={12}
											style={{
												display: "inline",
												marginRight: 4,
												color: "var(--brand-coral)",
											}}
										/>{" "}
										<strong>{meal.protein}g</strong> proteína
									</span>
									<span>
										<Wheat
											size={12}
											style={{
												display: "inline",
												marginRight: 4,
												color: "var(--brand-lime)",
											}}
										/>{" "}
										<strong>{meal.carbs}g</strong> carbos
									</span>
									<span>
										<Cookie
											size={12}
											style={{
												display: "inline",
												marginRight: 4,
												color: "var(--brand-violet)",
											}}
										/>{" "}
										<strong>{meal.sugars}g</strong> azúcar
									</span>
								</div>
							</div>

							{isEaten ? (
								<div className="meal-card__badge">
									<CheckCircle size={14} /> Consumido
								</div>
							) : (
								<div className="meal-card__kcal">
									<Flame size={14} />
									{meal.calories}
								</div>
							)}

							{!isEaten && (
								<div className="meal-card__actions">
									<button
										className="btn btn--primary"
										onClick={() => markEaten(type)}
									>
										<Utensils size={16} /> Comer
									</button>
									<button
										className="btn btn--ghost"
										onClick={() => setSwapState(type)}
									>
										<RefreshCw size={16} /> Cambiar
									</button>
								</div>
							)}

							{/* Recipe button — always visible (even after marking consumed) */}
							<button
								type="button"
								className="meal-card__info"
								onClick={() => setRecipeFor(meal)}
								aria-label={`Ver receta de ${meal.name}`}
								title={`Ver receta completa de ${meal.name}`}
							>
								<span className="meal-card__info-icon">
									<BookOpen size={16} strokeWidth={2.6} />
								</span>
								<span className="meal-card__info-label">
									<small>Receta</small>
									<span>Ver guía completa</span>
								</span>
								<ChevronRight size={18} className="meal-card__info-chevron" />
							</button>
						</div>
					);
				})}
			</div>

			{/* Recipe dialog (centered modal) */}
			<RecipeDialog meal={recipeFor} onClose={() => setRecipeFor(null)} />
		</div>
	);
};

export default DietPanel;
