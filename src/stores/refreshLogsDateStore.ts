import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  date: number;
};

type Actions = {
  refresh: () => void;
};

export const useRefreshLogsDateStore = create<State & Actions>()(
  immer((set) => ({
    date: Date.now(),
    refresh: () =>
      set((state) => {
        state.date = Date.now();
      }),
  })),
);
