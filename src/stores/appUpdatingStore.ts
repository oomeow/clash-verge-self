import { create } from "zustand";

type State = {
  appUpdating: boolean;
};

type Actions = {
  setAppUpdating: (updating: boolean) => void;
};

export const useAppUpdatingStore = create<State & Actions>()((set) => ({
  appUpdating: false,
  setAppUpdating: (updating) => set({ appUpdating: updating }),
}));
