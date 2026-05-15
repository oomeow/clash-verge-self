import { useDebounce } from "ahooks";
import { useEffect, useRef, useState } from "react";

import {
  defaultThemeSettings,
  useThemeModeStore,
  useThemeSettingsStore,
} from "@/stores";
import { ThemeSetting } from "@/stores/themeStore";

interface Props {
  label: string;
  themeKey: keyof IVergeThemeSettings;
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
      : defaultThemeSettings.dark)) as ThemeSetting;
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
          className="cursor-pointer border-2 border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-300"
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
