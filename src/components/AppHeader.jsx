import { Dumbbell } from "lucide-react";
import { NAV_ITEMS } from "./navConfig";

const AppHeader = ({ initials = "AF", activeTab, onChange, onClickAvatar }) => {
	return (
		<header className="app-header">
			<div className="app-header__brand">
				<div className="brand-mark" aria-hidden="true">
					<Dumbbell size={20} strokeWidth={2.5} />
				</div>
				<div className="brand-text">
					<strong>AegiFitness</strong>
					<span>Tu progreso, hoy</span>
				</div>
			</div>

			{/* Top tabbar — visible only on tablet/desktop */}
			<nav className="app-header__tabs" aria-label="Navegación principal">
				{NAV_ITEMS.map(({ id, label, icon: Icon }) => {
					const isActive = activeTab === id;
					return (
						<button
							type="button"
							key={id}
							className={`tab ${isActive ? "tab--active" : ""}`}
							onClick={() => onChange(id)}
							aria-current={isActive ? "page" : undefined}
							aria-label={label}
							title={label}
						>
							<Icon size={18} strokeWidth={isActive ? 2.6 : 2} />
							<span className="tab__label">{label}</span>
						</button>
					);
				})}
			</nav>

			<button
				type="button"
				className="app-header__avatar"
				onClick={onClickAvatar}
				aria-label="Ir a mi perfil"
				title="Mi perfil"
			>
				{initials}
			</button>
		</header>
	);
};

export default AppHeader;
