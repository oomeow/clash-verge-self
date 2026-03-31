import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface RefreshMemoryDateState {
  date: number;
  setDate: (next: number) => void;
}

export const useRefreshMemoryDateStore = create<RefreshMemoryDateState>()(
  devtools(
    immer((set) => ({
      date: Date.now(),
      setDate: (next) =>
        set(
          (state) => {
            state.date = next;
          },
          false,
          "refreshMemoryDate/setDate",
        ),
    })),
    { name: "refreshMemoryDateStore" },
  ),
);
