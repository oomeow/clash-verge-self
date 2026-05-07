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
  rulesSignature: string;
  rulesDataVersion: number;
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
    rulesSignature: "",
    rulesDataVersion: 0,
    fetchRules: async () => {
      const rules = await getRules();
      const newRules = rules.rules.map(
        (rule) => ({ ...rule, expanded: false }) as CustomRule,
      );
      const rulesSignature = newRules
        .map((rule) =>
          [
            rule.index,
            rule.type,
            rule.payload,
            rule.proxy,
            rule.size,
            JSON.stringify(rule.extra),
          ].join("\u0000"),
        )
        .join("\u0001");

      set((state) => {
        const shouldPreserveRuleState = state.rulesSignature === rulesSignature;
        const existingRulesByPayload = new Map(
          state.rules.map((rule) => [rule.payload, rule]),
        );

        const mergedRules = newRules.map((newRule) => {
          const existingRule = existingRulesByPayload.get(newRule.payload);
          if (!shouldPreserveRuleState || !existingRule) {
            return newRule;
          }

          return {
            ...existingRule,
            ...newRule,
            expanded: existingRule.expanded,
          };
        });

        return {
          rules: mergedRules,
          rulesSignature,
          rulesDataVersion: shouldPreserveRuleState
            ? state.rulesDataVersion
            : state.rulesDataVersion + 1,
        };
      });
    },

    loadPayload: async () => {
      const ruleProviders = await getRuleProviders();
      const rules = get().rules;

      const payloadPromises = rules.map(async (rule) => {
        const providerName = rule.payload;
        const provider = ruleProviders.providers[providerName];
        if (provider) {
          const payload = await getRuleProviderPayload(
            providerName,
            provider.behavior,
            provider.format,
          );
          return {
            ...rule,
            ...provider,
            type: rule.type,
            payloadContent: payload.rules,
          } as CustomRule;
        }
        return null;
      });
      const results = await Promise.all(payloadPromises);
      const newProviderRules = results.filter(
        (r): r is CustomRule => r !== null,
      );

      set((state) => {
        const providerRulesByPayload = new Map(
          newProviderRules.map((rule) => [rule.payload, rule]),
        );

        const mergedRules = state.rules.map((rule) => {
          const mergedProviderRule = providerRulesByPayload.get(rule.payload);
          return mergedProviderRule ? { ...rule, ...mergedProviderRule } : rule;
        });

        return {
          rules: mergedRules,
          rulesDataVersion: state.rulesDataVersion + 1,
        };
      });
    },
    expandAllRules: () => {
      set((state) => ({
        rules: state.rules.map((rule) => ({
          ...rule,
          expanded: rule.type === "RuleSet",
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
