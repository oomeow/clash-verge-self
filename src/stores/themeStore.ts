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

interface ThemeModeState {
  themeMode: ThemeMode;
  setThemeMode: (next: ThemeMode) => void;
}

export const useThemeModeStore = create<ThemeModeState>()(
  devtools(
    immer((set) => ({
      themeMode: "light",
      setThemeMode: (next) =>
        set(
          (state) => {
            state.themeMode = next;
          },
          false,
          "themeMode/setThemeMode",
        ),
    })),
    { name: "themeModeStore" },
  ),
);

interface ThemeSettingsState {
  themeSettings: ThemeSettings;
  setThemeSettings: (next: ThemeSettings) => void;
}

export const useThemeSettingsStore = create<ThemeSettingsState>()(
  devtools(
    persist(
      immer((set) => ({
        themeSettings: defaultThemeSettings,
        setThemeSettings: (next) =>
          set(
            (state) => {
              state.themeSettings = next;
            },
            false,
            "themeSettings/setThemeSettings",
          ),
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
