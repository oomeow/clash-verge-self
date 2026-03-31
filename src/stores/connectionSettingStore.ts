import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface IConnectionSetting {
  layout: "table" | "list";
}

const defaultConnectionSetting: IConnectionSetting = { layout: "table" };

interface ConnectionSettingState {
  setting: IConnectionSetting;
  setSetting: (next: IConnectionSetting) => void;
}

export const useConnectionSettingStore = create<ConnectionSettingState>()(
  devtools(
    persist(
      immer((set) => ({
        setting: defaultConnectionSetting,
        setSetting: (next) =>
          set(
            (state) => {
              state.setting = next;
            },
            false,
            "connectionSetting/setSetting",
          ),
      })),
      {
        name: "connections-setting",
        version: 1,
        partialize: (state) => ({ setting: state.setting }),
      },
    ),
    { name: "connectionSettingStore" },
  ),
);
