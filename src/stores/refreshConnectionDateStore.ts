import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

interface RefreshConnectionDateState {
  date: number;
  setDate: (next: Updater<number>) => void;
}

export const useRefreshConnectionDateStore =
  create<RefreshConnectionDateState>()(
    persist(
      (set) => ({
        date: Date.now(),
        setDate: (next) =>
          set((state) => ({
            date: applyUpdater(next, state.date),
          })),
      }),
      {
        name: "mihomo_connection_date",
        version: 1,
        partialize: (state) => ({ date: state.date }),
      },
    ),
  );

export const useRefreshConnectionDate = () =>
  useRefreshConnectionDateStore((s) => s.date);

export const useSetRefreshConnectionDate = () =>
  useRefreshConnectionDateStore((s) => s.setDate);
