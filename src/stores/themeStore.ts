import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { defaultDarkTheme, defaultTheme } from "@/pages/_theme";

type ThemeMode = "light" | "dark";

type ThemeKey =
  | "primary_color"
  | "secondary_color"
  | "primary_text"
  | "secondary_text"
  | "info_color"
  | "error_color"
  | "warning_color"
  | "success_color"
  | "font_family"
  | "css_injection";

interface ThemeSettings {
  light: IVergeConfig["light_theme_setting"];
  dark: IVergeConfig["dark_theme_setting"];
}

const toThemeSetting = (
  theme: typeof defaultTheme,
): IVergeConfig["light_theme_setting"] => ({
  primary_color: theme.primary_color,
  secondary_color: theme.secondary_color,
  primary_text: theme.primary_text,
  secondary_text: theme.secondary_text,
  info_color: theme.info_color,
  error_color: theme.error_color,
  warning_color: theme.warning_color,
  success_color: theme.success_color,
  font_family: theme.font_family,
});

const isSameThemeSetting = (
  left:
    | IVergeConfig["light_theme_setting"]
    | IVergeConfig["dark_theme_setting"],
  right:
    | IVergeConfig["light_theme_setting"]
    | IVergeConfig["dark_theme_setting"],
) => JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});

export const defaultThemeSettings: ThemeSettings = {
  light: toThemeSetting(defaultTheme),
  dark: toThemeSetting(defaultDarkTheme),
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
    setThemeMode: (mode) =>
      set((state) => {
        if (state.themeMode === mode) {
          return;
        }
        state.themeMode = mode;
      }),
  })),
);

type ThemeSettingsState = {
  themeSettings: ThemeSettings;
};

type ThemeSettingsActions = {
  setLightThemeSetting: (setting: IVergeConfig["light_theme_setting"]) => void;
  setDarkThemeSetting: (setting: IVergeConfig["dark_theme_setting"]) => void;
  setThemeColor: (mode: ThemeMode, key: ThemeKey, value: string) => void;
  resetLightThemeSetting: () => void;
  resetDarkThemeSetting: () => void;
};

export const useThemeSettingsStore = create<
  ThemeSettingsState & ThemeSettingsActions
>()(
  persist(
    immer((set) => ({
      themeSettings: defaultThemeSettings,
      setLightThemeSetting: (setting) =>
        set((state) => {
          if (isSameThemeSetting(state.themeSettings.light, setting)) {
            return;
          }
          state.themeSettings.light = setting;
        }),
      setDarkThemeSetting: (setting) =>
        set((state) => {
          if (isSameThemeSetting(state.themeSettings.dark, setting)) {
            return;
          }
          state.themeSettings.dark = setting;
        }),
      setThemeColor: (mode, key, value) =>
        set((state) => {
          if (state.themeSettings[mode]?.[key] === value) {
            return;
          }
          state.themeSettings[mode] = {
            ...state.themeSettings[mode],
            [key]: value,
          };
        }),
      resetLightThemeSetting: () =>
        set((state) => {
          state.themeSettings.light = { ...defaultThemeSettings.light };
        }),
      resetDarkThemeSetting: () =>
        set((state) => {
          state.themeSettings.dark = { ...defaultThemeSettings.dark };
        }),
    })),
    {
      name: "theme_settings",
      version: 2,
    },
  ),
);
