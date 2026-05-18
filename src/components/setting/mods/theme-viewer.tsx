import {
  Box,
  Button,
  ButtonGroup,
  Input,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BaseDialog, DialogRef, EditorViewer } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useCustomTheme } from "@/components/layout/use-custom-theme";
import { THEME_PRESETS } from "@/pages/_theme";
import { useVergeStore } from "@/stores";
import {
  defaultThemeSettings,
  useThemeModeStore,
  useThemeSettingsStore,
} from "@/stores";
import { isSameThemeColors, normalizeThemeSetting } from "@/stores/themeStore";

import ThemeColorSelect from "./theme-color-select";

export const ThemeViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();

  const [open, setOpen] = useState(false);
  const lightThemeSetting = useVergeStore((s) => s.verge.light_theme_setting);
  const darkThemeSetting = useVergeStore((s) => s.verge.dark_theme_setting);
  const patchVerge = useVergeStore((s) => s.patchVerge);
  const { toggleTheme } = useCustomTheme();
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const themeSettings = useThemeSettingsStore((s) => s.themeSettings);
  const setThemeColor = useThemeSettingsStore((s) => s.setThemeColor);
  const setLightThemeSetting = useThemeSettingsStore(
    (s) => s.setLightThemeSetting,
  );
  const setDarkThemeSetting = useThemeSettingsStore(
    (s) => s.setDarkThemeSetting,
  );
  const setCurrentTheme = useThemeSettingsStore((s) => s.setCurrentTheme);
  const resetLightThemeSetting = useThemeSettingsStore(
    (s) => s.resetLightThemeSetting,
  );
  const resetDarkThemeSetting = useThemeSettingsStore(
    (s) => s.resetDarkThemeSetting,
  );

  const currentThemeSetting =
    themeMode === "light" ? themeSettings.light : themeSettings.dark;
  const theme = normalizeThemeSetting(themeMode, currentThemeSetting);
  const [editorOpen, setEditorOpen] = useState(false);

  const presetName = useMemo(() => {
    return (
      THEME_PRESETS.find((preset) => {
        const target = themeMode === "light" ? preset.light : preset.dark;
        return isSameThemeColors(
          currentThemeSetting ?? ({} as IVergeThemeSettings),
          target,
        );
      })?.name ?? "custom"
    );
  }, [themeMode, currentThemeSetting]);

  const handlePresetChange = (name: string) => {
    if (name === "custom") return;
    const preset = THEME_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    const target = themeMode === "light" ? preset.light : preset.dark;
    Object.entries(target).forEach(([key, value]) => {
      if (key !== "font_family" && typeof value === "string") {
        setThemeColor(themeMode, key as keyof IVergeThemeSettings, value);
      }
    });
    setCurrentTheme(name);
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  const textProps = {
    size: "small",
    autoComplete: "off",
    sx: { width: 135 },
  } as const;

  const handleChange = (field: "font_family") => (e: any) => {
    const value = e.target.value as string;
    setThemeColor(themeMode, field, value);
  };

  const handleCSSInjection = (css: string) => {
    setThemeColor(themeMode, "css_injection", css);
  };

  const onSave = useLockFn(async () => {
    try {
      patchVerge({
        light_theme_setting: themeSettings.light,
        dark_theme_setting: themeSettings.dark,
      });
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  });

  return (
    <BaseDialog
      open={open}
      maxWidth="xs"
      fullWidth
      title={
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="h6">
            {t("pages.settings.verge.theme.title")}
          </Typography>
          <div className="flex items-center justify-between">
            <Button
              sx={{ textTransform: "capitalize" }}
              size="small"
              variant="outlined"
              className="text-text-primary! mr-2!"
              onClick={() => {
                if (themeMode === "light") {
                  resetLightThemeSetting();
                } else {
                  resetDarkThemeSetting();
                }
              }}>
              {t("pages.settings.verge.theme.default")}
            </Button>
            <ButtonGroup size="small">
              <Button
                sx={{ textTransform: "capitalize" }}
                variant={themeMode === "light" ? "contained" : "outlined"}
                onClick={() => {
                  toggleTheme("light");
                }}>
                {t("pages.settings.verge.themeMode.options.light")}
              </Button>
              <Button
                sx={{ textTransform: "capitalize" }}
                variant={themeMode === "dark" ? "contained" : "outlined"}
                onClick={() => {
                  toggleTheme("dark");
                }}>
                {t("pages.settings.verge.themeMode.options.dark")}
              </Button>
            </ButtonGroup>
          </div>
        </Box>
      }
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      onClose={() => {
        setLightThemeSetting(lightThemeSetting ?? defaultThemeSettings.light);
        setDarkThemeSetting(darkThemeSetting ?? defaultThemeSettings.dark);
        setOpen(false);
      }}
      onCancel={() => {
        setLightThemeSetting(lightThemeSetting ?? defaultThemeSettings.light);
        setDarkThemeSetting(darkThemeSetting ?? defaultThemeSettings.dark);
        setOpen(false);
      }}
      onOk={onSave}>
      <List sx={{ pt: 0 }}>
        <ListItem className="px-0.5 py-1.25">
          <ListItemText
            primary={t("pages.settings.verge.theme.currentTheme")}
          />
          <Select
            size="small"
            value={presetName}
            onChange={(e) => handlePresetChange(e.target.value)}
            sx={{ width: 180, "> div": { py: "7.5px" } }}
            renderValue={(v) =>
              v === "custom"
                ? t("pages.settings.verge.theme.presets.custom")
                : t(`pages.settings.verge.theme.presets.${v}`)
            }>
            {THEME_PRESETS.map((preset) => (
              <MenuItem key={preset.name} value={preset.name}>
                {t(`pages.settings.verge.theme.presets.${preset.name}`)}
              </MenuItem>
            ))}
          </Select>
        </ListItem>

        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.primary")}
          themeKey="primary_color"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.secondary")}
          themeKey="secondary_color"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.primaryText")}
          themeKey="primary_text"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.secondaryText")}
          themeKey="secondary_text"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.info")}
          themeKey="info_color"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.error")}
          themeKey="error_color"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.warning")}
          themeKey="warning_color"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.success")}
          themeKey="success_color"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.background")}
          themeKey="background_color"
        />
        <ThemeColorSelect
          label={t("pages.settings.verge.theme.colors.paperBackground")}
          themeKey="paper_background_color"
        />

        <ListItem className="px-0.5 py-1.25">
          <ListItemText primary={t("pages.settings.verge.theme.fontFamily")} />
          <TextField
            {...textProps}
            variant="standard"
            sx={{ width: 230 }}
            value={theme.font_family ?? ""}
            onChange={handleChange("font_family")}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
          />
        </ListItem>

        <ListItem className="px-0.5 py-1.25">
          <ListItemText
            primary={t("pages.settings.verge.theme.cssInjection")}
          />
          <Input
            value={theme.css_injection ?? ""}
            disabled
            sx={{ width: 230 }}
            endAdornment={
              <Button
                sx={{ textTransform: "capitalize" }}
                onClick={() => setEditorOpen(true)}>
                {t("common.actions.edit")}
              </Button>
            }
          />
        </ListItem>
        <EditorViewer
          open={editorOpen}
          language="css"
          property={theme.css_injection ?? ""}
          onChange={(css) => handleCSSInjection(css)}
          onClose={() => setEditorOpen(false)}
        />
      </List>
    </BaseDialog>
  );
});

export default ThemeViewer;
