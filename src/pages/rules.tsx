import ExpandIcon from "@mui/icons-material/Expand";
import VerticalAlignCenterIcon from "@mui/icons-material/VerticalAlignCenter";
import { Box, IconButton } from "@mui/material";
import { useAsyncEffect, useInterval, useMount } from "ahooks";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";
import { useShallow } from "zustand/react/shallow";

import { BaseEmpty, BasePage, BaseSearchBox } from "@/components/base";
import { ProviderButton } from "@/components/rule/provider-button";
import { RuleItem } from "@/components/rule/rule-item";
import { useRulesStateStore } from "@/stores";
import { CustomRule } from "@/stores/rulesStateStore";

type CustomRuleWithPayload = CustomRule & {
  matchPayloadItems: string[];
};

const RulesPage = () => {
  const { t } = useTranslation();

  const rules = useRulesStateStore((s) => s.rules);
  const hasRuleSet = useRulesStateStore(
    useShallow((s) => s.rules.some((i) => i.type === "RuleSet")),
  );

  const fetchRules = useRulesStateStore((s) => s.fetchRules);
  const loadPayload = useRulesStateStore((s) => s.loadPayload);
  const expandAllRules = useRulesStateStore((s) => s.expandAllRules);
  const collapseAllRules = useRulesStateStore((s) => s.collapseAllRules);

  const [match, setMatch] = useState(() => (_: string) => true);

  const filterRules = useMemo(() => {
    return rules
      .map((item) => {
        const newItem: CustomRuleWithPayload = {
          ...item,
          matchPayloadItems: [],
        };
        return newItem;
      })
      .filter((item) => {
        if (item.payloadContent) {
          item.payloadContent.forEach((rule) => {
            if (match(rule)) {
              item.matchPayloadItems?.push(rule);
            }
          });
          return item.matchPayloadItems && item.matchPayloadItems.length > 0;
        }
        return match(item.payload);
      });
  }, [rules, match]);

  useAsyncEffect(async () => {
    await fetchRules();
  }, [fetchRules]);

  useMount(async () => {
    await loadPayload();
  });

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
        {filterRules.length > 0 ? (
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
