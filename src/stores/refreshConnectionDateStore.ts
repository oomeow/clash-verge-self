import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

interface RefreshConnectionDateState {
  date: number;
  setDate: (next: Updater<number>) => void;
}

export const useRefreshConnectionDateStore = create<RefreshConnectionDateState>(
  (set) => ({
    date: Date.now(),
    setDate: (next) =>
      set((state) => ({
        date: applyUpdater(next, state.date),
      })),
  }),
);

export const useRefreshConnectionDate = () =>
  useRefreshConnectionDateStore((s) => s.date);

export const useSetRefreshConnectionDate = () =>
  useRefreshConnectionDateStore((s) => s.setDate);
