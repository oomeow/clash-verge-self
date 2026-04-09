import { create } from "zustand";

type State = {
  date: number;
};

type Actions = {
  refresh: () => void;
};

export const useRefreshLogsDateStore = create<State & Actions>()((set) => ({
  date: Date.now(),
  refresh: () => set({ date: Date.now() }),
}));
