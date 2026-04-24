import {
  getRuleProviders,
  getRules,
  Rule,
  RuleProvider,
  updateRulesDisable,
} from "tauri-plugin-mihomo-api";
import { create } from "zustand";

import { getRuleProviderPayload } from "@/services/cmds";

export type CustomRule = Rule &
  Omit<RuleProvider, "type"> & {
    expanded: boolean;
    payloadContent: string[];
  };

type RulesState = {
  rules: CustomRule[];
};

type RulesActions = {
  fetchRules: () => Promise<void>;
  loadPayload: () => Promise<void>;
  expandAllRules: () => void;
  collapseAllRules: () => void;
  toggleRuleExpanded: (payload: string) => void;
  disableRules: (rules: Record<number, boolean>) => Promise<void>;
};

export const useRulesStateStore = create<RulesState & RulesActions>()(
  (set, get) => ({
    rules: [],
    fetchRules: async () => {
      const rules = await getRules();
      const newRules: CustomRule[] = [];
      for (const rule of rules.rules) {
        newRules.push({
          ...rule,
          expanded: false,
        } as CustomRule);
      }

      set((state) => {
        // 基于旧数据合并 expanded 状态
        const mergedRules = newRules.map((newRule) => {
          const existingRule = state.rules.find(
            (old) => old.payload === newRule.payload,
          );
          return {
            ...existingRule,
            ...newRule,
            expanded: existingRule ? existingRule.expanded : newRule.expanded,
          };
        });

        return { rules: mergedRules };
      });
    },

    loadPayload: async () => {
      const newProviderRules: CustomRule[] = [];
      const ruleProviders = await getRuleProviders();
      const rules = get().rules;
      for (const rule of rules) {
        const providerName = rule.payload;
        const provider = ruleProviders.providers[providerName];
        if (provider) {
          const payload = await getRuleProviderPayload(
            providerName,
            provider.behavior,
            provider.format,
          );
          newProviderRules.push({
            ...rule,
            ...provider,
            type: rule.type,
            payloadContent: payload.rules,
          } as CustomRule);
        }
      }

      set((state) => {
        const mergedRules = state.rules.map((rule) => {
          const mergedProviderRule = newProviderRules.find(
            (old) => old.payload === rule.payload,
          );
          return {
            ...rule,
            ...mergedProviderRule,
            ruleCount: mergedProviderRule?.ruleCount,
            payloadContent: mergedProviderRule?.payloadContent,
          } as CustomRule;
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
