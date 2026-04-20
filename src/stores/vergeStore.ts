import { getVergeConfig, patchVergeConfig } from "@/services/cmds";
import { isEqual } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useThemeSettingsStore } from "./themeStore";

type VergeState = {
  verge: IVergeConfig;
};

type VergeActions = {
  refreshVerge: () => Promise<IVergeConfig | undefined>;
  patchVerge: (value: Partial<IVergeConfig>) => Promise<void>;
};

let initializeVergeStorePromise: Promise<IVergeConfig | undefined> | null =
  null;

export const useVergeStore = create<VergeState & VergeActions>()(
  persist(
    (set, get) => ({
      verge: {},
      refreshVerge: async () => {
        const verge = await getVergeConfig();
        if (!isEqual(get().verge, verge)) {
          set({ verge });
        }
      },
      patchVerge: async (value) => {
        const previous = get().verge;
        const next = { ...(previous ?? {}), ...value } as IVergeConfig;
        const hasChanged = !isEqual(previous, next);

        if (hasChanged) {
          set({ verge: next });
        }
        try {
          await patchVergeConfig(value);
        } catch (err) {
          if (hasChanged) {
            set({ verge: previous });
          }
          throw err;
        }
      },
    }),
    {
      name: "verge-config",
      partialize: (state) => ({ verge: state.verge }),
      version: 1,
    },
  ),
);

const initializeVergeStore = async () => {
  if (initializeVergeStorePromise) {
    return initializeVergeStorePromise;
  }

  initializeVergeStorePromise = (async () => {
    const verge = await getVergeConfig();
    if (!isEqual(useVergeStore.getState().verge, verge)) {
      useVergeStore.setState({ verge });
    }
    const themeMode = verge.theme_mode;
    const themeSetting =
      themeMode === "dark"
        ? verge.dark_theme_setting
        : verge.light_theme_setting;
    const themeSettingsStore =
      themeMode === "dark"
        ? useThemeSettingsStore.getState().themeSettings.dark
        : useThemeSettingsStore.getState().themeSettings.light;
    if (!isEqual(themeSettingsStore, themeSetting)) {
      useThemeSettingsStore.getState().syncThemeSettings(verge);
    }
    return verge;
  })();

  return initializeVergeStorePromise;
};

void initializeVergeStore();
