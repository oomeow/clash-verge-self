import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

interface RefreshMemoryDateState {
  date: number;
  setDate: (next: Updater<number>) => void;
}

export const useRefreshMemoryDateStore = create<RefreshMemoryDateState>()(
  persist(
    (set) => ({
      date: Date.now(),
      setDate: (next) =>
        set((state) => ({
          date: applyUpdater(next, state.date),
        })),
    }),
    {
      name: "mihomo_memory_date",
      version: 1,
      partialize: (state) => ({ date: state.date }),
    },
  ),
);

export const useRefreshMemoryDate = () =>
  useRefreshMemoryDateStore((s) => s.date);

export const useSetRefreshMemoryDate = () =>
  useRefreshMemoryDateStore((s) => s.setDate);
