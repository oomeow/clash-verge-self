import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type ThemeMode = "light" | "dark";

interface ThemeSettings {
  light: IVergeConfig["light_theme_setting"];
  dark: IVergeConfig["dark_theme_setting"];
}

const defaultThemeSettings: ThemeSettings = {
  light: {},
  dark: {},
};

type ThemeModeState = {
  themeMode: ThemeMode;
};

type ThemeModeActions = {
  setThemeMode: (mode: ThemeMode) => void;
};

export const useThemeModeStore = create<ThemeModeState & ThemeModeActions>()(
  immer((set) => ({
    themeMode: "light",
    setThemeMode: (mode) => set((state) => (state.themeMode = mode)),
  })),
);

type ThemeSettingsState = {
  themeSettings: ThemeSettings;
};

type ThemeSettingsActions = {
  setThemeSettings: (settings: ThemeSettings) => void;
};

export const useThemeSettingsStore = create<
  ThemeSettingsState & ThemeSettingsActions
>()(
  persist(
    immer((set) => ({
      themeSettings: defaultThemeSettings,
      setThemeSettings: (settings) =>
        set((state) => (state.themeSettings = settings)),
    })),
    {
      name: "theme_settings",
      version: 1,
    },
  ),
);
