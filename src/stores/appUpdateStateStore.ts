import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  appUpdateState: boolean;
};

type Actions = {
  setAppUpdateState: (updating: boolean) => void;
};

export const useAppUpdateStateStore = create<State & Actions>()(
  immer((set) => ({
    appUpdateState: false,
    setAppUpdateState: (updating) =>
      set((state) => (state.appUpdateState = updating)),
  })),
);
