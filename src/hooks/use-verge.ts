import { getVergeConfig, patchVergeConfig } from "@/services/cmds";
import { useThemeSettingsStore } from "@/stores";
import useSWR from "swr";

export const useVerge = () => {
  const { data: verge, mutate: mutateVerge } = useSWR(
    "getVergeConfig",
    getVergeConfig,
    { suspense: true },
  );
  const themeSettings = useThemeSettingsStore((s) => s.themeSettings);
  const setThemeSettings = useThemeSettingsStore((s) => s.setThemeSettings);

  const patchVerge = async (value: Partial<IVergeConfig>) => {
    await patchVergeConfig(value);
    if (value.light_theme_setting || value.dark_theme_setting) {
      setThemeSettings({
        light: value.light_theme_setting || themeSettings.light,
        dark: value.dark_theme_setting || themeSettings.dark,
      });
    }
    mutateVerge();
  };

  return {
    verge,
    mutateVerge,
    patchVerge,
  };
};
