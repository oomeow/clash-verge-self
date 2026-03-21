import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

interface RefreshTrafficDateState {
  date: number;
  setDate: (next: Updater<number>) => void;
}

export const useRefreshTrafficDateStore = create<RefreshTrafficDateState>()(
  (set) => ({
    date: Date.now(),
    setDate: (next) =>
      set((state) => ({
        date: applyUpdater(next, state.date),
      })),
  }),
);

export const useRefreshTrafficDate = () =>
  useRefreshTrafficDateStore((s) => s.date);

export const useSetRefreshTrafficDate = () =>
  useRefreshTrafficDateStore((s) => s.setDate);
