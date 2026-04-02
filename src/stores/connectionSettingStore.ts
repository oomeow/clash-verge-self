import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type ConnectionsLayout = "table" | "list";

type State = {
  layout: ConnectionsLayout;
};

type Actions = {
  setLayout: (layout: ConnectionsLayout) => void;
};

export const useConnectionSettingStore = create<State & Actions>()(
  persist(
    immer((set) => ({
      layout: "table",
      setLayout: (layout) => set((state) => (state.layout = layout)),
    })),
    {
      name: "connections-setting",
      version: 1,
    },
  ),
);
