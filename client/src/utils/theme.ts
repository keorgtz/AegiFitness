export type Theme = "light" | "dark";

const STORAGE_KEY = "aegi-theme";
const listeners = new Set<(theme: Theme) => void>();

export function getTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#101118" : "#f5f6fb");
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage no disponible */
  }
  applyTheme(theme);
  // Transición suave solo durante el cambio explícito
  document.documentElement.classList.add("theme-anim");
  window.setTimeout(() => {
    document.documentElement.classList.remove("theme-anim");
  }, 300);
  listeners.forEach((l) => l(theme));
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function subscribeTheme(listener: (theme: Theme) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
