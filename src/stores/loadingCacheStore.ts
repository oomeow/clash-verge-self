import { create } from "zustand";

type State = {
  loadingCache: Record<string, boolean>;
};

type Actions = {
  setLoading: (key: string, value: boolean) => void;
  toggleLoading: (key: string) => void;
  clearLoadingCache: () => void;
  removeLoading: (key: string) => void;
};

export const useLoadingCacheStore = create<State & Actions>()((set) => ({
  loadingCache: {},
  setLoading: (key, value) =>
    set((state) => {
      return {
        ...state,
        loadingCache: { ...state.loadingCache, [key]: value },
      };
    }),
  toggleLoading: (key) =>
    set((state) => {
      return {
        ...state,
        loadingCache: {
          ...state.loadingCache,
          [key]: !state.loadingCache[key],
        },
      };
    }),
  clearLoadingCache: () => set(() => ({ loadingCache: {} })),
  removeLoading: (key) =>
    set((state) => {
      const loadingCache = { ...state.loadingCache };
      delete loadingCache[key];
      return { ...state, loadingCache };
    }),
}));
