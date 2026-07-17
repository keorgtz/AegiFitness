import { useEffect } from "react";
import { X, BookOpen, Target, Zap, Dumbbell, Info } from "lucide-react";

// Muscle-group accent colors (mirror the ones used in the routines list)
const MUSCLE_ACCENT = {
	Pecho: "#22d3ee",
	Espalda: "#a78bfa",
	Piernas: "#bef264",
	Hombros: "#fb923c",
	Bíceps: "#f472b6",
	Tríceps: "#fb7185",
	Abdomen: "#fbbf24",
};

const TYPE_BADGE = {
	Gimnasio: { bg: "rgba(34, 211, 238, 0.16)", color: "#67e8f9" },
	Calistenia: { bg: "rgba(244, 114, 182, 0.16)", color: "#f472b6" },
};

const ExerciseGuideDialog = ({ exercise, onClose }) => {
	useEffect(() => {
		if (!exercise) return undefined;

		const onKey = (e) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousOverflow;
		};
	}, [exercise, onClose]);

	if (!exercise) return null;

	const muscleColor = MUSCLE_ACCENT[exercise.muscleGroup] || "#22d3ee";
	const typeBadge = TYPE_BADGE[exercise.type] || TYPE_BADGE.Gimnasio;

	// Split the long instructions string into ordered sentences for the step list.
	// Falls back to a single step if no sentences are detected.
	const splitInstructions = (text) => {
		if (!text) return [];
		const parts = text
			.split(/(?<=[.!?])\s+/)
			.map((s) => s.trim())
			.filter(Boolean);
		return parts.length > 1 ? parts : [text];
	};
	const steps = splitInstructions(exercise.instructions);

	return (
		<div
			className="dialog-backdrop"
			role="dialog"
			aria-modal="true"
			aria-labelledby="exercise-guide-title"
			onClick={onClose}
		>
			<div className="dialog" onClick={(e) => e.stopPropagation()}>
				<button
					type="button"
					className="dialog__close"
					onClick={onClose}
					aria-label="Cerrar"
					title="Cerrar"
				>
					<X size={18} strokeWidth={2.5} />
				</button>

				{/* Header */}
				<div className="dialog__hero">
					<div
						className="dialog__hero-icon"
						style={{
							background: `linear-gradient(135deg, ${muscleColor}, ${muscleColor}cc)`,
							boxShadow: `0 0 24px ${muscleColor}55`,
						}}
					>
						<Dumbbell size={32} strokeWidth={2.2} />
					</div>
					<div className="dialog__hero-text">
						<span
							className="dialog__hero-eyebrow"
							style={{ color: muscleColor }}
						>
							{exercise.muscleGroup}
						</span>
						<h2 id="exercise-guide-title" className="dialog__hero-title">
							{exercise.name}
						</h2>
						<div
							style={{
								display: "flex",
								gap: 6,
								marginTop: 8,
								flexWrap: "wrap",
							}}
						>
							<span
								className="chip__tag"
								style={{
									background: typeBadge.bg,
									color: typeBadge.color,
								}}
							>
								{exercise.type}
							</span>
							<span
								className="chip__tag"
								style={{
									background: `${muscleColor}22`,
									color: muscleColor,
								}}
							>
								{exercise.objective}
							</span>
						</div>
					</div>
				</div>

				{/* Top row: target + effect */}
				<div className="dialog__split dialog__split--top">
					{exercise.target && (
						<section className="dialog__section">
							<h3 className="dialog__section-title">
								<Target size={16} /> Músculos trabajados
							</h3>
							<div className="dialog__portions">{exercise.target}</div>
						</section>
					)}

					{exercise.effect && (
						<section className="dialog__section">
							<h3 className="dialog__section-title">
								<Zap size={16} /> Efecto
							</h3>
							<p className="dialog__description" style={{ marginBottom: 0 }}>
								{exercise.effect}
							</p>
						</section>
					)}
				</div>

				{/* Description (if present and distinct from instructions) */}
				{exercise.description &&
					exercise.description !== exercise.instructions && (
						<p className="dialog__description">{exercise.description}</p>
					)}

				{/* Step-by-step instructions */}
				<section className="dialog__section">
					<h3 className="dialog__section-title">
						<BookOpen size={16} /> Guía paso a paso
					</h3>
					<ol className="dialog__steps">
						{steps.map((step, i) => (
							<li key={i}>
								<span
									className="dialog__step-num"
									style={{
										background: `linear-gradient(135deg, ${muscleColor}, ${muscleColor}cc)`,
										boxShadow: `0 0 16px ${muscleColor}55`,
										color: "#001218",
									}}
								>
									{i + 1}
								</span>
								<span className="dialog__step-text">{step}</span>
							</li>
						))}
					</ol>
				</section>

				{/* Quick tips banner */}
				<div className="dialog__tip">
					<Info size={16} />
					<span>
						Respeta la técnica sobre el peso. Si sientes dolor articular,
						detente y reduce el rango de movimiento.
					</span>
				</div>

				{/* CTA */}
				<button
					type="button"
					className="btn btn--primary btn--block dialog__cta"
					onClick={onClose}
				>
					Entendido
				</button>
			</div>
		</div>
	);
};

export default ExerciseGuideDialog;
