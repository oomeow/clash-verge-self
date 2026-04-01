import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
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
  devtools(
    immer((set) => ({
      themeMode: "light",
      setThemeMode: (mode) => set((state) => (state.themeMode = mode)),
    })),
    { name: "themeModeStore" },
  ),
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
  devtools(
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
    { name: "themeSettingsStore" },
  ),
);
