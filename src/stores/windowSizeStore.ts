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

interface WindowSizeState {
  windowSize: WindowSize;
  setWindowSize: (next: WindowSize) => void;
}

export const useWindowSizeStore = create<WindowSizeState>()(
  devtools(
    persist(
      immer((set) => ({
        windowSize: getDefaultWindowSize(),
        setWindowSize: (next) =>
          set(
            (state) => {
              state.windowSize = next;
            },
            false,
            "windowSize/setWindowSize",
          ),
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
