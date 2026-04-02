import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  date: number;
};

type Actions = {
  setDate: (date: number) => void;
};

export const useRefreshConnectionDateStore = create<State & Actions>()(
  immer((set) => ({
    date: Date.now(),
    setDate: (date) => set((state) => (state.date = date)),
  })),
);
