import { isEqual } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getVergeConfig, patchVergeConfig } from "@/services/cmds";

type VergeState = {
  verge: IVergeConfig;
};

type VergeActions = {
  refreshVerge: () => Promise<IVergeConfig>;
  patchVerge: (value: Partial<IVergeConfig>) => Promise<void>;
};

const PERSISTED_VERGE_KEYS = [
  "language",
  "theme_mode",
  "light_theme_setting",
  "dark_theme_setting",
  "enable_system_title_bar",
  "enable_keep_ui_active",
  "keep_in_dock",
  "traffic_graph",
  "enable_memory_usage",
  "enable_group_icon",
  "menu_icon",
  "enable_tray",
  "tray_icon",
  "common_tray_icon",
  "sysproxy_tray_icon",
  "tun_tray_icon",
  "auto_close_connection",
  "auto_check_update",
  "proxy_layout_column",
  "app_hotkeys",
] as const satisfies readonly (keyof IVergeConfig)[];

const pickPersistedVerge = (verge: IVergeConfig) =>
  Object.fromEntries(
    PERSISTED_VERGE_KEYS.flatMap((key) => {
      const value = verge[key];
      return value === undefined ? [] : [[key, value]];
    }),
  ) as IVergeConfig;

export const useVergeStore = create<VergeState & VergeActions>()(
  persist(
    (set, get) => ({
      verge: {},
      refreshVerge: async () => {
        const verge = await getVergeConfig();
        if (!isEqual(get().verge, verge)) {
          set({ verge });
        }
        return verge;
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
      version: 1,
      partialize: (state) => ({ verge: pickPersistedVerge(state.verge) }),
    },
  ),
);
