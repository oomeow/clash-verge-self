import { create } from "zustand";

import { applyUpdater, type Updater } from "./utils";

interface UpdateStateState {
  updateState: boolean;
  setUpdateState: (next: Updater<boolean>) => void;
}

export const useUpdateStateStore = create<UpdateStateState>((set) => ({
  updateState: false,
  setUpdateState: (next) =>
    set((state) => ({
      updateState: applyUpdater(next, state.updateState),
    })),
}));

export const useUpdateState = () => useUpdateStateStore((s) => s.updateState);

export const useSetUpdateState = () =>
  useUpdateStateStore((s) => s.setUpdateState);
