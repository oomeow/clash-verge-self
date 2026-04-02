import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  setWindowSize: (size: WindowSize) => void;
};

export const useWindowSizeStore = create<State & Actions>()(
  persist(
    immer((set) => ({
      windowSize: getDefaultWindowSize(),
      setWindowSize: (size) => set((state) => (state.windowSize = size)),
    })),
    {
      name: "window-size",
      version: 1,
    },
  ),
);
