import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  loadingCache: Record<string, boolean>;
};

type Actions = {
  setLoading: (key: string, value: boolean) => void;
  toggleLoading: (key: string) => void;
  clearLoadingCache: () => void;
  removeLoading: (key: string) => void;
};

export const useLoadingCacheStore = create<State & Actions>()(
  immer((set) => ({
    loadingCache: {},
    setLoading: (key, value) =>
      set((state) => {
        state.loadingCache[key] = value;
      }),
    toggleLoading: (key) =>
      set((state) => {
        state.loadingCache[key] = !state.loadingCache[key];
      }),
    clearLoadingCache: () =>
      set((state) => {
        state.loadingCache = {};
      }),
    removeLoading: (key) =>
      set((state) => {
        delete state.loadingCache[key];
      }),
  })),
);
