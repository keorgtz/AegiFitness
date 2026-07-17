import { useEffect } from "react";
import {
	X,
	Flame,
	Drumstick,
	Wheat,
	Cookie,
	Coffee,
	Salad,
	Soup,
	GlassWater,
	BookOpen,
	Utensils,
	ListChecks,
} from "lucide-react";

// Map meal.type -> icon + gradient class so the dialog mirrors the meal card art
const ART = {
	Desayuno: { icon: Coffee, modClass: "" },
	Almuerzo: { icon: Salad, modClass: "dialog__hero-icon--lunch" },
	Cena: { icon: Soup, modClass: "dialog__hero-icon--dinner" },
	Bebida: { icon: GlassWater, modClass: "dialog__hero-icon--drink" },
};

const RecipeDialog = ({ meal, onClose }) => {
	// Manage Esc to close + body scroll lock while open
	useEffect(() => {
		if (!meal) return undefined;

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
	}, [meal, onClose]);

	if (!meal) return null;

	const art = ART[meal.type] || ART.Desayuno;
	const Icon = art.icon;
	const recipe = meal.recipe || {};
	const ingredients = recipe.ingredients || [];
	const steps = recipe.steps || [];

	return (
		<div
			className="dialog-backdrop"
			role="dialog"
			aria-modal="true"
			aria-labelledby="recipe-dialog-title"
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
					<div className={`dialog__hero-icon ${art.modClass}`}>
						<Icon size={34} strokeWidth={2.2} />
					</div>
					<div className="dialog__hero-text">
						<span className="dialog__hero-eyebrow">{meal.type}</span>
						<h2 id="recipe-dialog-title" className="dialog__hero-title">
							{meal.name}
						</h2>
					</div>
				</div>

				{/* Macro summary */}
				<div className="dialog__macros">
					<div className="dialog__macro dialog__macro--cyan">
						<Flame size={16} />
						<strong>
							{meal.calories}
							<small>kcal</small>
						</strong>
						<span>Calorías</span>
					</div>
					<div className="dialog__macro dialog__macro--coral">
						<Drumstick size={16} />
						<strong>
							{meal.protein}
							<small>g</small>
						</strong>
						<span>Proteína</span>
					</div>
					<div className="dialog__macro dialog__macro--lime">
						<Wheat size={16} />
						<strong>
							{meal.carbs}
							<small>g</small>
						</strong>
						<span>Carbos</span>
					</div>
					<div className="dialog__macro dialog__macro--violet">
						<Cookie size={16} />
						<strong>
							{meal.sugars}
							<small>g</small>
						</strong>
						<span>Azúcar</span>
					</div>
				</div>

				{/* Description */}
				{meal.description && (
					<p className="dialog__description">{meal.description}</p>
				)}

				{/* Portions */}
				{recipe.portions && (
					<section className="dialog__section">
						<h3 className="dialog__section-title">
							<Utensils size={16} /> Porciones
						</h3>
						<div className="dialog__portions">{recipe.portions}</div>
					</section>
				)}

				{/* Ingredients + Steps: vertical on mobile, side-by-side on desktop */}
				{(ingredients.length > 0 || steps.length > 0) && (
					<div className="dialog__split">
						{ingredients.length > 0 && (
							<section className="dialog__section">
								<h3 className="dialog__section-title">
									<ListChecks size={16} /> Ingredientes
								</h3>
								<ul className="dialog__ingredients">
									{ingredients.map((ing, i) => (
										<li key={i}>{ing}</li>
									))}
								</ul>
							</section>
						)}

						{steps.length > 0 && (
							<section className="dialog__section">
								<h3 className="dialog__section-title">
									<BookOpen size={16} /> Preparación
								</h3>
								<ol className="dialog__steps">
									{steps.map((step, i) => (
										<li key={i}>
											<span className="dialog__step-num">{i + 1}</span>
											<span className="dialog__step-text">{step}</span>
										</li>
									))}
								</ol>
							</section>
						)}
					</div>
				)}

				{/* Close primary CTA at the bottom (mobile friendly) */}
				<button
					type="button"
					className="btn btn--primary btn--block dialog__cta"
					onClick={onClose}
				>
					Listo
				</button>
			</div>
		</div>
	);
};

export default RecipeDialog;
