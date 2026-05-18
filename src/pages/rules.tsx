import ExpandIcon from "@mui/icons-material/Expand";
import VerticalAlignCenterIcon from "@mui/icons-material/VerticalAlignCenter";
import { Box, IconButton, Typography } from "@mui/material";
import { useAsyncEffect, useInterval } from "ahooks";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { BeatLoader } from "react-spinners";
import { Virtuoso } from "react-virtuoso";
import { useShallow } from "zustand/react/shallow";

import { BaseEmpty, BasePage } from "@/components/base";
import { ProviderButton } from "@/components/rule/provider-button";
import { RuleItem } from "@/components/rule/rule-item";
import { RuleSearchBox } from "@/components/rule/rule-search-box";
import { useRulesStateStore } from "@/stores";
import { CustomRule } from "@/stores/rulesStateStore";
import {
  createRuleSearchMatcher,
  EMPTY_RULE_SEARCH,
  normalizeDomain,
  RuleSearchState,
} from "@/utils/rule-search";

type CustomRuleWithMatch = CustomRule & {
  matchPayloadItems: string[];
};

const RulesPage = () => {
  const { t } = useTranslation();

  const rules = useRulesStateStore((s) => s.rules);
  const rulesDataVersion = useRulesStateStore((s) => s.rulesDataVersion);
  const hasRuleSet = useRulesStateStore(
    useShallow((s) => s.rules.some((i) => i.type === "RuleSet")),
  );

  const fetchRules = useRulesStateStore((s) => s.fetchRules);
  const loadPayload = useRulesStateStore((s) => s.loadPayload);
  const expandAllRules = useRulesStateStore((s) => s.expandAllRules);
  const collapseAllRules = useRulesStateStore((s) => s.collapseAllRules);

  const [search, setSearch] = useState<RuleSearchState>(EMPTY_RULE_SEARCH);
  const [isSearchPending, startSearchTransition] = useTransition();
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  const handleSearch = useCallback((nextSearch: RuleSearchState) => {
    startSearchTransition(() => {
      setSearch(nextSearch);
    });
  }, []);

  const filterRules = useMemo(() => {
    if (!search.text) {
      return rulesRef.current.map((item) => ({
        ...item,
        matchPayloadItems: item.payloadContent ?? [],
      }));
    }

    const matchesSearch = createRuleSearchMatcher(search);

    return rulesRef.current
      .map((item) => {
        const newItem: CustomRuleWithMatch = {
          ...item,
          matchPayloadItems: item.payloadContent
            ? item.payloadContent.filter((payload) =>
                matchesSearch(item, payload),
              )
            : [],
        };
        return newItem;
      })
      .filter((item) => {
        if (item.payloadContent) {
          return item.matchPayloadItems.length > 0;
        }
        return matchesSearch(item, item.payload);
      });
  }, [rulesDataVersion, search]);

  const searchStatus = useMemo(() => {
    if (!search.text) {
      return t("common.search.rulesTotal", { count: rules.length });
    }

    const matchedItems = filterRules.reduce((total, item) => {
      return total + (item.payloadContent ? item.matchPayloadItems.length : 1);
    }, 0);

    return t("common.search.rulesMatched", {
      mode: t(`common.search.${search.mode}`),
      text:
        search.mode === "domain" ? normalizeDomain(search.text) : search.text,
      groups: filterRules.length,
      items: matchedItems,
    });
  }, [filterRules, rules.length, search.mode, search.text, t]);

  useAsyncEffect(async () => {
    await fetchRules();
    await loadPayload();
  }, [fetchRules, loadPayload]);

  useInterval(async () => await fetchRules(), 5000);

  return (
    <BasePage
      full
      title={t("pages.rules.title")}
      contentStyle={{ height: "100%" }}
      header={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}>
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
          gap: 1,
          boxSizing: "border-box",
        }}>
        <RuleSearchBox onSearch={handleSearch} />
        <Typography
          title={searchStatus}
          variant="caption"
          sx={{
            color: "text.secondary",
            flexShrink: 0,
            maxWidth: "40%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
          {searchStatus}
        </Typography>
      </Box>
      <Box
        sx={{
          height: "calc(100% - 50px)",
          position: "relative",
          boxSizing: "border-box",
          mb: "4px",
          marginLeft: "10px",
          borderRadius: "8px",
        }}>
        {isSearchPending ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}>
            <BeatLoader color="var(--mui-palette-primary-main)" />
            <Typography className="text-primary" variant="body1">
              {t("common.search.searching")}
            </Typography>
          </Box>
        ) : filterRules.length > 0 ? (
          <Virtuoso
            data={filterRules}
            itemContent={(index, item) => (
              <div key={item.index} className="pb-1.5">
                <RuleItem
                  index={index + 1}
                  value={item}
                  matchPayloadItems={item.matchPayloadItems}
                />
              </div>
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
