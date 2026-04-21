import ExpandIcon from "@mui/icons-material/Expand";
import VerticalAlignCenterIcon from "@mui/icons-material/VerticalAlignCenter";
import { Box, IconButton } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";
import useSWR from "swr";
import {
  getRuleProviders,
  getRules,
  Rule,
  RuleBehavior,
  RuleFormat,
} from "tauri-plugin-mihomo-api";

import { BaseEmpty, BasePage, BaseSearchBox } from "@/components/base";
import { ProviderButton } from "@/components/rule/provider-button";
import { RuleItem } from "@/components/rule/rule-item";
import { getRuleProviderPayload } from "@/services/cmds";
import { useRulesStateStore } from "@/stores";

import LoadingPage from "./loading";

export type CustomRule = Rule &
  RulePayload & {
    updateAt?: string;
    behavior?: RuleBehavior;
    format?: RuleFormat;
    count?: number;
    expanded: boolean;
    matchPayloadItems: string[];
  };

const RulesPage = () => {
  const { t } = useTranslation();

  const { data } = useSWR(
    "getRules",
    async () => {
      const rules = await getRules();
      const customRules = rules.rules.map((item) => {
        return item as CustomRule;
      });
      return customRules;
    },
    {
      revalidateOnFocus: false,
    },
  );

  const customRules = useRulesStateStore((s) => s.customRules);
  const setCustomRules = useRulesStateStore((s) => s.setCustomRules);

  const [match, setMatch] = useState(() => (_: string) => true);
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (!data) return;
    getRuleProviders().then(async (ruleProviders) => {
      const res: CustomRule[] = [];
      for (const rule of data) {
        const provider = ruleProviders.providers[rule.payload];
        if (provider) {
          const payload = await getRuleProviderPayload(
            provider.name,
            provider.behavior,
            provider.format,
          );
          res.push({
            ...rule,
            ...payload,
            behavior: provider.behavior,
            format: provider.format,
            count: provider.ruleCount,
            updateAt: provider.updatedAt,
          } as CustomRule);
        } else {
          res.push(rule as CustomRule);
        }
      }
      setCustomRules(res);
    });
  }, [data, setCustomRules]);

  const rules = useMemo(() => {
    if (!customRules) return [];

    return customRules
      .map((item) => {
        const newItem: CustomRule = {
          ...item,
          expanded: expandedRules[item.payload] ?? item.expanded,
          matchPayloadItems: [],
        };
        return newItem;
      })
      .filter((item) => {
        if (item.rules && item.rules.length > 0) {
          item.rules.forEach((rule) => {
            if (match(rule)) {
              item.matchPayloadItems.push(rule);
            }
          });
        }
        if (item.type === "RuleSet") {
          return item.matchPayloadItems && item.matchPayloadItems.length > 0;
        } else {
          return match(item.payload);
        }
      });
  }, [customRules, expandedRules, match]);

  const hasRuleSet = rules.findIndex((item) => item.type === "RuleSet") !== -1;

  const updateRuleExpanded = (payload: string, expanded: boolean) => {
    setExpandedRules((prev) => ({
      ...prev,
      [payload]: expanded,
    }));
  };

  const expandAllRules = () => {
    setExpandedRules(
      Object.fromEntries(rules.map((rule) => [rule.payload, true])),
    );
  };

  const collapseAllRules = () => {
    setExpandedRules(
      Object.fromEntries(rules.map((rule) => [rule.payload, false])),
    );
  };

  return (
    <BasePage
      full
      title={t("pages.rules.title")}
      contentStyle={{ height: "100%" }}
      header={
        <Box display="flex" alignItems="center" gap={1}>
          {hasRuleSet && (
            <>
              <IconButton
                title={t("common.actions.expandAll")}
                color="primary"
                size="small"
                onClick={() => {
                  expandAllRules();
                }}>
                <ExpandIcon />
              </IconButton>
              <IconButton
                title={t("common.actions.collapseAll")}
                color="primary"
                size="small"
                onClick={() => {
                  collapseAllRules();
                }}>
                <VerticalAlignCenterIcon />
              </IconButton>
            </>
          )}
          <ProviderButton />
        </Box>
      }>
      <Box
        sx={{
          mb: "10px",
          pt: "10px",
          mx: "10px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
        }}>
        <BaseSearchBox onSearch={(match) => setMatch(() => match)} />
      </Box>

      <Box
        height={"calc(100% - 50px)"}
        sx={{
          boxSizing: "border-box",
          mb: "4px",
          marginLeft: "10px",
          borderRadius: "8px",
        }}>
        {customRules === null ? (
          <LoadingPage />
        ) : rules.length > 0 ? (
          <Virtuoso
            data={rules}
            totalCount={rules.length}
            itemContent={(index, item) => (
              <RuleItem
                key={item.payload}
                index={index + 1}
                value={item}
                onExpand={(expanded) => {
                  updateRuleExpanded(item.payload, !expanded);
                }}
              />
            )}
          />
        ) : (
          <BaseEmpty text={t("common.empty.noRules")} />
        )}
      </Box>
    </BasePage>
  );
};

export default RulesPage;
