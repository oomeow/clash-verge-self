import ExpandIcon from "@mui/icons-material/Expand";
import VerticalAlignCenterIcon from "@mui/icons-material/VerticalAlignCenter";
import { Box, IconButton } from "@mui/material";
import { useAsyncEffect, useInterval } from "ahooks";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";
import { RuleBehavior, RuleFormat } from "tauri-plugin-mihomo-api";
import { useShallow } from "zustand/react/shallow";

import { BaseEmpty, BasePage, BaseSearchBox } from "@/components/base";
import { ProviderButton } from "@/components/rule/provider-button";
import { RuleItem } from "@/components/rule/rule-item";
import { getRuleProviderPayload } from "@/services/cmds";
import { useRulesStateStore } from "@/stores";
import { CustomRule } from "@/stores/rulesStateStore";

import LoadingPage from "./loading";

type RulePayloadInfo = {
  providerName: string;
  behavior: RuleBehavior;
  format: RuleFormat;
};

type CustomRuleWithPayload = CustomRule & {
  payloadContent: string[];
  matchPayloadItems?: string[];
};

const RulesPage = () => {
  const { t } = useTranslation();

  const rules = useRulesStateStore((s) => s.rules);
  const ruleSetNames = useRulesStateStore(
    useShallow((s) =>
      s.rules.filter((i) => i.type === "RuleSet").map((i) => i.payload),
    ),
  );
  const fetchRules = useRulesStateStore((s) => s.fetchRules);
  const expandAllRules = useRulesStateStore((s) => s.expandAllRules);
  const collapseAllRules = useRulesStateStore((s) => s.collapseAllRules);

  const hasRuleSet = ruleSetNames.length > 0;
  const rulePayloadInfoList = useMemo(() => {
    return rules
      .filter((i) => i.type === "RuleSet")
      .map(
        (item) =>
          ({
            providerName: item.payload,
            behavior: item.behavior,
            format: item.format,
          }) as RulePayloadInfo,
      );
  }, [ruleSetNames]);

  const [payloadRules, setPayloadRules] = useState<Map<
    string,
    RulePayload
  > | null>(null);

  useAsyncEffect(async () => {
    const map = new Map<string, RulePayload>();
    for (const provider of rulePayloadInfoList) {
      const payload = await getRuleProviderPayload(
        provider.providerName,
        provider.behavior,
        provider.format,
      );
      map.set(provider.providerName, payload);
    }
    setPayloadRules(map);
  }, [rulePayloadInfoList]);

  useAsyncEffect(async () => {
    await fetchRules();
  }, [fetchRules]);

  const [match, setMatch] = useState(() => (_: string) => true);

  const filterRules = useMemo(() => {
    // 先渲染列表，后续等待 payload 内容加载完后再执行下面操作重新生成包含所有规则的文件
    if (!payloadRules) return rules as CustomRuleWithPayload[];

    return rules
      .map((item) => {
        const payloadItem = payloadRules.get(item.payload);
        const newItem: CustomRuleWithPayload = {
          ...item,
          ...payloadItem,
          payloadContent: payloadItem?.rules ?? [item.payload],
          matchPayloadItems: [],
        };
        return newItem;
      })
      .filter((item) => {
        item.payloadContent.forEach((rule) => {
          if (match(rule)) {
            item.matchPayloadItems?.push(rule);
          }
        });
        return item.matchPayloadItems && item.matchPayloadItems.length > 0;
      });
  }, [rules, payloadRules, match]);

  useInterval(async () => await fetchRules(), 5000);

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
                onClick={() => expandAllRules()}>
                <ExpandIcon />
              </IconButton>
              <IconButton
                title={t("common.actions.collapseAll")}
                color="primary"
                size="small"
                onClick={() => collapseAllRules()}>
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
        {filterRules === null ? (
          <LoadingPage />
        ) : filterRules.length > 0 ? (
          <Virtuoso
            data={filterRules}
            totalCount={rules.length}
            itemContent={(index, item) => (
              <RuleItem
                key={item.index}
                index={index + 1}
                value={item}
                matchPayloadItems={item.matchPayloadItems}
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
