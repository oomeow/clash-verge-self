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
import { Box, IconButton, type SxProps, TextField } from "@mui/material";
import { useDebounceFn } from "ahooks";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
  stickyed?: boolean;
  groupName: string;
  onLocation: () => void;
  onCheckDelay: () => void;
  onGroupLocation: (highlight?: boolean) => void;
}

const EMPTY_SX: SxProps = {};

export const ProxyGroupTools = memo(function ProxyGroupTools(props: Props) {
  const {
    sx = EMPTY_SX,
    stickyed,
    groupName,
    onLocation,
    onCheckDelay,
    onGroupLocation,
  } = props;
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

  // Keep refs to callbacks so onClick can call the latest version after flushSync re-render
  const onLocationRef = useRef(onLocation);
  const onCheckDelayRef = useRef(onCheckDelay);
  onLocationRef.current = props.onLocation;
  onCheckDelayRef.current = props.onCheckDelay;

  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultLatencyTest = useVergeStore((s) => s.verge.default_latency_test);

  useEffect(() => {
    delayManager.setUrl(groupName, testUrl || defaultLatencyTest);
  }, [groupName, testUrl, defaultLatencyTest]);

  const { run: applyFilter, flush: flushFilter } = useDebounceFn(
    (text: string) => {
      // 代理组 sticky 时，先滚动到代理组位置，再执行过滤，避免代理列表过滤后滚动位置错乱
      if (stickyed) onGroupLocation(false);
      headStateActions.setFilterText(text);
    },
    { wait: 600 },
  );

  // 关闭过滤框或卸载时立即应用最后一次输入，避免丢失未生效的过滤条件。
  useEffect(() => {
    if (textState !== "filter") flushFilter();
  }, [textState, flushFilter]);
  useEffect(() => () => flushFilter(), [flushFilter]);

  return (
    <Box className="flex items-center gap-1" style={sx as React.CSSProperties}>
      {textState === "filter" && (
        <TextField
          hiddenLabel
          inputRef={inputRef}
          value={filterTextInp}
          size="small"
          variant="outlined"
          placeholder={t("common.search.filterConditions")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onChange={(e) => {
            const text = e.target.value;
            setFilterTextInp(text);
            applyFilter(text);
          }}
          className="ml-1"
          sx={{
            width: 180,
            "& .MuiOutlinedInput-root": { minHeight: 26 },
          }}
          slotProps={{
            input: {
              sx: { py: 0, fontSize: 12 },
            },
          }}
        />
      )}

      {textState === "url" && (
        <TextField
          hiddenLabel
          inputRef={inputRef}
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
            headStateActions.setTestUrl(e.target.value);
          }}
          className="ml-1"
          sx={{
            width: 180,
            "& .MuiOutlinedInput-root": { minHeight: 26 },
          }}
          slotProps={{
            input: {
              sx: { py: 0, fontSize: 12 },
            },
          }}
        />
      )}
      <IconButton
        size="small"
        color="inherit"
        title={t("common.fields.location")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!headState.open) flushSync(() => headStateActions.setOpen(true));
          onLocationRef.current();
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
          if (!headState.open) flushSync(() => headStateActions.setOpen(true));
          // Remind the user that it is custom test url
          if (testUrl?.trim() && textState !== "filter") {
            headStateActions.setTextState("url");
          }
          onCheckDelayRef.current();
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
          if (!headState.open) flushSync(() => headStateActions.setOpen(true));
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
          if (!headState.open) flushSync(() => headStateActions.setOpen(true));
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
          if (!headState.open) flushSync(() => headStateActions.setOpen(true));
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

          if (!headState.open) flushSync(() => headStateActions.setOpen(true));
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
