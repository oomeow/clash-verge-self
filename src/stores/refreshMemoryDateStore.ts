import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  date: number;
};

type Actions = {
  setDate: (next: number) => void;
};

export const useRefreshMemoryDateStore = create<State & Actions>()(
  devtools(
    immer((set) => ({
      date: Date.now(),
      setDate: (next) => set((state) => (state.date = next)),
    })),
    { name: "refreshMemoryDateStore" },
  ),
);
