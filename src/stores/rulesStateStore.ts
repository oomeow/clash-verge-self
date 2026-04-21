import { create } from "zustand";

import { CustomRule } from "@/pages/rules";

type RulesState = {
  customRules: CustomRule[] | null;
};

type RulesActions = {
  setCustomRules: (rules: CustomRule[] | null) => void;
};

export const useRulesStateStore = create<RulesState & RulesActions>()(
  (set) => ({
    customRules: null,
    setCustomRules: (rules) => set({ customRules: rules }),
  }),
);
