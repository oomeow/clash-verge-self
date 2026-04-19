import { getVergeConfig, patchVergeConfig } from "@/services/cmds";
import { isEqual } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useThemeSettingsStore } from "./themeStore";

type VergeState = {
  verge: IVergeConfig | undefined;
};

type VergeActions = {
  refreshVerge: () => Promise<IVergeConfig | undefined>;
  patchVerge: (value: Partial<IVergeConfig>) => Promise<void>;
};

const syncThemeSettings = (verge: IVergeConfig | undefined) => {
  if (!verge) return;

  const { setLightThemeSetting, setDarkThemeSetting } =
    useThemeSettingsStore.getState();

  setLightThemeSetting(verge.light_theme_setting);
  setDarkThemeSetting(verge.dark_theme_setting);
};

const applyVerge = (verge: IVergeConfig | undefined) => {
  syncThemeSettings(verge);
  return { verge };
};

let refreshVergePromise: Promise<IVergeConfig | undefined> | null = null;
let initializeVergeStorePromise: Promise<IVergeConfig | undefined> | null =
  null;

export const useVergeStore = create<VergeState & VergeActions>()(
  persist(
    (set, get) => ({
      verge: undefined,

      refreshVerge: async () => {
        if (refreshVergePromise) {
          return refreshVergePromise;
        }

        refreshVergePromise = (async () => {
          const verge = await getVergeConfig();
          if (!isEqual(get().verge, verge)) {
            set(applyVerge(verge));
          }
          return verge;
        })();

        try {
          return await refreshVergePromise;
        } finally {
          refreshVergePromise = null;
        }
      },

      patchVerge: async (value) => {
        const previous = get().verge;
        const next = { ...(previous ?? {}), ...value } as IVergeConfig;
        const hasChanged = !isEqual(previous, next);

        if (hasChanged) {
          set(applyVerge(next));
        }
        try {
          await patchVergeConfig(value);
        } catch (err) {
          if (hasChanged) {
            set(applyVerge(previous));
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
      useVergeStore.setState(applyVerge(verge));
    }
    return verge;
  })();

  return initializeVergeStorePromise;
};

void initializeVergeStore();
