import { useState, useEffect, useRef } from "react";
import {
	Play,
	SkipForward,
	Flame,
	Clock,
	Target,
	Check,
	AlertCircle,
	RefreshCw,
	Search,
	Dumbbell,
	Settings2,
	ArrowRightLeft,
	ArrowLeft,
	Sparkles,
	Trophy,
	Zap,
	X,
	RotateCcw,
	BookOpen,
} from "lucide-react";
import exercisesData from "../data/exercises.json";
import SegmentedControl from "./SegmentedControl";
import ExerciseGuideDialog from "./ExerciseGuideDialog";
import {
	getTodayName,
	getRecentExerciseIds,
	pickExercises,
	saveCompletedExercises,
	EMPTY_TRAINING_SPLIT,
} from "../lib/rotation";

const MUSCLE_GROUPS = [
	"Pecho",
	"Espalda",
	"Piernas",
	"Hombros",
	"Bíceps",
	"Tríceps",
	"Abdomen",
];
const TRAINING_TYPES = ["Ambos", "Gimnasio", "Calistenia"];

// quick map of muscle → friendly icon color accent
const MUSCLE_ACCENT = {
	Pecho: "#22d3ee",
	Espalda: "#a78bfa",
	Piernas: "#bef264",
	Hombros: "#fb923c",
	Bíceps: "#f472b6",
	Tríceps: "#fb7185",
	Abdomen: "#fbbf24",
};

const RoutinesPanel = ({ userData, setUserData }) => {
	const userObjective = userData?.currentObjective || "Aumento";
	const todayName = getTodayName();
	const userSplitToday =
		(userData?.trainingSplit && userData.trainingSplit[todayName]) ||
		EMPTY_TRAINING_SPLIT[todayName] ||
		[];

	// Local UI state — synced with userData on changes
	const [objective, setObjectiveLocal] = useState(userObjective);
	const [prefMuscles, setPrefMusclesLocal] = useState(
		userSplitToday.length > 0 ? userSplitToday : [],
	);

	// Whenever userData.currentObjective changes (e.g. via Settings), keep in sync
	useEffect(() => {
		setObjectiveLocal(userObjective);
	}, [userObjective]);

	// Whenever today or the user split changes, refresh the default muscles
	useEffect(() => {
		if (userSplitToday.length > 0) {
			setPrefMusclesLocal(userSplitToday);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [todayName]);

	const handleObjectiveChange = (v) => {
		setObjectiveLocal(v);
		if (setUserData && userData) {
			setUserData({ ...userData, currentObjective: v });
		}
	};

	const [routineState, setRoutineState] = useState("overview"); // overview | active | completed
	const [isMinimal, setIsMinimal] = useState(false);

	const [prefType, setPrefType] = useState("Ambos");

	const [activeRoutine, setActiveRoutine] = useState([]);
	const [progress, setProgress] = useState({});

	const [swapTarget, setSwapTarget] = useState(null);
	const [guideFor, setGuideFor] = useState(null); // exercise object displayed in the guide dialog
	const [searchQuery, setSearchQuery] = useState("");

	const segRef = useRef(null);

	// Generates routine when in overview — uses smart rotation
	useEffect(() => {
		if (routineState !== "overview") return;

		const recentIds = getRecentExerciseIds();
		const count = isMinimal ? 2 : 5;

		// Smart picker: builds the routine respecting filters but always tries
		// to fill the requested count by progressively relaxing type + muscle
		// constraints (see lib/rotation.js for the bucketing algorithm).
		const selected = pickExercises(
			objective,
			prefMuscles,
			prefType,
			recentIds,
			count,
		);

		setActiveRoutine(selected);
	}, [isMinimal, objective, prefType, prefMuscles, routineState]);

	const toggleMuscle = (muscle) => {
		setPrefMusclesLocal((prev) =>
			prev.includes(muscle)
				? prev.filter((m) => m !== muscle)
				: [...prev, muscle],
		);
	};

	const startRoutine = () => {
		if (activeRoutine.length === 0) return;
		const initialProgress = {};
		activeRoutine.forEach((ex) => {
			initialProgress[ex.id] = {
				setsDone: 0,
				targetSets: isMinimal ? 2 : 4,
				skipped: false,
				completed: false,
			};
		});
		setProgress(initialProgress);
		setRoutineState("active");
	};

	const updateProgress = (id, field, value) => {
		setProgress((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
	};

	const toggleSkip = (id) => {
		setProgress((prev) => ({
			...prev,
			[id]: { ...prev[id], skipped: !prev[id].skipped, completed: false },
		}));
	};

	const markCompleted = (id) => {
		setProgress((prev) => ({
			...prev,
			[id]: {
				...prev[id],
				completed: true,
				skipped: false,
				setsDone: prev[id].targetSets,
			},
		}));
	};

	const finishRoutine = () => {
		const totalExercises = activeRoutine.length;
		let completedCount = 0;
		let partialCount = 0;
		Object.values(progress).forEach((p) => {
			if (p.completed) completedCount++;
			else if (!p.skipped && p.setsDone > 0) partialCount++;
		});
		const completionRate =
			totalExercises === 0
				? 0
				: (completedCount + partialCount * 0.5) / totalExercises;
		const caloriesBurned = Math.round(completionRate * (isMinimal ? 150 : 400));
		const timeSpent = isMinimal ? 15 : 45;
		const summary = {
			date: new Date().toISOString(),
			type: isMinimal ? "Mínima" : "Completa",
			completionRate,
			caloriesBurned,
			timeSpent,
			objective,
		};

		try {
			const history = JSON.parse(
				localStorage.getItem("aegifitness_history") || "[]",
			);
			history.push(summary);
			localStorage.setItem("aegifitness_history", JSON.stringify(history));
		} catch {
			/* storage full */
		}

		// Track only COMPLETED exercises for the rotation algorithm —
		// we don't penalize the user for skipping or partially doing one.
		const completedExercises = activeRoutine.filter(
			(ex) => progress[ex.id] && progress[ex.id].completed,
		);
		saveCompletedExercises(completedExercises);

		setRoutineState("completed");
	};

	const executeSwap = (newExercise) => {
		const updatedRoutine = [...activeRoutine];
		updatedRoutine[swapTarget.index] = newExercise;
		setActiveRoutine(updatedRoutine);

		if (routineState === "active") {
			setProgress((prev) => {
				const next = { ...prev };
				delete next[swapTarget.id];
				next[newExercise.id] = {
					setsDone: 0,
					targetSets: isMinimal ? 2 : 4,
					skipped: false,
					completed: false,
				};
				return next;
			});
		}
		setSwapTarget(null);
		setSearchQuery("");
	};

	// ---- SWAP VIEW ----
	if (swapTarget) {
		const currentEx = swapTarget.exercise;
		const available = exercisesData.filter(
			(ex) => ex.objective === objective && ex.id !== currentEx.id,
		);
		const filteredBySearch = available.filter(
			(ex) =>
				ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
				ex.type.toLowerCase().includes(searchQuery.toLowerCase()),
		);

		if (searchQuery === "") {
			filteredBySearch.sort((a, b) => {
				if (
					a.muscleGroup === currentEx.muscleGroup &&
					b.muscleGroup !== currentEx.muscleGroup
				)
					return -1;
				if (
					b.muscleGroup === currentEx.muscleGroup &&
					a.muscleGroup !== currentEx.muscleGroup
				)
					return 1;
				return 0;
			});
		}

		return (
			<div className="panel">
				<div className="row between" style={{ marginBottom: 18 }}>
					<button
						className="btn btn--ghost btn--sm"
						onClick={() => {
							setSwapTarget(null);
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
						Buscar ejercicio
					</h2>
					<span style={{ width: 88 }} />
				</div>

				<div className="swap-source">
					<div>
						<div className="swap-source__label">Reemplazando</div>
						<div className="swap-source__name">{currentEx.name}</div>
					</div>
					<span
						className="chip__tag chip__tag--cyan swap-source__meta"
						style={{
							color: MUSCLE_ACCENT[currentEx.muscleGroup] || "#22d3ee",
							background: `${MUSCLE_ACCENT[currentEx.muscleGroup] || "#22d3ee"}22`,
						}}
					>
						{currentEx.muscleGroup}
					</span>
				</div>

				<div className="swap-search">
					<Search size={18} />
					<input
						type="text"
						className="input"
						placeholder="Buscar por nombre, músculo o tipo..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				{filteredBySearch.slice(0, 15).map((ex) => (
					<div key={ex.id} className="swap-item">
						<div className="swap-item__head">
							<div>
								<div className="swap-item__name">{ex.name}</div>
								<div
									style={{
										display: "flex",
										gap: 6,
										marginTop: 6,
										flexWrap: "wrap",
									}}
								>
									<span
										className="chip__tag"
										style={{
											background: `${MUSCLE_ACCENT[ex.muscleGroup] || "#22d3ee"}22`,
											color: MUSCLE_ACCENT[ex.muscleGroup] || "#22d3ee",
										}}
									>
										{ex.muscleGroup}
									</span>
									<span
										className="chip__tag"
										style={{
											background:
												ex.type === "Gimnasio"
													? "rgba(34, 211, 238, 0.15)"
													: "rgba(244, 114, 182, 0.15)",
											color: ex.type === "Gimnasio" ? "#67e8f9" : "#f472b6",
										}}
									>
										{ex.type}
									</span>
								</div>
							</div>
						</div>
						<p className="swap-item__desc">{ex.description}</p>
						<button
							className="btn btn--block"
							style={{
								background: "rgba(34, 211, 238, 0.08)",
								color: "var(--brand-primary-soft)",
								border: "1px solid rgba(34, 211, 238, 0.25)",
							}}
							onClick={() => executeSwap(ex)}
						>
							<ArrowRightLeft size={16} /> Seleccionar este ejercicio
						</button>
					</div>
				))}

				{filteredBySearch.length === 0 && (
					<div className="empty">
						<div className="empty__icon">
							<Search size={28} />
						</div>
						<p className="empty__title">Sin resultados</p>
						<p>Prueba con otro término de búsqueda.</p>
					</div>
				)}
			</div>
		);
	}

	// ---- COMPLETED VIEW ----
	if (routineState === "completed") {
		const totalCalories = Math.round(
			Object.values(progress).reduce(
				(s, p) => s + (p.completed ? p.targetSets * 10 : 0),
				0,
			),
		);
		const completed = Object.values(progress).filter((p) => p.completed).length;

		return (
			<div className="panel">
				<div className="complete-screen">
					<div className="complete-screen__trophy">
						<Trophy size={64} color="#0a1500" strokeWidth={2.4} />
					</div>
					<h1 className="complete-screen__title">
						¡Rutina <span className="accent">completada</span>!
					</h1>
					<p className="complete-screen__sub">
						Excelente trabajo. Tus datos se han registrado.
					</p>

					<div
						className="stat-grid"
						style={{ maxWidth: 500, margin: "0 auto 28px" }}
					>
						<div className="stat-card stat-card--cyan">
							<div className="stat-card__icon">
								<Flame size={18} color="#22d3ee" />
							</div>
							<div className="stat-card__label">Calorías</div>
							<div className="stat-card__value">
								{totalCalories}
								<span className="stat-card__unit">kcal</span>
							</div>
							<span className="stat-card__trend stat-card__trend--up">
								<Zap size={12} /> activas
							</span>
						</div>
						<div className="stat-card stat-card--lime">
							<div className="stat-card__icon">
								<Dumbbell size={18} color="#bef264" />
							</div>
							<div className="stat-card__label">Ejercicios</div>
							<div className="stat-card__value">
								{completed}
								<span className="stat-card__unit">/{activeRoutine.length}</span>
							</div>
							<span className="stat-card__trend stat-card__trend--up">
								<Check size={12} /> completados
							</span>
						</div>
					</div>

					<button
						className="btn btn--primary btn--lg"
						onClick={() => setRoutineState("overview")}
					>
						<RotateCcw size={18} /> Volver a rutinas
					</button>
				</div>
			</div>
		);
	}

	// ---- ACTIVE WORKOUT VIEW ----
	if (routineState === "active") {
		const totalSetsDone = Object.values(progress).reduce(
			(s, p) => s + (p.completed ? p.targetSets : p.setsDone),
			0,
		);
		const totalSetsTarget = Object.values(progress).reduce(
			(s, p) => s + p.targetSets,
			0,
		);
		const overallPct =
			totalSetsTarget > 0 ? totalSetsDone / totalSetsTarget : 0;
		const completedExercises = Object.values(progress).filter(
			(p) => p.completed,
		).length;

		return (
			<div className="panel">
				<div className="row between mb-4">
					<div>
						<div className="hero__label">
							<Zap size={14} /> En curso
						</div>
						<h1
							className="hero__title"
							style={{ fontSize: "1.75rem", margin: 0 }}
						>
							Tu <span className="accent">entrenamiento</span>
						</h1>
					</div>
					<button className="btn btn--danger btn--sm" onClick={finishRoutine}>
						Terminar
					</button>
				</div>

				{/* Progress card */}
				<div
					className="card card--elevated"
					style={{
						background:
							"linear-gradient(135deg, rgba(190, 242, 100, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)",
					}}
				>
					<div className="row between" style={{ marginBottom: 12 }}>
						<div>
							<div
								style={{
									fontFamily: "var(--font-display)",
									fontWeight: 800,
									fontSize: "1.5rem",
								}}
							>
								{completedExercises}{" "}
								<span
									style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}
								>
									/ {activeRoutine.length}
								</span>
							</div>
							<div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
								ejercicios completados
							</div>
						</div>
						<div style={{ textAlign: "right" }}>
							<div
								style={{
									fontFamily: "var(--font-display)",
									fontWeight: 800,
									fontSize: "1.25rem",
									color: "var(--brand-lime)",
								}}
							>
								{Math.round(overallPct * 100)}%
							</div>
							<div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
								progreso
							</div>
						</div>
					</div>
					<div className="progress">
						<div
							className="progress__bar"
							style={{
								width: `${Math.min(100, overallPct * 100)}%`,
								background:
									"linear-gradient(90deg, var(--brand-primary), var(--brand-lime))",
								boxShadow: "0 0 12px rgba(190, 242, 100, 0.4)",
							}}
						/>
					</div>
				</div>

				<div style={{ marginTop: 20 }}>
					{activeRoutine.map((ex, index) => {
						const p = progress[ex.id];
						if (!p) return null;
						const isDone = p.completed || p.skipped;
						const muscleColor =
							MUSCLE_ACCENT[ex.muscleGroup] || "var(--brand-primary)";

						return (
							<div
								key={ex.id}
								className={`workout-card ${p.completed ? "workout-card--done" : ""} ${p.skipped ? "workout-card--skipped" : ""}`}
								style={{ marginBottom: 14 }}
							>
								<div className="workout-card__head">
									<div style={{ flex: 1 }}>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: 8,
												marginBottom: 6,
												flexWrap: "wrap",
											}}
										>
											<span
												className="chip__tag"
												style={{
													background: `${muscleColor}22`,
													color: muscleColor,
												}}
											>
												{ex.muscleGroup}
											</span>
											<span
												className="chip__tag"
												style={{
													background:
														ex.type === "Gimnasio"
															? "rgba(34, 211, 238, 0.15)"
															: "rgba(244, 114, 182, 0.15)",
													color: ex.type === "Gimnasio" ? "#67e8f9" : "#f472b6",
												}}
											>
												{ex.type}
											</span>
											<span
												style={{
													fontSize: "0.75rem",
													color: "var(--text-muted)",
													fontWeight: 600,
												}}
											>
												#{index + 1}
											</span>
										</div>
										<div className="workout-card__name">{ex.name}</div>
									</div>
									{p.completed && (
										<div
											style={{
												width: 40,
												height: 40,
												borderRadius: "50%",
												background: "linear-gradient(135deg, #34d399, #10b981)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												boxShadow: "0 0 16px rgba(52, 211, 153, 0.4)",
											}}
										>
											<Check size={20} color="#001b0e" strokeWidth={3} />
										</div>
									)}
									{p.skipped && (
										<div
											style={{
												width: 40,
												height: 40,
												borderRadius: "50%",
												background: "rgba(148, 163, 184, 0.15)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<X size={20} color="var(--text-dim)" />
										</div>
									)}
									{!isDone && (
										<div className="row gap-2" style={{ marginLeft: "auto" }}>
											<button
												type="button"
												className="btn-icon"
												onClick={() => setGuideFor(ex)}
												aria-label={`Ver guía de ${ex.name}`}
												title="Ver guía completa"
												style={{
													color: muscleColor,
													borderColor: `${muscleColor}40`,
												}}
											>
												<BookOpen size={15} />
											</button>
											<button
												type="button"
												className="btn-icon"
												onClick={() =>
													setSwapTarget({
														exercise: ex,
														index,
														id: ex.id,
													})
												}
												aria-label="Cambiar ejercicio"
												title="Cambiar este ejercicio"
											>
												<RefreshCw size={16} />
											</button>
										</div>
									)}
								</div>

								{ex.instructions && (
									<div className="workout-card__desc">{ex.instructions}</div>
								)}

								{!isDone && (
									<>
										<div className="sets-counter">
											<span className="sets-counter__label">Series</span>
											<div className="sets-counter__controls">
												<button
													className="sets-counter__btn"
													onClick={() =>
														updateProgress(
															ex.id,
															"setsDone",
															Math.max(0, p.setsDone - 1),
														)
													}
													aria-label="Restar serie"
												>
													−
												</button>
												<span className="sets-counter__value">
													{p.setsDone}
												</span>
												<button
													className="sets-counter__btn sets-counter__btn--plus"
													onClick={() =>
														updateProgress(
															ex.id,
															"setsDone",
															Math.min(p.targetSets, p.setsDone + 1),
														)
													}
													aria-label="Sumar serie"
												>
													+
												</button>
											</div>
											<span className="sets-counter__target">
												de {p.targetSets}
											</span>
										</div>

										<div className="row gap-2">
											<button
												className="btn btn--primary btn--block"
												onClick={() => markCompleted(ex.id)}
											>
												<Check size={18} /> Completar ejercicio
											</button>
											<button
												className="btn btn--ghost"
												onClick={() => toggleSkip(ex.id)}
												aria-label="Saltar ejercicio"
											>
												<SkipForward size={18} />
											</button>
										</div>
									</>
								)}

								{isDone && (
									<button
										className="btn btn--ghost btn--block"
										onClick={() => {
											updateProgress(ex.id, "skipped", false);
											updateProgress(ex.id, "completed", false);
										}}
									>
										<RotateCcw size={16} /> Deshacer
									</button>
								)}
							</div>
						);
					})}
				</div>

				<button
					className="btn btn--lime btn--block btn--lg"
					style={{ marginTop: 8 }}
					onClick={finishRoutine}
					disabled={completedExercises === 0}
				>
					<Trophy size={18} /> Finalizar rutina
				</button>
			</div>
		);
	}

	// ---- OVERVIEW VIEW ----
	return (
		<div className="panel">
			<section className="hero hero--routines">
				<div className="hero__label">
					<Sparkles size={14} /> Generador de rutinas
				</div>
				<h1 className="hero__title">
					Construye tu <span className="accent">entrenamiento</span> ideal
				</h1>
				<p className="hero__subtitle">
					Elige objetivo, enfoque muscular y volumen. La app arma una rutina que
					se adapta a ti.
				</p>
			</section>

			<div style={{ marginBottom: 22 }}>
				<SegmentedControl
					ref={segRef}
					value={objective}
					onChange={handleObjectiveChange}
					options={[
						{ value: "Aumento", label: "💪  Superávit" },
						{ value: "Definición", label: "🔥  Déficit" },
					]}
				/>
			</div>

			{/* Customization */}
			<div className="card card--elevated mb-5">
				<h3 className="card__title">
					<Settings2 size={20} /> Personaliza tu entrenamiento
				</h3>

				<div className="input-group">
					<label className="input-group__label">Tipo de entrenamiento</label>
					<select
						className="input select"
						value={prefType}
						onChange={(e) => setPrefType(e.target.value)}
					>
						{TRAINING_TYPES.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="input-group__label">Enfoque muscular</label>
					<div
						style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
					>
						<button
							type="button"
							className={`chip ${prefMuscles.length === 0 ? "chip--active" : ""}`}
							onClick={() => setPrefMuscles([])}
						>
							Todos (Full Body)
						</button>
						{MUSCLE_GROUPS.map((m) => {
							const isActive = prefMuscles.includes(m);
							return (
								<button
									type="button"
									key={m}
									className={`chip ${isActive ? "chip--active" : ""}`}
									onClick={() => toggleMuscle(m)}
									style={
										isActive
											? {
													background: `linear-gradient(135deg, ${MUSCLE_ACCENT[m]} 0%, ${MUSCLE_ACCENT[m]}cc 100%)`,
													color: "#001218",
													borderColor: "transparent",
													boxShadow: `0 0 16px ${MUSCLE_ACCENT[m]}55`,
												}
											: undefined
									}
								>
									{m}
								</button>
							);
						})}
					</div>
					<p
						style={{
							fontSize: "0.75rem",
							color: "var(--text-dim)",
							marginTop: 10,
						}}
					>
						Selecciona uno o varios. Si no eliges ninguno, será full body.
					</p>
				</div>
			</div>

			{/* Volume selector */}
			<div className="section-title">
				<span>Volumen</span>
				<span className="section-title__hint">¿Cuánto tiempo tienes?</span>
			</div>
			<div className="routine-volume">
				<button
					type="button"
					className={`routine-volume__card ${!isMinimal ? "active" : ""}`}
					onClick={() => setIsMinimal(false)}
					style={{ textAlign: "left" }}
				>
					<div className="icon" style={{ color: "var(--brand-primary)" }}>
						<Flame size={22} />
					</div>
					<h3>Rutina Completa</h3>
					<p>
						<Clock size={11} style={{ display: "inline", marginRight: 4 }} />{" "}
						~45 min · 5 ejercicios
					</p>
				</button>
				<button
					type="button"
					className={`routine-volume__card ${isMinimal ? "active" : ""}`}
					onClick={() => setIsMinimal(true)}
					style={{ textAlign: "left" }}
				>
					<div className="icon" style={{ color: "var(--brand-coral)" }}>
						<Zap size={22} />
					</div>
					<h3>Rutina Mínima</h3>
					<p>
						<Clock size={11} style={{ display: "inline", marginRight: 4 }} />{" "}
						~15 min · 2 ejercicios
					</p>
				</button>
			</div>

			{/* Preview */}
			<div className="routine-preview">
				<div className="routine-preview__head">
					<div>
						<div className="hero__label">
							<Target size={14} /> Vista previa
						</div>
						<h3
							style={{
								fontFamily: "var(--font-display)",
								fontWeight: 700,
								fontSize: "1.1rem",
							}}
						>
							Tu rutina está lista
						</h3>
					</div>
					<span className="chip">
						<AlertCircle size={12} /> Personalizable
					</span>
				</div>

				<div>
					{activeRoutine.length === 0 && (
						<div className="empty">
							<div className="empty__icon">
								<Dumbbell size={28} />
							</div>
							<p className="empty__title">Sin ejercicios disponibles</p>
							<p>Prueba cambiar los filtros para encontrar más opciones.</p>
						</div>
					)}

					{activeRoutine.map((ex, i) => {
						const muscleColor = MUSCLE_ACCENT[ex.muscleGroup] || "#22d3ee";
						return (
							<div key={ex.id + "-" + i} className="routine-preview__ex">
								<div className="routine-preview__ex-index">{i + 1}</div>
								<div style={{ minWidth: 0 }}>
									<div className="routine-preview__ex-name">{ex.name}</div>
									<div className="routine-preview__ex-tags">
										<span
											className="chip__tag"
											style={{
												background: `${muscleColor}22`,
												color: muscleColor,
											}}
										>
											{ex.muscleGroup}
										</span>
										<span
											className="chip__tag"
											style={{
												background:
													ex.type === "Gimnasio"
														? "rgba(34, 211, 238, 0.15)"
														: "rgba(244, 114, 182, 0.15)",
												color: ex.type === "Gimnasio" ? "#67e8f9" : "#f472b6",
											}}
										>
											{ex.type}
										</span>
									</div>
								</div>
								<button
									type="button"
									className="btn-icon"
									onClick={() => setGuideFor(ex)}
									aria-label={`Ver guía de ${ex.name}`}
									title="Ver guía del ejercicio"
									style={{
										color: muscleColor,
										borderColor: `${muscleColor}40`,
									}}
								>
									<BookOpen size={15} />
								</button>
								<button
									type="button"
									className="btn-icon"
									onClick={() =>
										setSwapTarget({ exercise: ex, index: i, id: ex.id })
									}
									aria-label="Cambiar ejercicio"
									title="Cambiar este ejercicio"
								>
									<RefreshCw size={16} />
								</button>
							</div>
						);
					})}
				</div>

				<button
					type="button"
					className="btn btn--lime btn--block btn--lg"
					style={{ marginTop: 14 }}
					onClick={startRoutine}
					disabled={activeRoutine.length === 0}
				>
					<Play size={20} fill="currentColor" /> Comenzar rutina
				</button>
			</div>

			{/* Exercise guide dialog (modal centered) */}
			<ExerciseGuideDialog
				exercise={guideFor}
				onClose={() => setGuideFor(null)}
			/>
		</div>
	);
};

export default RoutinesPanel;
