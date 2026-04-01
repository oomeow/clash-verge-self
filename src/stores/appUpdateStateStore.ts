import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  appUpdateState: boolean;
};

type Actions = {
  setAppUpdateState: (updating: boolean) => void;
};

export const useAppUpdateStateStore = create<State & Actions>()(
  devtools(
    immer((set) => ({
      updateState: false,
      setAppUpdateState: (updating) =>
        set((state) => (state.appUpdateState = updating)),
    })),
    { name: "appUpdateStateStore" },
  ),
);
