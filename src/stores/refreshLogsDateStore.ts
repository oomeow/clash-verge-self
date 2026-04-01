import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  date: number;
};

type Actions = {
  setDate: (date: number) => void;
};

export const useRefreshLogsDateStore = create<State & Actions>()(
  devtools(
    immer((set) => ({
      date: Date.now(),
      setDate: (date) => set((state) => (state.date = date)),
    })),
    { name: "refreshLogsDateStore" },
  ),
);
