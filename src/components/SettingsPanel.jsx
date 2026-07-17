import { useState, useEffect } from "react";
import {
	User,
	Ruler,
	Weight,
	Activity,
	Sparkles,
	Save,
	Check,
	ShieldCheck,
	Target,
	CalendarDays,
	Info,
	Dumbbell,
} from "lucide-react";
import SegmentedControl from "./SegmentedControl";
import { WEEK_DAYS, EMPTY_TRAINING_SPLIT } from "../lib/rotation";

const BODY_TYPE_INFO = {
	ectomorfo:
		"Complexión delgada, dificultad para ganar peso y músculo. Metabolismo rápido. Prioriza superávit y entrenamientos pesados.",
	mesomorfo:
		"Complexión atlética, facilidad para ganar músculo y perder grasa. Responde bien a cualquier plan.",
	endomorfo:
		"Estructura ancha, facilidad para ganar peso. Metabolismo más lento. Combina cardio con pesas.",
};

const MUSCLE_GROUPS = [
	"Pecho",
	"Espalda",
	"Piernas",
	"Hombros",
	"Bíceps",
	"Tríceps",
	"Abdomen",
];

const MUSCLE_ACCENT = {
	Pecho: "#22d3ee",
	Espalda: "#a78bfa",
	Piernas: "#bef264",
	Hombros: "#fb923c",
	Bíceps: "#f472b6",
	Tríceps: "#fb7185",
	Abdomen: "#fbbf24",
};

const BODY_META = {
	ectomorfo: { emoji: "🧬", desc: "Ectomorfo" },
	mesomorfo: { emoji: "⚡", desc: "Mesomorfo" },
	endomorfo: { emoji: "🔥", desc: "Endomorfo" },
};

const SettingsPanel = ({ userData, setUserData }) => {
	const [formData, setFormData] = useState(userData);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		setFormData(userData);
	}, [userData]);

	const handleSave = () => {
		try {
			localStorage.setItem("aegifitness_user_data", JSON.stringify(formData));
		} catch {
			// Storage full or unavailable — still update state so the UI works
		}
		setUserData(formData);
		setSaved(true);
		window.setTimeout(() => setSaved(false), 2200);
	};

	const split = formData.trainingSplit || EMPTY_TRAINING_SPLIT;

	const toggleSplitMuscle = (day, muscle) => {
		const current = split[day] || [];
		const next = current.includes(muscle)
			? current.filter((m) => m !== muscle)
			: [...current, muscle];
		setFormData({
			...formData,
			trainingSplit: { ...split, [day]: next },
		});
	};

	const clearDay = (day) => {
		setFormData({
			...formData,
			trainingSplit: { ...split, [day]: [] },
		});
	};

	const todayMuscles =
		split[new Date().toLocaleDateString("es-ES", { weekday: "long" })] || [];

	return (
		<div className="panel">
			<section className="hero hero--settings">
				<div className="hero__label">
					<Sparkles size={14} /> Perfil físico
				</div>
				<h1 className="hero__title">
					Configura tu <span className="accent">entrenamiento</span>
				</h1>
				<p className="hero__subtitle">
					Define tu objetivo actual y qué partes del cuerpo entrenarás cada día.
					Las recomendaciones rotarán evitando repetir platillos y ejercicios.
				</p>
			</section>

			{/* 1. OBJETIVO ACTUAL */}
			<div className="profile-card card card--elevated mb-4">
				<h3 className="card__title">
					<Target size={20} /> Objetivo actual
				</h3>
				<p className="text-body-medium mb-4">
					Define si quieres ganar masa (superávit calórico) o quemar grasa
					(déficit). Afecta a las recomendaciones diarias de dieta y rutinas.
				</p>
				<SegmentedControl
					value={formData.currentObjective || "Aumento"}
					onChange={(v) => setFormData({ ...formData, currentObjective: v })}
					options={[
						{ value: "Aumento", label: "💪  Superávit" },
						{ value: "Definición", label: "🔥  Déficit" },
					]}
				/>
			</div>

			{/* 2. DIVISIÓN SEMANAL */}
			<div className="profile-card card card--elevated mb-4">
				<h3 className="card__title">
					<CalendarDays size={20} /> Mi división semanal
				</h3>
				<p className="text-body-medium mb-4">
					Selecciona las partes del cuerpo que entrenarás cada día. Los días sin
					selección serán de cuerpo completo. La app rotará los ejercicios
					evitando repetir los mismos en menos de 7 días.
				</p>

				<div className="training-split">
					{WEEK_DAYS.map((day) => {
						const muscles = split[day] || [];
						const isFullBody = muscles.length === 0;
						const isToday =
							day === new Date().toLocaleString("es-ES", { weekday: "long" });
						return (
							<div
								key={day}
								className={`training-split__day ${isToday ? "training-split__day--today" : ""}`}
							>
								<div className="training-split__day-head">
									<div className="training-split__day-name">
										{day}
										{isToday && (
											<span className="training-split__today-badge">Hoy</span>
										)}
									</div>
									{!isFullBody && (
										<button
											type="button"
											className="training-split__clear"
											onClick={() => clearDay(day)}
											aria-label={`Limpiar ${day}`}
										>
											× Limpiar
										</button>
									)}
								</div>
								<div className="training-split__chips">
									{MUSCLE_GROUPS.map((m) => {
										const active = muscles.includes(m);
										const color = MUSCLE_ACCENT[m];
										return (
											<button
												type="button"
												key={m}
												className={`chip ${active ? "chip--active" : ""}`}
												onClick={() => toggleSplitMuscle(day, m)}
												aria-pressed={active}
												style={
													active
														? {
																background: `linear-gradient(135deg, ${color}, ${color}cc)`,
																color: "#001218",
																borderColor: "transparent",
																boxShadow: `0 0 14px ${color}55`,
															}
														: undefined
												}
											>
												{m}
											</button>
										);
									})}
								</div>
								{isFullBody && (
									<span className="training-split__hint">
										<Info size={12} /> Sin selección = cuerpo completo
									</span>
								)}
							</div>
						);
					})}
				</div>

				{todayMuscles.length > 0 && (
					<div className="training-split__summary">
						<Dumbbell size={14} />
						<span>
							Hoy entrenarás: <strong>{todayMuscles.join(" · ")}</strong>
						</span>
					</div>
				)}
			</div>

			{/* 3. DATOS PERSONALES */}
			<div className="profile-card card card--elevated mb-4">
				<h3 className="card__title">
					<User size={20} /> Datos personales
				</h3>

				<div className="input-group">
					<label className="input-group__label" htmlFor="name">
						Nombre (opcional)
					</label>
					<input
						id="name"
						className="input"
						type="text"
						placeholder="¿Cómo te llamas?"
						value={formData.name || ""}
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						maxLength={40}
					/>
				</div>

				<div
					style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
				>
					<div className="input-group" style={{ marginBottom: 0 }}>
						<label className="input-group__label" htmlFor="height">
							<Ruler size={12} style={{ display: "inline", marginRight: 4 }} />{" "}
							Altura (cm)
						</label>
						<input
							id="height"
							type="number"
							inputMode="numeric"
							className="input"
							placeholder="175"
							value={formData.height}
							onChange={(e) =>
								setFormData({ ...formData, height: e.target.value })
							}
							min="100"
							max="250"
						/>
					</div>
					<div className="input-group" style={{ marginBottom: 0 }}>
						<label className="input-group__label" htmlFor="weight">
							<Weight size={12} style={{ display: "inline", marginRight: 4 }} />{" "}
							Peso (kg)
						</label>
						<input
							id="weight"
							type="number"
							inputMode="decimal"
							className="input"
							placeholder="70"
							value={formData.weight}
							onChange={(e) =>
								setFormData({ ...formData, weight: e.target.value })
							}
							min="30"
							max="250"
						/>
					</div>
				</div>

				<div className="input-group" style={{ marginTop: 18 }}>
					<label className="input-group__label">
						<Activity size={12} style={{ display: "inline", marginRight: 4 }} />{" "}
						Tipo de cuerpo
					</label>
					<div className="bodytype-grid">
						{Object.entries(BODY_META).map(([key, meta]) => (
							<button
								type="button"
								key={key}
								className={`bodytype ${formData.bodyType === key ? "active" : ""}`}
								onClick={() => setFormData({ ...formData, bodyType: key })}
							>
								<div style={{ fontSize: "1.4rem", marginBottom: 4 }}>
									{meta.emoji}
								</div>
								{meta.desc}
							</button>
						))}
					</div>
					<div className="bodytype-info">
						{BODY_TYPE_INFO[formData.bodyType]}
					</div>
				</div>
			</div>

			<div className="save-bar">
				{saved && (
					<span className="save-feedback">
						<Check size={16} /> Perfil guardado
					</span>
				)}
				<button className="btn btn--primary btn--lg" onClick={handleSave}>
					<Save size={18} />
					Guardar cambios
				</button>
			</div>

			<div
				style={{
					marginTop: 18,
					padding: "10px 14px",
					borderRadius: 14,
					background: "rgba(52, 211, 153, 0.08)",
					color: "var(--success)",
					fontSize: "0.78rem",
					display: "flex",
					alignItems: "center",
					gap: 8,
				}}
			>
				<ShieldCheck size={16} />
				<span>
					Tus datos se guardan localmente en este dispositivo. Privacidad total.
				</span>
			</div>
		</div>
	);
};

export default SettingsPanel;
