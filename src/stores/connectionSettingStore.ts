import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface IConnectionSetting {
  layout: "table" | "list";
}

const defaultConnectionSetting: IConnectionSetting = { layout: "table" };

type State = {
  setting: IConnectionSetting;
};

type Actions = {
  setSetting: (next: IConnectionSetting) => void;
};

export const useConnectionSettingStore = create<State & Actions>()(
  devtools(
    persist(
      immer((set) => ({
        setting: defaultConnectionSetting,
        setSetting: (next) => set((state) => (state.setting = next)),
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
