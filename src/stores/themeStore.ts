import { create } from "zustand";
import { persist } from "zustand/middleware";

import { defaultDarkTheme, defaultTheme, THEME_PRESETS } from "@/pages/_theme";

export type ThemeMode = "light" | "dark";
export type ThemeSetting = NonNullable<IVergeThemeSettings>;

const THEME_COLOR_KEYS = [
  "primary_color",
  "secondary_color",
  "primary_text",
  "secondary_text",
  "info_color",
  "error_color",
  "warning_color",
  "success_color",
  "background_color",
  "paper_background_color",
] as const satisfies readonly (keyof ThemeSetting)[];

const THEME_KEYS = [
  ...THEME_COLOR_KEYS,
  "font_family",
  "css_injection",
] as const satisfies readonly (keyof ThemeSetting)[];

type ThemeKey = keyof ThemeSetting;

interface ThemeSettings {
  light: IVergeThemeSettings;
  dark: IVergeThemeSettings;
  currentTheme?: string;
}

export const isSameThemeColors = (
  left: IVergeThemeSettings,
  right: IVergeThemeSettings,
) =>
  THEME_COLOR_KEYS.every((key) => {
    const leftValue = left?.[key] ?? null;
    const rightValue = right?.[key] ?? null;
    return leftValue === rightValue;
  });

export const isSameThemeSetting = (
  left: IVergeThemeSettings,
  right: IVergeThemeSettings,
) =>
  THEME_KEYS.every((key) => {
    const leftValue = left?.[key] ?? null;
    const rightValue = right?.[key] ?? null;
    return leftValue === rightValue;
  });

export const defaultThemeSettings: ThemeSettings = {
  light: defaultTheme,
  dark: defaultDarkTheme,
};

/// normalize theme setting with fallback default theme
export const normalizeThemeSetting = (
  mode: ThemeMode,
  setting: IVergeThemeSettings | undefined,
) => {
  const fallback =
    mode === "light" ? defaultThemeSettings.light : defaultThemeSettings.dark;

  return {
    ...fallback,
    ...Object.fromEntries(
      Object.entries(setting ?? {}).filter(([, value]) => value != null),
    ),
  } as ThemeSetting;
};

type ThemeModeState = {
  themeMode: ThemeMode;
};

type ThemeModeActions = {
  setThemeMode: (mode: ThemeMode) => void;
};

export const useThemeModeStore = create<ThemeModeState & ThemeModeActions>()(
  (set) => ({
    themeMode: "light",
    setThemeMode: (mode) =>
      set((state) => {
        if (state.themeMode === mode) {
          return state;
        }
        return { themeMode: mode };
      }),
  }),
);

type ThemeSettingsState = {
  themeSettings: ThemeSettings;
};

type ThemeSettingsActions = {
  setLightThemeSetting: (setting: IVergeConfig["theme_setting"]) => void;
  setDarkThemeSetting: (setting: IVergeConfig["theme_setting"]) => void;
  setThemeColor: (mode: ThemeMode, key: ThemeKey, value: string) => void;
  resetLightThemeSetting: () => void;
  resetDarkThemeSetting: () => void;
  syncThemeSettings: (verge: IVergeConfig) => void;
  setCurrentTheme: (preset: string) => void;
};

export const useThemeSettingsStore = create<
  ThemeSettingsState & ThemeSettingsActions
>()(
  persist(
    (set) => ({
      themeSettings: defaultThemeSettings,
      setLightThemeSetting: (setting) =>
        set((state) => {
          const nextSetting = normalizeThemeSetting("light", setting);
          if (isSameThemeSetting(state.themeSettings.light, nextSetting)) {
            return state;
          }
          return {
            themeSettings: {
              ...state.themeSettings,
              light: nextSetting,
            },
          };
        }),
      setDarkThemeSetting: (setting) =>
        set((state) => {
          const nextSetting = normalizeThemeSetting("dark", setting);
          if (isSameThemeSetting(state.themeSettings.dark, nextSetting)) {
            return state;
          }
          return {
            themeSettings: {
              ...state.themeSettings,
              dark: nextSetting,
            },
          };
        }),
      setThemeColor: (mode, key, value) =>
        set((state) => {
          if (state.themeSettings[mode]?.[key] === value) {
            return state;
          }
          return {
            themeSettings: {
              ...state.themeSettings,
              [mode]: {
                ...state.themeSettings[mode],
                [key]: value,
              },
            },
          };
        }),
      resetLightThemeSetting: () =>
        set((state) => {
          return {
            themeSettings: {
              ...state.themeSettings,
              light: { ...defaultThemeSettings.light },
            },
          };
        }),
      resetDarkThemeSetting: () =>
        set((state) => {
          return {
            themeSettings: {
              ...state.themeSettings,
              dark: { ...defaultThemeSettings.dark },
            },
          };
        }),
      setCurrentTheme: (preset) =>
        set((state) => {
          if (state.themeSettings.currentTheme === preset) return state;
          return {
            themeSettings: {
              ...state.themeSettings,
              currentTheme: preset,
            },
          };
        }),
      syncThemeSettings: (verge) => {
        set((state) => {
          const { light_theme_setting, dark_theme_setting } = verge;
          const nextLight = normalizeThemeSetting("light", light_theme_setting);
          const nextDark = normalizeThemeSetting("dark", dark_theme_setting);
          if (
            isSameThemeSetting(nextLight, state.themeSettings.light) &&
            isSameThemeSetting(nextDark, state.themeSettings.dark)
          ) {
            return state;
          }

          const detectedPreset =
            THEME_PRESETS.find((p) => {
              return (
                isSameThemeColors(nextLight, p.light) &&
                isSameThemeColors(nextDark, p.dark)
              );
            })?.name ?? "custom";

          return {
            themeSettings: {
              light: nextLight,
              dark: nextDark,
              currentTheme: detectedPreset,
            },
          };
        });
      },
    }),
    {
      name: "theme_settings",
      version: 1,
    },
  ),
);
