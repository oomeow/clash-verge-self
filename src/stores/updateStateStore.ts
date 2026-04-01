import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  updateState: boolean;
};

type Actions = {
  setUpdateState: (next: boolean) => void;
};

export const useUpdateStateStore = create<State & Actions>()(
  devtools(
    immer((set) => ({
      updateState: false,
      setUpdateState: (next) => set((state) => (state.updateState = next)),
    })),
    { name: "updateStateStore" },
  ),
);
