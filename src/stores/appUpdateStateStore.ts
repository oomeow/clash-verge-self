import { create } from "zustand";

type State = {
  appUpdateState: boolean;
};

type Actions = {
  setAppUpdateState: (updating: boolean) => void;
};

export const useAppUpdateStateStore = create<State & Actions>()((set) => ({
  appUpdateState: false,
  setAppUpdateState: (updating) => set(() => ({ appUpdateState: updating })),
}));
