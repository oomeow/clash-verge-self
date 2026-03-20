import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

interface IConnectionSetting {
  layout: "table" | "list";
}

const defaultConnectionSetting: IConnectionSetting = { layout: "table" };

interface ConnectionSettingState {
  setting: IConnectionSetting;
  setSetting: (next: Updater<IConnectionSetting>) => void;
}

export const useConnectionSettingStore = create<ConnectionSettingState>()(
  persist(
    (set) => ({
      setting: defaultConnectionSetting,
      setSetting: (next) =>
        set((state) => ({
          setting: applyUpdater(next, state.setting),
        })),
    }),
    {
      name: "connections-setting",
      version: 1,
      partialize: (state) => ({ setting: state.setting }),
    },
  ),
);

export const useConnectionSetting = () => {
  const setting = useConnectionSettingStore((s) => s.setting);
  const setSetting = useConnectionSettingStore((s) => s.setSetting);
  return [setting, setSetting] as const;
};
