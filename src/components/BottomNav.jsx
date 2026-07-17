import { NAV_ITEMS } from "./navConfig";

const BottomNav = ({ activeTab, onChange }) => {
	return (
		<nav className="bottom-nav" aria-label="Navegación principal">
			{NAV_ITEMS.map(({ id, label, icon: Icon }) => {
				const isActive = activeTab === id;
				return (
					<button
						type="button"
						key={id}
						className={`nav-item ${isActive ? "nav-item--active" : ""}`}
						onClick={() => onChange(id)}
						aria-current={isActive ? "page" : undefined}
						aria-label={label}
						title={label}
					>
						<Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
						<span className="nav-item__label">{label}</span>
					</button>
				);
			})}
		</nav>
	);
};

export default BottomNav;
