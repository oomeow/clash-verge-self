import ExpandLessRounded from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import { alpha, Box, Card, Typography } from "@mui/material";
import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Proxy } from "tauri-plugin-mihomo-api";

import { useProfilesStore } from "@/stores";
import {
  createScopedHeadStateActions,
  DEFAULT_STATE,
} from "@/stores/proxyHeadStateStore";
import { cn } from "@/utils";
import { groupId } from "@/utils/proxyId";

import { ProxyGroupIcon } from "./proxy-group-icon";
import { ProxyGroupTools } from "./proxy-group-tools";
import { ProxyItem } from "./proxy-item";
import { ProxyItemMini } from "./proxy-item-mini";
import type { IProxyGroupItem, IRenderItem } from "./use-render-list";

interface RenderProps {
  item: IRenderItem;
  stickyed?: boolean;
  delayVersion: number;
  onLocation: (group: IProxyGroupItem) => void;
  onCheckAll: (groupName: string) => void;
  onGroupToggle?: (group: IProxyGroupItem) => void | Promise<void>;
  onChangeProxy: (group: IProxyGroupItem, proxy: Proxy) => void;
}

interface ProxyColProps {
  item: IRenderItem;
  delayVersion: number;
  onChangeProxy: (group: IProxyGroupItem, proxy: Proxy) => void;
}

interface ProxyGroupHeaderProps {
  group: IProxyGroupItem;
  headState: NonNullable<IRenderItem["headState"]>;
  stickyed?: boolean;
  onLocation: (group: IProxyGroupItem) => void;
  onCheckAll: (groupName: string) => void;
  onGroupToggle?: (group: IProxyGroupItem) => void | Promise<void>;
}

const ProxyGroupHeader = memo(function ProxyGroupHeader(
  props: ProxyGroupHeaderProps,
) {
  const { group, headState, stickyed, onLocation, onCheckAll, onGroupToggle } =
    props;
  const currentProfileUid = useProfilesStore(
    (s) => s.currentProfile?.uid ?? "",
  );
  const headStateActions = useMemo(
    () =>
      createScopedHeadStateActions({
        current: currentProfileUid,
        groupName: group.name,
      }),
    [currentProfileUid, group.name],
  );
  const handleToggle = useCallback(async () => {
    if (headState.open) {
      await onGroupToggle?.(group);
    }
    headStateActions.setOpen(!headState.open);
  }, [group, headState.open, headStateActions, onGroupToggle]);
  const handleLocation = useCallback(() => {
    onLocation(group);
  }, [group, onLocation]);
  const handleCheckDelay = useCallback(() => {
    onCheckAll(group.name);
  }, [group.name, onCheckAll]);

  return (
    <div className="py-1">
      <Card
        id={groupId(group.name)}
        className={cn(
          "mx-2 flex h-17.5 cursor-pointer items-center rounded-xl px-4",
          stickyed && headState.open && "shadow-md",
        )}
        sx={(theme) => {
          const { primary, background } = theme.palette;
          const isLight = theme.palette.mode === "light";
          const tint = alpha(primary.main, isLight ? 0.12 : 0.22);
          const elevation = isLight
            ? "0 1px 2px rgba(0,0,0,0.06)"
            : "0 1px 3px rgba(0,0,0,0.2)";
          return {
            backgroundColor: background.paper,
            backgroundImage: `linear-gradient(${tint}, ${tint})`,
            boxShadow: elevation,
            transition: "background-color 0s",
          };
        }}
        onClick={handleToggle}>
        <ProxyGroupIcon groupIcon={group.icon?.trim() ?? ""} />

        <Box className="flex w-full flex-col overflow-hidden">
          <span className="text-text-primary truncate text-[16px] leading-tight font-bold">
            {group.name}
          </span>
          <span className="mt-1 inline-block truncate">
            <span className="bg-primary/12 text-primary mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] leading-normal font-medium">
              {group.type}
            </span>
            <span className="text-text-secondary text-[13px]">{group.now}</span>
          </span>
        </Box>

        <ProxyGroupTools
          sx={{ pr: 3 }}
          groupName={group.name}
          onLocation={handleLocation}
          onCheckDelay={handleCheckDelay}
        />
        {headState.open ? <ExpandLessRounded /> : <ExpandMoreRounded />}
      </Card>
    </div>
  );
});

const ProxyItemMiniCol = memo(function ProxyItemMiniCol(props: ProxyColProps) {
  const { item, delayVersion, onChangeProxy } = props;
  const { group, headState, proxyCol } = item;
  return (
    <Box
      className="my-1 grid h-14 gap-2 px-4"
      style={{ gridTemplateColumns: `repeat(${item.col! || 2}, 1fr)` }}>
      {proxyCol?.map((proxy) => (
        <ProxyItemMini
          key={item.key + proxy.name}
          group={group}
          proxy={proxy!}
          fixed={group.fixed === proxy.name}
          selected={group.now === proxy.name}
          showType={headState?.showType}
          delayVersion={delayVersion}
          onClick={() => onChangeProxy(group, proxy!)}
        />
      ))}
    </Box>
  );
});

const EmptyProxyMessage = memo(function EmptyProxyMessage() {
  const { t } = useTranslation();

  return (
    <Box className="flex flex-col items-center justify-center py-4 pl-0">
      <InboxRounded className="text-[2.5em] text-inherit" />
      <Typography className="text-inherit">
        {t("common.empty.noProxies")}
      </Typography>
    </Box>
  );
});

const isRenderPropsEqual = (prev: RenderProps, next: RenderProps) =>
  prev.item === next.item &&
  prev.stickyed === next.stickyed &&
  prev.delayVersion === next.delayVersion;

export const ProxyRender = memo(function ProxyRender(props: RenderProps) {
  const {
    item,
    stickyed,
    delayVersion,
    onLocation,
    onCheckAll,
    onGroupToggle,
    onChangeProxy,
  } = props;
  const { type, group, proxy, headState = DEFAULT_STATE } = item;

  switch (type) {
    case 0:
      return (
        <ProxyGroupHeader
          group={group}
          headState={headState}
          stickyed={stickyed}
          onLocation={onLocation}
          onCheckAll={onCheckAll}
          onGroupToggle={onGroupToggle}
        />
      );
    case 1:
      return null;
    case 2:
      return (
        <ProxyItem
          group={group!}
          proxy={proxy!}
          selected={group!.now === proxy!.name}
          fixed={group!.fixed === proxy!.name}
          showType={headState.showType}
          delayVersion={delayVersion}
          sx={{ py: "4px", px: 2 }}
          onClick={() => onChangeProxy(group, proxy!)}
        />
      );
    case 3:
      return <EmptyProxyMessage />;
    case 4:
      return (
        <ProxyItemMiniCol
          item={item}
          delayVersion={delayVersion}
          onChangeProxy={onChangeProxy}
        />
      );
    default:
      return null;
  }
}, isRenderPropsEqual);
