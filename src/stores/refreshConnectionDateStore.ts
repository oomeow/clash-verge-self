import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface RefreshConnectionDateState {
  date: number;
  setDate: (next: number) => void;
}

export const useRefreshConnectionDateStore =
  create<RefreshConnectionDateState>()(
    devtools(
      immer((set) => ({
        date: Date.now(),
        setDate: (next) =>
          set(
            (state) => {
              state.date = next;
            },
            false,
            "refreshConnectionDate/setDate",
          ),
      })),
      { name: "refreshConnectionDateStore" },
    ),
  );
