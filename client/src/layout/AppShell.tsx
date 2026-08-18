import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { initials } from "../utils/format";
import { toggleTheme } from "../utils/theme";
import { useTheme } from "../hooks/useTheme";
import { RingProgress } from "../components/ui/charts";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  admin?: boolean;
  desktopOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Hoy", icon: "calendar_today" },
  { to: "/training", label: "Entrenar", icon: "fitness_center" },
  { to: "/nutrition", label: "Nutrición", icon: "restaurant" },
  { to: "/progress", label: "Progreso", icon: "trending_up" },
  { to: "/achievements", label: "Logros", icon: "emoji_events" },
  { to: "/export", label: "Exportar", icon: "download", desktopOnly: true },
  { to: "/settings", label: "Ajustes", icon: "settings" },
  { to: "/admin", label: "Admin", icon: "admin_panel_settings", admin: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const navItems = NAV_ITEMS.filter((n) => !n.admin || user?.roles.includes("Admin"));

  const xp = user?.gamification.xp ?? 0;
  const levelXp = user?.gamification.xpToNext ?? 100;
  const level = user?.gamification.level ?? 1;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="brand-mark">
            <span className="icon">fitness_center</span>
          </div>
          <div className="brand-text">
            <strong>AegiFitness</strong>
            <span>Pastel Pulse</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
              }
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="app-header">
        <div className="app-header__brand">
          <div className="brand-mark">
            <span className="icon">fitness_center</span>
          </div>
          <div className="brand-text">
            <strong>AegiFitness</strong>
            <span>Pastel Pulse</span>
          </div>
        </div>

        <div className="app-header__actions">
          <button
            type="button"
            className="btn-icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            <span className="icon">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RingProgress value={xp} max={levelXp} size={44} stroke={4}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{level}</span>
            </RingProgress>
          </div>
          <button
            type="button"
            className="app-header__avatar"
            onClick={() => navigate("/settings")}
            aria-label="Perfil"
          >
            {initials(user?.displayName ?? "")}
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => void logout()}
            aria-label="Cerrar sesión"
          >
            <span className="icon">logout</span>
          </button>
        </div>
      </header>

      <main className="app-content">{children}</main>

      <nav className="bottom-nav">
        {navItems.filter((item) => !item.desktopOnly).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item--active" : ""}`
            }
          >
            <span className="icon">{item.icon}</span>
            <span className="nav-item__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
