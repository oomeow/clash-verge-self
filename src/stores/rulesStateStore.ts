import {
  getRuleProviders,
  getRules,
  Rule,
  RuleBehavior,
  RuleFormat,
  updateRulesDisable,
  VehicleType,
} from "tauri-plugin-mihomo-api";
import { create } from "zustand";

export type CustomRule = Rule & {
  behavior: RuleBehavior;
  format: RuleFormat;
  name: string;
  ruleCount: number;
  updatedAt: string;
  vehicleType: VehicleType;
  expanded: boolean;
  // matchPayloadItems: string[];
};

type RulesState = {
  rules: CustomRule[];
};

type RulesActions = {
  setCustomRules: (rules: CustomRule[]) => void;
  fetchRules: () => Promise<void>;
  expandAllRules: () => void;
  collapseAllRules: () => void;
  toggleRuleExpanded: (payload: string) => void;
  disableRules: (rules: Record<number, boolean>) => Promise<void>;
};

export const useRulesStateStore = create<RulesState & RulesActions>()(
  (set, get) => ({
    rules: [],
    setCustomRules: (rules) => set({ rules: rules }),
    fetchRules: async () => {
      const rules = await getRules();
      const ruleProviders = await getRuleProviders();
      const newRules = rules.rules.map((rule) => {
        const provider = ruleProviders.providers[rule.payload];
        return {
          ...provider,
          ...rule,
          expanded: false,
        } as CustomRule;
      });

      set((state) => {
        // 基于旧数据合并 expanded 状态
        const mergedRules = newRules.map((newRule) => {
          const existingRule = state.rules.find(
            (old) => old.payload === newRule.payload,
          );
          return {
            ...newRule,
            expanded: existingRule ? existingRule.expanded : newRule.expanded,
          };
        });

        return { rules: mergedRules };
      });
    },
    expandAllRules: () => {
      set((state) => ({
        rules: state.rules.map((rule) => ({
          ...rule,
          expanded: true,
        })),
      }));
    },
    collapseAllRules: () => {
      set((state) => ({
        rules: state.rules.map((rule) => ({
          ...rule,
          expanded: false,
        })),
      }));
    },
    toggleRuleExpanded: (payload) =>
      set((state) => ({
        rules: state.rules.map((r) =>
          r.payload === payload ? { ...r, expanded: !r.expanded } : r,
        ),
      })),
    disableRules: async (rules: Record<number, boolean>) => {
      await updateRulesDisable(rules);
      await get().fetchRules();
    },
  }),
);
