import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface RefreshLogsDateState {
  date: number;
  setDate: (next: number) => void;
}

export const useRefreshLogsDateStore = create<RefreshLogsDateState>()(
  devtools(
    immer((set) => ({
      date: Date.now(),
      setDate: (next) =>
        set(
          (state) => {
            state.date = next;
          },
          false,
          "refreshLogsDate/setDate",
        ),
    })),
    { name: "refreshLogsDateStore" },
  ),
);
