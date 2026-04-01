import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface WindowSize {
  height: number;
  width: number;
}

const getDefaultWindowSize = (): WindowSize => {
  if (typeof window === "undefined") return { height: 0, width: 0 };
  return { height: window.innerHeight, width: window.innerWidth };
};

type State = {
  windowSize: WindowSize;
};

type Actions = {
  setWindowSize: (next: WindowSize) => void;
};

export const useWindowSizeStore = create<State & Actions>()(
  devtools(
    persist(
      immer((set) => ({
        windowSize: getDefaultWindowSize(),
        setWindowSize: (next) => set((state) => (state.windowSize = next)),
      })),
      {
        name: "window-size",
        version: 1,
        partialize: (state) => ({ windowSize: state.windowSize }),
      },
    ),
    { name: "windowSizeStore" },
  ),
);
