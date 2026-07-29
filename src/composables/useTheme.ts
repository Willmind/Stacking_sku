import { readonly, ref } from "vue";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

export const THEME_STORAGE_KEY = "STACKING_SKU_THEME_MODE";

const themeMode = ref<ThemeMode>("system");
const resolvedTheme = ref<ResolvedTheme>("dark");
let colorSchemeQuery: MediaQueryList | null = null;
let initialized = false;

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(storedMode) ? storedMode : "system";
  } catch {
    return "system";
  }
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode, systemTheme = readSystemTheme()) {
  const nextResolvedTheme = mode === "system" ? systemTheme : mode;
  themeMode.value = mode;
  resolvedTheme.value = nextResolvedTheme;

  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = nextResolvedTheme;
  root.style.colorScheme = nextResolvedTheme;
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  if (themeMode.value === "system") applyTheme("system", event.matches ? "dark" : "light");
}

export function initializeTheme() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const preloadedMode = document.documentElement.dataset.themeMode;
  const initialMode = isThemeMode(preloadedMode) ? preloadedMode : readStoredThemeMode();
  applyTheme(initialMode);

  if (typeof window.matchMedia !== "function") return;
  colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  colorSchemeQuery.addEventListener("change", handleSystemThemeChange);
}

export function setThemeMode(mode: ThemeMode) {
  if (!isThemeMode(mode)) return;
  initializeTheme();
  applyTheme(mode);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // localStorage may be unavailable in restricted browser contexts.
  }
}

export function disposeTheme() {
  colorSchemeQuery?.removeEventListener("change", handleSystemThemeChange);
  colorSchemeQuery = null;
  initialized = false;
}

export function useTheme() {
  initializeTheme();
  return {
    themeMode: readonly(themeMode),
    resolvedTheme: readonly(resolvedTheme),
    setThemeMode,
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(disposeTheme);
}
