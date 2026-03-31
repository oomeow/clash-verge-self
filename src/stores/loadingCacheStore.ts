import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface LoadingCacheState {
  loadingCache: Record<string, boolean>;
  setLoadingCache: (next: Record<string, boolean>) => void;
}

export const useLoadingCacheStore = create<LoadingCacheState>()(
  devtools(
    immer((set) => ({
      loadingCache: {},
      setLoadingCache: (next) =>
        set(
          (state) => {
            state.loadingCache = next;
          },
          false,
          "loadingCache/setLoadingCache",
        ),
    })),
    { name: "loadingCacheStore" },
  ),
);
