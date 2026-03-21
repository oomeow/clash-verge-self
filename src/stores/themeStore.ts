import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

type ThemeMode = "light" | "dark";

interface ThemeSettings {
  light: IVergeConfig["light_theme_setting"];
  dark: IVergeConfig["dark_theme_setting"];
}

const defaultThemeSettings: ThemeSettings = {
  light: {},
  dark: {},
};

interface ThemeModeState {
  themeMode: ThemeMode;
  setThemeMode: (next: Updater<ThemeMode>) => void;
}

export const useThemeModeStore = create<ThemeModeState>((set) => ({
  themeMode: "light",
  setThemeMode: (next) =>
    set((state) => ({
      themeMode: applyUpdater(next, state.themeMode),
    })),
}));

export const useThemeMode = () => useThemeModeStore((s) => s.themeMode);
export const useSetThemeMode = () => useThemeModeStore((s) => s.setThemeMode);

interface ThemeSettingsState {
  themeSettings: ThemeSettings;
  setThemeSettings: (next: Updater<ThemeSettings>) => void;
}

export const useThemeSettingsStore = create<ThemeSettingsState>()(
  persist(
    (set) => ({
      themeSettings: defaultThemeSettings,
      setThemeSettings: (next) =>
        set((state) => ({
          themeSettings: applyUpdater(next, state.themeSettings),
        })),
    }),
    {
      name: "theme_settings",
      version: 1,
      partialize: (state) => ({ themeSettings: state.themeSettings }),
    },
  ),
);

export const useThemeSettings = () =>
  useThemeSettingsStore((s) => s.themeSettings);

export const useSetThemeSettings = () =>
  useThemeSettingsStore((s) => s.setThemeSettings);
