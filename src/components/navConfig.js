import { Home, Dumbbell, Utensils, User as UserIcon } from "lucide-react";

// Single source of truth for the navigation tabs.
// Imported by AppHeader (desktop top tabbar) and BottomNav (mobile bottom tabbar).
export const NAV_ITEMS = [
	{ id: "dashboard", label: "Inicio", icon: Home },
	{ id: "routines", label: "Rutinas", icon: Dumbbell },
	{ id: "diet", label: "Dieta", icon: Utensils },
	{ id: "settings", label: "Perfil", icon: UserIcon },
];
