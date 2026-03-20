import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

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
  setWindowSize: (next: Updater<WindowSize>) => void;
}

export const useWindowSizeStore = create<WindowSizeState>()(
  persist(
    (set) => ({
      windowSize: getDefaultWindowSize(),
      setWindowSize: (next) =>
        set((state) => ({
          windowSize: applyUpdater(next, state.windowSize),
        })),
    }),
    {
      name: "window-size",
      version: 1,
      partialize: (state) => ({ windowSize: state.windowSize }),
    },
  ),
);

export const useWindowSize = () => useWindowSizeStore((s) => s.windowSize);

export const useSetWindowSize = () =>
  useWindowSizeStore((s) => s.setWindowSize);
