import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface UpdateStateState {
  updateState: boolean;
  setUpdateState: (next: boolean) => void;
}

export const useUpdateStateStore = create<UpdateStateState>()(
  devtools(
    immer((set) => ({
      updateState: false,
      setUpdateState: (next) =>
        set(
          (state) => {
            state.updateState = next;
          },
          false,
          "updateState/setUpdateState",
        ),
    })),
    { name: "updateStateStore" },
  ),
);
