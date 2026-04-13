import { useVerge } from "@/hooks/use-verge";
import {
  normalizeThemeSetting,
  useThemeModeStore,
  useThemeSettingsStore,
} from "@/stores";
import {
  alpha,
  createTheme,
  CssVarsThemeOptions,
  Shadows,
  Theme,
  ThemeOptions,
} from "@mui/material";
import { enUS, zhCN } from "@mui/x-data-grid/locales";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MouseEvent, useEffect, useMemo } from "react";
const appWindow = getCurrentWebviewWindow();

/**
 * custom theme
 */
type CustomThemeOptions = Omit<ThemeOptions, "components"> &
  Pick<
    CssVarsThemeOptions,
    "defaultColorScheme" | "colorSchemes" | "components"
  > & {
    cssVariables?:
      | boolean
      | Pick<
          CssVarsThemeOptions,
          | "colorSchemeSelector"
          | "rootSelector"
          | "disableCssColorScheme"
          | "cssVarPrefix"
          | "shouldSkipGeneratingVar"
        >;
  };

export const useCustomTheme = () => {
  const { verge, patchVerge } = useVerge();
  const { theme_mode, language } = verge ?? {};
  const mode = useThemeModeStore((s) => s.themeMode);
  const setMode = useThemeModeStore((s) => s.setThemeMode);
  const themeSettings = useThemeSettingsStore((s) => s.themeSettings);

  useEffect(() => {
    if (!theme_mode) return;
    const themeMode = ["light", "dark", "system"].includes(theme_mode!)
      ? theme_mode!
      : "light";
    if (themeMode !== "system") {
      setMode(themeMode);
      return;
    }
    appWindow.theme().then((m) => m && setMode(m));
    const unlisten = appWindow.onThemeChanged((e) => setMode(e.payload));

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [theme_mode]);

  const theme = useMemo(() => {
    const setting = normalizeThemeSetting(mode, themeSettings[mode]);
    const isDark = mode === "dark";

    const muiDataGridLocale = language === "zh" ? zhCN : enUS;
    const rootElement = document.getElementById("root");

    const defaultThemeObj: CustomThemeOptions = {
      cssVariables: true,
      breakpoints: {
        values: { xs: 0, sm: 650, md: 900, lg: 1200, xl: 1536 },
      },
      palette: {
        mode,
        primary: { main: setting.primary_color! },
        secondary: { main: setting.secondary_color! },
        info: { main: setting.info_color! },
        error: { main: setting.error_color! },
        warning: { main: setting.warning_color! },
        success: { main: setting.success_color! },
        text: {
          primary: setting.primary_text!,
          secondary: setting.secondary_text!,
        },
      },
      typography: { fontFamily: setting.font_family! },
      // All `Portal`-related components need to have the the main app wrapper element as a container
      // so that the are in the subtree under the element used in the `important` option of the Tailwind's config.
      components: {
        MuiPopover: {
          defaultProps: {
            container: rootElement,
          },
          styleOverrides: {
            paper: {
              boxShadow:
                "0px 5px 5px -3px rgba(0,0,0,0.2),0px 8px 10px 1px rgba(0,0,0,0.14),0px 3px 14px 2px rgba(0,0,0,0.12)",
            },
          },
        },
        MuiPopper: {
          defaultProps: {
            container: rootElement,
          },
        },
        MuiDialog: {
          defaultProps: {
            container: rootElement,
          },
        },
        MuiModal: {
          defaultProps: {
            container: rootElement,
          },
        },
      },
    };

    const customThemeObj: CustomThemeOptions = {
      ...defaultThemeObj,
      palette: {
        ...defaultThemeObj.palette,
        background: {
          paper: isDark ? "#2E303D" : "#F5F5F5",
        },
      },
      shadows: Array(25).fill("none") as Shadows,
      typography: { fontFamily: setting.font_family! },
    };

    let theme: Theme;
    try {
      theme = createTheme(customThemeObj, muiDataGridLocale);
    } catch {
      // fix #294
      theme = createTheme(defaultThemeObj, muiDataGridLocale);
    }

    // css
    const backgroundColor = isDark ? "#2e303d" : "#f0f0f0";
    const selectColor = isDark ? "#d5d5d5" : "#f5f5f5";
    const scrollColor = isDark ? "#54545480" : "#90939980";
    const dividerColor = isDark
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(0, 0, 0, 0.06)";

    const rootEle = document.documentElement;
    rootEle.style.setProperty("--divider-color", dividerColor);
    rootEle.style.setProperty("--background-color", backgroundColor);
    rootEle.style.setProperty("--selection-color", selectColor);
    rootEle.style.setProperty("--scroller-color", scrollColor);
    rootEle.style.setProperty("--primary-main", theme.palette.primary.main);
    rootEle.style.setProperty(
      "--background-color-alpha",
      alpha(theme.palette.primary.main, 0.1),
    );

    // inject css
    let style = document.querySelector("style#verge-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "verge-theme";
      document.head.appendChild(style!);
    }
    if (style) {
      style.innerHTML = setting?.css_injection || "";
    }

    // update svg icon
    const { palette } = theme;
    setTimeout(() => {
      const dom = document.querySelector("#Gradient2");
      if (dom) {
        dom.innerHTML = `
        <stop offset="0%" stop-color="${palette.primary.main}" />
        <stop offset="80%" stop-color="${palette.primary.dark}" />
        <stop offset="100%" stop-color="${palette.primary.dark}" />
        `;
      }
    }, 0);

    // init current theme
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    return theme;
  }, [mode, themeSettings, language]);

  const toggleTheme = async (vergeThemeMode: "light" | "dark" | "system") => {
    let tmp: "light" | "dark" = "light";
    if (vergeThemeMode === "system") {
      const appTheme = await appWindow.theme();
      tmp = appTheme as "light" | "dark";
    } else {
      tmp = vergeThemeMode;
    }
    const nextThemeMode = tmp;
    if (mode === nextThemeMode) {
      patchVerge({ theme_mode: vergeThemeMode });
      return;
    }
    const isDark = nextThemeMode === "light";

    setMode(isDark ? "light" : "dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
    patchVerge({ theme_mode: vergeThemeMode });
  };

  return { theme, toggleTheme };
};

const isSameThemeSetting = (
  left: IVergeConfig["theme_setting"],
  right: IVergeConfig["theme_setting"],
) => JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});

export const useSyncThemeSettings = () => {
  const { verge } = useVerge();
  const { light_theme_setting, dark_theme_setting } = verge ?? {};

  useEffect(() => {
    if (!light_theme_setting || !dark_theme_setting) return;

    const { themeSettings, setLightThemeSetting, setDarkThemeSetting } =
      useThemeSettingsStore.getState();

    if (!isSameThemeSetting(light_theme_setting, themeSettings.light)) {
      setLightThemeSetting(light_theme_setting);
    }
    if (!isSameThemeSetting(dark_theme_setting, themeSettings.dark)) {
      setDarkThemeSetting(dark_theme_setting);
    }
  }, [dark_theme_setting, light_theme_setting]);
};
