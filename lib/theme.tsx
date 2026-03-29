"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Theme = "dark" | "light" | "cyber-blue" | "warm-orange" | "forest-green";

const THEME_ORDER: Theme[] = ["dark", "light", "cyber-blue", "warm-orange", "forest-green"];
const THEME_LABELS: Record<Theme, string> = {
  dark: "深海暗夜",
  light: "极简浅色",
  "cyber-blue": "蓝色科技风",
  "warm-orange": "橙色暖调",
  "forest-green": "森林绿境",
};

/** 与专家战队页下拉一致，供侧栏 ThemeSwitcher、首页等共用 */
export const THEME_OPTIONS: Array<{ value: Theme; label: string }> = THEME_ORDER.map((value) => ({
  value,
  label: THEME_LABELS[value],
}));

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme;
    if (saved && THEME_ORDER.includes(saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("theme", t);
  }, []);

  const toggleTheme = useCallback(() => {
    const idx = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** 侧栏/顶栏：与首页「专家战队」相同的 5 套主题下拉，避免仅循环切换被误认为只有两套 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      className="min-w-0 max-w-[min(100%,12rem)] px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-medium hover:border-[var(--accent)] transition cursor-pointer text-[var(--text)]"
      title={`切换皮肤（${THEME_LABELS[theme]}）`}
      aria-label="Theme"
    >
      {THEME_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          🎨 {opt.label}
        </option>
      ))}
    </select>
  );
}

export function getThemeLabel(theme: Theme): string {
  return THEME_LABELS[theme];
}
