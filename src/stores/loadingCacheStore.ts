import { create } from "zustand";

import { applyUpdater, type Updater } from "./utils";

interface LoadingCacheState {
  loadingCache: Record<string, boolean>;
  setLoadingCache: (next: Updater<Record<string, boolean>>) => void;
}

export const useLoadingCacheStore = create<LoadingCacheState>((set) => ({
  loadingCache: {},
  setLoadingCache: (next) =>
    set((state) => ({
      loadingCache: applyUpdater(next, state.loadingCache),
    })),
}));

export const useLoadingCache = () =>
  useLoadingCacheStore((s) => s.loadingCache);

export const useSetLoadingCache = () =>
  useLoadingCacheStore((s) => s.setLoadingCache);
