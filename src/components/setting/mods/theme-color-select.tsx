import { useDebounce } from "ahooks";
import { useEffect, useRef, useState } from "react";

import {
  defaultThemeSettings,
  useThemeModeStore,
  useThemeSettingsStore,
} from "@/stores";
import { isSameThemeSetting, ThemeSetting } from "@/stores/themeStore";
import { cn } from "@/utils";

interface Props {
  label: string;
  themeKey: keyof IVergeThemeSettings;
  disabled?: boolean;
}

const hexRegex = /^#[0-9a-fA-F]{6}$/;

const ThemeColorSelect = (props: Props) => {
  const { label, themeKey, disabled = false } = props;
  const themeSettings = useThemeSettingsStore((s) => s.themeSettings);
  const setThemeColor = useThemeSettingsStore((s) => s.setThemeColor);
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const currentThemeSetting =
    themeMode === "light" ? themeSettings.light : themeSettings.dark;
  const theme = (currentThemeSetting ??
    (themeMode === "light"
      ? defaultThemeSettings.light
      : defaultThemeSettings.dark)) as ThemeSetting;
  const themeKeyDefaultColor =
    defaultThemeSettings[themeMode]?.[themeKey] ?? "";
  const [color, setColor] = useState<string>(theme[themeKey] ?? "");
  const [inputValue, setInputValue] = useState<string>(theme[themeKey] ?? "");
  const debounceValue = useDebounce(color, { wait: 300 });
  const skipNextCommitRef = useRef(false);
  const userClearedRef = useRef(false);
  const lastThemeRef = useRef(theme);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSameThemeSetting(lastThemeRef.current, theme)) {
      if (userClearedRef.current) {
        setInputValue(theme[themeKey] ?? "");
        userClearedRef.current = false;
      }
      return;
    }
    lastThemeRef.current = theme;

    const nextColor = theme[themeKey] ?? "";
    skipNextCommitRef.current = true;
    setColor(nextColor);
    if (!userClearedRef.current) {
      setInputValue(nextColor);
    }
    userClearedRef.current = false;
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

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    userClearedRef.current = false;
    setColor(val);
    setInputValue(val);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val === "") {
      userClearedRef.current = true;
      setColor(themeKeyDefaultColor);
      setThemeColor(themeMode, themeKey, themeKeyDefaultColor);
    } else if (hexRegex.test(val)) {
      userClearedRef.current = false;
      setColor(val);
      setThemeColor(themeMode, themeKey, val);
    }
  };

  return (
    <div
      className={cn(
        "text-text-primary my-1 flex h-12 items-center justify-between px-1",
        disabled && "opacity-50",
      )}>
      <p>{label}</p>
      <div className="flex w-37.5 items-center justify-between gap-2">
        <div className="relative">
          <div
            className="h-8 w-8 rounded-md border-2 border-gray-400"
            style={{ backgroundColor: color || "#000000" }}
          />
          <input
            ref={colorInputRef}
            className="absolute inset-0 opacity-0"
            type="color"
            value={color}
            disabled={disabled}
            onChange={handleColorPickerChange}
          />
        </div>
        <input
          className="w-22 rounded border border-gray-400 bg-transparent px-2 py-1 text-xs"
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={handleInputChange}
          placeholder={themeKeyDefaultColor || "#000000"}
          maxLength={7}
        />
      </div>
    </div>
  );
};

export default ThemeColorSelect;
