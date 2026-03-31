import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface RefreshTrafficDateState {
  date: number;
  setDate: (next: number) => void;
}

export const useRefreshTrafficDateStore = create<RefreshTrafficDateState>()(
  devtools(
    immer((set) => ({
      date: Date.now(),
      setDate: (next) =>
        set(
          (state) => {
            state.date = next;
          },
          false,
          "refreshTrafficDate/setDate",
        ),
    })),
    { name: "refreshTrafficDateStore" },
  ),
);
