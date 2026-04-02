import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  loadingCache: Record<string, boolean>;
};

type Actions = {
  setLoadingCache: (next: Record<string, boolean>) => void;
};

export const useLoadingCacheStore = create<State & Actions>()(
  immer((set) => ({
    loadingCache: {},
    setLoadingCache: (next) => set((state) => (state.loadingCache = next)),
  })),
);
