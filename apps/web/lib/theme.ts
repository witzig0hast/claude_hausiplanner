export type Theme = "dark" | "light";
export type Accent = "green" | "blue" | "purple" | "orange" | "pink";

const THEME_KEY = "hausiplanner_theme";
const ACCENT_KEY = "hausiplanner_accent";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "green", label: "Grün", swatch: "#7fb69a" },
  { value: "blue", label: "Blau", swatch: "#5b9bd5" },
  { value: "purple", label: "Lila", swatch: "#a78bd6" },
  { value: "orange", label: "Orange", swatch: "#e08f4f" },
  { value: "pink", label: "Pink", swatch: "#d97aa8" },
];

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return (localStorage.getItem(THEME_KEY) as Theme) || "dark";
  } catch {
    return "dark";
  }
}

export function getStoredAccent(): Accent {
  if (typeof window === "undefined") return "green";
  try {
    return (localStorage.getItem(ACCENT_KEY) as Accent) || "green";
  } catch {
    return "green";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore - worst case the choice doesn't persist across reloads
  }
}

export function applyAccent(accent: Accent) {
  if (accent === "green") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", accent);
  }
  try {
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // ignore
  }
}

/** Call once on mount wherever the app shell renders, so a returning visitor's saved
 * theme/accent apply immediately instead of only after they revisit Settings. */
export function initTheme() {
  applyTheme(getStoredTheme());
  applyAccent(getStoredAccent());
}
