import { getVergeConfig, patchVergeConfig } from "@/services/cmds";
import { isEqual } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type VergeState = {
  verge: IVergeConfig;
};

type VergeActions = {
  refreshVerge: () => Promise<IVergeConfig>;
  patchVerge: (value: Partial<IVergeConfig>) => Promise<void>;
};

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
    },
  ),
);
