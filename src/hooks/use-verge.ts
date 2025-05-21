import { getVergeConfig, patchVergeConfig } from "@/services/cmds";
import { useThemeSettings } from "@/services/states";
import { emit } from "@tauri-apps/api/event";
import useSWR from "swr";

export const useVerge = () => {
  const { data: verge, mutate: mutateVerge } = useSWR(
    "getVergeConfig",
    getVergeConfig,
    { suspense: true },
  );
  const [themeSettings, setThemeSettings] = useThemeSettings();

  const patchVerge = async (value: Partial<IVergeConfig>) => {
    await patchVergeConfig(value);
    if (value.light_theme_setting || value.dark_theme_setting) {
      setThemeSettings({
        light: value.light_theme_setting || themeSettings.light,
        dark: value.dark_theme_setting || themeSettings.dark,
      });
    }
    if (
      value.clash_core ||
      value.enable_external_controller ||
      value.enable_service_mode
    ) {
      emit("verge://refresh-websocket");
    }
    mutateVerge();
  };

  return {
    verge,
    mutateVerge,
    patchVerge,
  };
};
