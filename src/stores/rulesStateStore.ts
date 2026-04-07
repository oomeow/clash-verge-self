import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { CustomRule } from "@/pages/rules";

type RulesState = {
  customRules: CustomRule[] | null;
};

type RulesActions = {
  setCustomRules: (rules: CustomRule[] | null) => void;
};

export const useRulesStateStore = create<RulesState & RulesActions>()(
  immer((set) => ({
    customRules: null,
    setCustomRules: (rules) =>
      set((state) => {
        state.customRules = rules;
      }),
  })),
);
