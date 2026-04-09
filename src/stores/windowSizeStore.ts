import { create } from "zustand";
import { persist } from "zustand/middleware";

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
    (set) => ({
      windowSize: getDefaultWindowSize(),
      setWindowSize: (size) => set({ windowSize: size }),
    }),
    {
      name: "window-size",
      version: 1,
    },
  ),
);
