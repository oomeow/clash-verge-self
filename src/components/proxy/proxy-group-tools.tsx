import AccessTimeRounded from "@mui/icons-material/AccessTimeRounded";
import FilterAltOffRounded from "@mui/icons-material/FilterAltOffRounded";
import FilterAltRounded from "@mui/icons-material/FilterAltRounded";
import MyLocationRounded from "@mui/icons-material/MyLocationRounded";
import NetworkCheckRounded from "@mui/icons-material/NetworkCheckRounded";
import SortByAlphaRounded from "@mui/icons-material/SortByAlphaRounded";
import SortRounded from "@mui/icons-material/SortRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import WifiTetheringOffRounded from "@mui/icons-material/WifiTetheringOffRounded";
import WifiTetheringRounded from "@mui/icons-material/WifiTetheringRounded";
import { Box, IconButton, SxProps, TextField } from "@mui/material";
import debounce from "lodash-es/debounce";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import delayManager from "@/services/delay";
import { useProfilesStore, useVergeStore } from "@/stores";
import {
  createScopedHeadStateActions,
  DEFAULT_STATE,
  useProxyHeadStateStore,
} from "@/stores/proxyHeadStateStore";

import type { ProxySortType } from "./use-filter-sort";

interface Props {
  sx?: SxProps;
  groupName: string;
  onLocation: () => void;
  onCheckDelay: () => void;
}

export const ProxyGroupTools = memo(function ProxyHead(props: Props) {
  const { sx = {}, groupName } = props;
  const currentProfileUid = useProfilesStore(
    (s) => s.currentProfile?.uid ?? "",
  );
  const headState = useProxyHeadStateStore((state) =>
    currentProfileUid
      ? (state.headStates[currentProfileUid]?.[groupName] ?? DEFAULT_STATE)
      : DEFAULT_STATE,
  );
  const headStateActions = useMemo(
    () =>
      createScopedHeadStateActions({ current: currentProfileUid, groupName }),
    [currentProfileUid, groupName],
  );

  const { showType, sortType, filterText, textState, testUrl } = headState;
  const [filterTextInp, setFilterTextInp] = useState(filterText);

  const { t } = useTranslation();
  const [autoFocus, setAutoFocus] = useState(false);

  useEffect(() => {
    // fix the focus conflict
    const timer = setTimeout(() => setAutoFocus(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const defaultLatencyTest = useVergeStore((s) => s.verge.default_latency_test);

  useEffect(() => {
    delayManager.setUrl(groupName, testUrl || defaultLatencyTest);
  }, [groupName, testUrl, defaultLatencyTest]);

  const filterChange = useMemo(
    () =>
      debounce((text: string) => {
        headStateActions.setFilterText(text);
      }, 500),
    [headStateActions],
  );

  useEffect(() => {
    return () => {
      filterChange.cancel();
    };
  }, [filterChange]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        ...sx,
      }}>
      {textState === "filter" && (
        <TextField
          autoFocus={autoFocus}
          hiddenLabel
          value={filterTextInp}
          size="small"
          variant="outlined"
          placeholder={t("common.search.filterConditions")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onChange={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = e.target.value;
            setFilterTextInp(text);
            filterChange(text);
          }}
          sx={{
            ml: 0.5,
            flex: "1 1 auto",
            minWidth: 150,
            input: { py: 0.4, px: 1 },
          }}
        />
      )}

      {textState === "url" && (
        <TextField
          autoFocus={autoFocus}
          hiddenLabel
          autoSave="off"
          autoComplete="off"
          value={testUrl}
          size="small"
          variant="outlined"
          placeholder={t("pages.proxies.actions.delayCheckUrl")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onChange={(e) => {
            e.preventDefault();
            e.stopPropagation();
            headStateActions.setTestUrl(e.target.value);
          }}
          sx={{
            ml: 0.5,
            flex: "1 1 auto",
            minWidth: 150,
            input: { py: 0.4, px: 1 },
          }}
        />
      )}
      <IconButton
        size="small"
        color="inherit"
        title={t("common.fields.location")}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onLocation();
        }}>
        <MyLocationRounded fontSize="inherit" />
      </IconButton>

      <IconButton
        size="small"
        color="inherit"
        title={t("pages.proxies.actions.delayCheck")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Remind the user that it is custom test url
          if (testUrl?.trim() && textState !== "filter") {
            headStateActions.setTextState("url");
          }
          props.onCheckDelay();
        }}>
        <NetworkCheckRounded fontSize="inherit" />
      </IconButton>

      <IconButton
        size="small"
        color="inherit"
        title={
          [
            t("pages.proxies.sort.default"),
            t("pages.proxies.sort.delay"),
            t("pages.proxies.sort.name"),
          ][sortType]
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          headStateActions.setSortType(((sortType + 1) % 3) as ProxySortType);
        }}>
        {sortType !== 1 && sortType !== 2 && <SortRounded fontSize="inherit" />}
        {sortType === 1 && <AccessTimeRounded fontSize="inherit" />}
        {sortType === 2 && <SortByAlphaRounded fontSize="inherit" />}
      </IconButton>

      <IconButton
        size="small"
        color="inherit"
        title={t("pages.proxies.actions.delayCheckUrl")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          headStateActions.setTextState(textState === "url" ? null : "url");
        }}>
        {textState === "url" ? (
          <WifiTetheringRounded fontSize="inherit" />
        ) : (
          <WifiTetheringOffRounded fontSize="inherit" />
        )}
      </IconButton>

      <IconButton
        size="small"
        color="inherit"
        title={
          showType
            ? t("pages.proxies.view.basic")
            : t("pages.proxies.view.detail")
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          headStateActions.setShowType(!showType);
        }}>
        {showType ? (
          <VisibilityRounded fontSize="inherit" />
        ) : (
          <VisibilityOffRounded fontSize="inherit" />
        )}
      </IconButton>

      <IconButton
        size="small"
        color="inherit"
        title={t("common.search.filter")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setFilterTextInp("");
          headStateActions.setTextState(
            textState === "filter" ? null : "filter",
          );
          headStateActions.setFilterText("");
        }}>
        {textState === "filter" ? (
          <FilterAltRounded fontSize="inherit" />
        ) : (
          <FilterAltOffRounded fontSize="inherit" />
        )}
      </IconButton>
    </Box>
  );
});
