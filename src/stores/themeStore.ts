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
  setThemeMode: (next: ThemeMode) => void;
};

export const useThemeModeStore = create<ThemeModeState & ThemeModeActions>()(
  devtools(
    immer((set) => ({
      themeMode: "light",
      setThemeMode: (next) => set((state) => (state.themeMode = next)),
    })),
    { name: "themeModeStore" },
  ),
);

type ThemeSettingsState = {
  themeSettings: ThemeSettings;
};

type ThemeSettingsActions = {
  setThemeSettings: (next: ThemeSettings) => void;
};

export const useThemeSettingsStore = create<
  ThemeSettingsState & ThemeSettingsActions
>()(
  devtools(
    persist(
      immer((set) => ({
        themeSettings: defaultThemeSettings,
        setThemeSettings: (next) =>
          set((state) => (state.themeSettings = next)),
      })),
      {
        name: "theme_settings",
        version: 1,
        partialize: (state) => ({ themeSettings: state.themeSettings }),
      },
    ),
    { name: "themeSettingsStore" },
  ),
);
