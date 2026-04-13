import { getVergeConfig, patchVergeConfig } from "@/services/cmds";
import { useThemeSettingsStore } from "@/stores";
import useSWR from "swr";

export const useVerge = () => {
  const { data: verge, mutate: mutateVerge } = useSWR(
    "getVergeConfig",
    getVergeConfig,
    { suspense: true },
  );
  const setLightThemeSetting = useThemeSettingsStore(
    (s) => s.setLightThemeSetting,
  );
  const setDarkThemeSetting = useThemeSettingsStore(
    (s) => s.setDarkThemeSetting,
  );

  const patchVerge = async (value: Partial<IVergeConfig>) => {
    await patchVergeConfig(value);
    if (value.light_theme_setting) {
      setLightThemeSetting(value.light_theme_setting);
    }
    if (value.dark_theme_setting) {
      setDarkThemeSetting(value.dark_theme_setting);
    }
    mutateVerge();
  };

  return {
    verge,
    mutateVerge,
    patchVerge,
  };
};
