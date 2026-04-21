import { useDebounce } from "ahooks";
import { useEffect, useRef, useState } from "react";

import {
  defaultThemeSettings,
  useThemeModeStore,
  useThemeSettingsStore,
} from "@/stores";

type ThemeKey =
  | "primary_color"
  | "secondary_color"
  | "primary_text"
  | "secondary_text"
  | "info_color"
  | "error_color"
  | "warning_color"
  | "success_color";

interface Props {
  label: string;
  themeKey: ThemeKey;
}

const ThemeColorSelect = (props: Props) => {
  const { label, themeKey } = props;
  const themeSettings = useThemeSettingsStore((s) => s.themeSettings);
  const setThemeColor = useThemeSettingsStore((s) => s.setThemeColor);
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const currentThemeSetting =
    themeMode === "light" ? themeSettings.light : themeSettings.dark;
  const theme = (currentThemeSetting ??
    (themeMode === "light"
      ? defaultThemeSettings.light
      : defaultThemeSettings.dark)) as NonNullable<
    IVergeConfig["light_theme_setting"]
  >;
  const [color, setColor] = useState<string>(theme[themeKey] ?? "");
  const debounceValue = useDebounce(color, { wait: 300 });
  const skipNextCommitRef = useRef(false);
  const lastThemeColorRef = useRef(theme[themeKey] ?? "");

  useEffect(() => {
    const nextColor = theme[themeKey] ?? "";
    if (lastThemeColorRef.current === nextColor) return;

    lastThemeColorRef.current = nextColor;
    skipNextCommitRef.current = true;
    setColor(nextColor);
  }, [theme, themeKey]);

  useEffect(() => {
    if (skipNextCommitRef.current) {
      skipNextCommitRef.current = false;
      return;
    }
    if (debounceValue !== color) return;
    if (theme[themeKey] === debounceValue) return;
    setThemeColor(themeMode, themeKey, debounceValue);
  }, [color, debounceValue, setThemeColor, themeKey, themeMode, theme]);

  return (
    <div className="text-primary-text my-1 flex h-12 items-center justify-between px-1">
      <p className="text-lg">{label}</p>
      <div className="flex w-37.5 items-center justify-between">
        <input
          className="cursor-pointer border-none bg-transparent outline-hidden"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <p className="text-gray-400">{color}</p>
      </div>
    </div>
  );
};

export default ThemeColorSelect;
