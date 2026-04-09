import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  date: number;
};

type Actions = {
  refresh: () => void;
};

export const useRefreshMemoryDateStore = create<State & Actions>()((set) => ({
  date: Date.now(),
  refresh: () => set(() => ({ date: Date.now() })),
}));
