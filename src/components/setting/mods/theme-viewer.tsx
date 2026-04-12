import { BaseDialog, DialogRef, EditorViewer } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useCustomTheme } from "@/components/layout/use-custom-theme";
import { useVerge } from "@/hooks/use-verge";
import {
  defaultThemeSettings,
  useThemeModeStore,
  useThemeSettingsStore,
} from "@/stores";
import {
  Box,
  Button,
  ButtonGroup,
  Input,
  List,
  ListItem,
  ListItemText,
  styled,
  TextField,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import ThemeColorSelect from "./theme-color-select";

export const ThemeViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();

  const [open, setOpen] = useState(false);
  const { verge, patchVerge } = useVerge();
  const { light_theme_setting, dark_theme_setting } = verge || {};
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
  const resetLightThemeSetting = useThemeSettingsStore(
    (s) => s.resetLightThemeSetting,
  );
  const resetDarkThemeSetting = useThemeSettingsStore(
    (s) => s.resetDarkThemeSetting,
  );

  const currentThemeSetting =
    themeMode === "light" ? themeSettings.light : themeSettings.dark;
  const theme = (currentThemeSetting ??
    (themeMode === "light"
      ? defaultThemeSettings.light
      : defaultThemeSettings.dark)) as NonNullable<
    IVergeConfig["light_theme_setting"]
  >;
  const [editorOpen, setEditorOpen] = useState(false);

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
      title={
        <Box display="flex" justifyContent={"space-between"} gap={1}>
          <Typography variant="h6">
            {t("settings.verge.theme.title")}
          </Typography>
          <div className="flex items-center justify-between">
            <Button
              sx={{ textTransform: "capitalize" }}
              size="small"
              variant="outlined"
              className="text-primary-text! mr-2!"
              onClick={() => {
                if (themeMode === "light") {
                  resetLightThemeSetting();
                } else {
                  resetDarkThemeSetting();
                }
              }}>
              {t("settings.verge.theme.colors.default")}
            </Button>
            <ButtonGroup size="small">
              <Button
                sx={{ textTransform: "capitalize" }}
                variant={themeMode === "light" ? "contained" : "outlined"}
                onClick={(e) => {
                  toggleTheme(e, "light");
                }}>
                {t("settings.verge.themeMode.options.light")}
              </Button>
              <Button
                sx={{ textTransform: "capitalize" }}
                variant={themeMode === "dark" ? "contained" : "outlined"}
                onClick={(e) => {
                  toggleTheme(e, "dark");
                }}>
                {t("settings.verge.themeMode.options.dark")}
              </Button>
            </ButtonGroup>
          </div>
        </Box>
      }
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      onClose={() => {
        setLightThemeSetting(light_theme_setting ?? defaultThemeSettings.light);
        setDarkThemeSetting(dark_theme_setting ?? defaultThemeSettings.dark);
        setOpen(false);
      }}
      onCancel={() => {
        setLightThemeSetting(light_theme_setting ?? defaultThemeSettings.light);
        setDarkThemeSetting(dark_theme_setting ?? defaultThemeSettings.dark);
        setOpen(false);
      }}
      onOk={onSave}>
      <List sx={{ pt: 0 }}>
        <ThemeColorSelect label="Primary Color" themeKey="primary_color" />
        <ThemeColorSelect label="Secondary Color" themeKey="secondary_color" />
        <ThemeColorSelect label="Primary Text" themeKey="primary_text" />
        <ThemeColorSelect label="Secondary Text" themeKey="secondary_text" />
        <ThemeColorSelect label="Info Color" themeKey="info_color" />
        <ThemeColorSelect label="Error Color" themeKey="error_color" />
        <ThemeColorSelect label="Warning Color" themeKey="warning_color" />
        <ThemeColorSelect label="Success Color" themeKey="success_color" />

        <Item>
          <ListItemText primary="Font Family" />
          <TextField
            {...textProps}
            value={theme.font_family ?? ""}
            onChange={handleChange("font_family")}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
          />
        </Item>

        <Item>
          <ListItemText primary="CSS Injection" />
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
        </Item>
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

const Item = styled(ListItem)(() => ({
  padding: "5px 2px",
}));

const Round = styled("div")(() => ({
  width: "24px",
  height: "24px",
  borderRadius: "18px",
  display: "inline-block",
  marginRight: "8px",
}));
