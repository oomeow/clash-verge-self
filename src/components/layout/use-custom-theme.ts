import {
  alpha,
  createTheme,
  CssVarsThemeOptions,
  Theme,
  ThemeOptions,
} from "@mui/material";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useMemo } from "react";

import { defaultDarkTheme, defaultTheme } from "@/pages/_theme";
import { useVergeStore } from "@/stores";
import {
  normalizeThemeSetting,
  useThemeModeStore,
  useThemeSettingsStore,
} from "@/stores";
import { ThemeMode } from "@/stores/themeStore";

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

function createCustomTheme(themeMode: ThemeMode, setting: IVergeThemeSettings) {
  const rootElement = document.getElementById("root");
  return {
    cssVariables: true,
    shape: { borderRadius: 8 },
    breakpoints: {
      values: { xs: 0, sm: 650, md: 900, lg: 1200, xl: 1536 },
    },
    palette: {
      mode: themeMode,
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
      background: {
        default: setting.background_color!,
        paper: setting.paper_background_color!,
        // paper: "#DDE8FD",
        // paper: "#020511",
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
  } as CustomThemeOptions;
}

export const useCustomTheme = () => {
  const vergeThemeMode = useVergeStore((s) => s.verge.theme_mode);
  const language = useVergeStore((s) => s.verge.language);
  const patchVerge = useVergeStore((s) => s.patchVerge);
  const currentThemeMode = useThemeModeStore((s) => s.themeMode);
  const setMode = useThemeModeStore((s) => s.setThemeMode);
  const themeSettings = useThemeSettingsStore((s) => s.themeSettings);

  useEffect(() => {
    if (!vergeThemeMode) return;
    const themeMode = ["light", "dark", "system"].includes(vergeThemeMode!)
      ? vergeThemeMode!
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
  }, [vergeThemeMode]);

  const theme = useMemo(() => {
    const setting = normalizeThemeSetting(
      currentThemeMode,
      themeSettings[currentThemeMode],
    );
    const isDark = currentThemeMode === "dark";

    const defaultThemeObj = createCustomTheme(
      currentThemeMode,
      isDark ? defaultDarkTheme : defaultTheme,
    );
    const customThemeObj = createCustomTheme(currentThemeMode, setting);

    let theme: Theme;
    try {
      theme = createTheme(customThemeObj);
    } catch {
      // fix #294
      theme = createTheme(defaultThemeObj);
    }

    // css
    const selectColor = isDark ? "#d5d5d5" : "#f5f5f5";
    const scrollColor = isDark ? "#54545480" : "#90939980";
    const dividerColor = isDark
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(0, 0, 0, 0.06)";

    const rootEle = document.documentElement;
    rootEle.style.setProperty("--divider-color", dividerColor);
    rootEle.style.setProperty(
      "--background-color",
      theme.palette.background.default,
    );
    rootEle.style.setProperty("--selection-color", selectColor);
    rootEle.style.setProperty("--scroller-color", scrollColor);
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
  }, [currentThemeMode, themeSettings, language]);

  const toggleTheme = async (changeMode: "light" | "dark" | "system") => {
    let nextThemeMode: ThemeMode;
    if (changeMode === "system") {
      const appTheme = (await appWindow.theme()) ?? "light";
      nextThemeMode = appTheme;
    } else {
      nextThemeMode = changeMode;
    }
    if (currentThemeMode === nextThemeMode) {
      patchVerge({ theme_mode: changeMode });
      return;
    }

    if (currentThemeMode === "dark") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
    // set next theme mode
    setMode(nextThemeMode);
    patchVerge({ theme_mode: changeMode });
  };

  return { theme, toggleTheme };
};
