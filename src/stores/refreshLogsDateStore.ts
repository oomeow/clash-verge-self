import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

interface RefreshLogsDateState {
  date: number;
  setDate: (next: Updater<number>) => void;
}

export const useRefreshLogsDateStore = create<RefreshLogsDateState>()(
  persist(
    (set) => ({
      date: Date.now(),
      setDate: (next) =>
        set((state) => ({
          date: applyUpdater(next, state.date),
        })),
    }),
    {
      name: "mihomo_logs_date",
      version: 1,
      partialize: (state) => ({ date: state.date }),
    },
  ),
);

export const useRefreshLogsDate = () => useRefreshLogsDateStore((s) => s.date);

export const useSetRefreshLogsDate = () =>
  useRefreshLogsDateStore((s) => s.setDate);
