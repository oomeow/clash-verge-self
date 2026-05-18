import ExpandLessRounded from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import { alpha, Box, Card, CircularProgress, Typography } from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAsyncEffect } from "ahooks";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Proxy } from "tauri-plugin-mihomo-api";

import { downloadIconCache } from "@/services/cmds";
import { useProfilesStore, useVergeStore } from "@/stores";
import {
  createScopedHeadStateActions,
  DEFAULT_STATE,
} from "@/stores/proxyHeadStateStore";
import { cn } from "@/utils";
import { groupId } from "@/utils/proxyId";

import { ProxyGroupTools } from "./proxy-group-tools";
import { ProxyHead } from "./proxy-head";
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

const GROUP_ICON_STYLE: Record<string, string> = {
  marginRight: "12px",
  borderRadius: "6px",
};
const GROUP_ICON_LOADING_STYLE = {
  ...GROUP_ICON_STYLE,
  width: "32px",
  height: "32px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const ICON_FILE_NAME_MAX_LENGTH = 32;
const ICON_HASH_LENGTH = 16;
const groupIconSrcCache = new Map<string, string>();
const groupIconLoadingCache = new Map<string, Promise<string>>();

const normalizeIconUrl = (url: string) => {
  try {
    const iconUrl = new URL(url);
    return `${iconUrl.origin}${iconUrl.pathname}${iconUrl.search}${iconUrl.hash}`;
  } catch {
    return url;
  }
};

const getIconFileName = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.substring(pathname.lastIndexOf("/") + 1);
    if (fileName) return decodeURIComponent(fileName);
  } catch {
    // fallback for non-standard URL strings
  }

  const path = url.split(/[?#]/, 1)[0];
  return path.substring(path.lastIndexOf("/") + 1);
};

const getIconFileParts = (fileName: string) => {
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex === fileName.length - 1) {
    return { stem: fileName, extension: ".png" };
  }

  return {
    stem: fileName.slice(0, extensionIndex),
    extension: fileName.slice(extensionIndex),
  };
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-\s]+|[.\-\s]+$/g, "")
    .slice(0, ICON_FILE_NAME_MAX_LENGTH) || "icon";

const sanitizeExtension = (extension: string) => {
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);
  return safeExtension.startsWith(".") && safeExtension.length > 1
    ? safeExtension
    : ".png";
};

const encodeSvgDataUri = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getIconCacheFileName = async (groupIcon: string, cacheKey: string) => {
  const hashName = (await sha256Hex(cacheKey)).slice(0, ICON_HASH_LENGTH);
  const { stem, extension } = getIconFileParts(getIconFileName(groupIcon));
  return `${sanitizeFileName(stem)}-${hashName}${sanitizeExtension(extension)}`;
};

const loadGroupIconSrc = async (groupIcon: string, cacheKey: string) => {
  const fileName = await getIconCacheFileName(groupIcon, cacheKey);
  const iconPath = await downloadIconCache(groupIcon, fileName);
  const iconSrc = convertFileSrc(iconPath);
  groupIconSrcCache.set(cacheKey, iconSrc);
  return iconSrc;
};

const getGroupIconSrc = async (groupIcon: string) => {
  const cacheKey = normalizeIconUrl(groupIcon);
  const cachedSrc = groupIconSrcCache.get(cacheKey);
  if (cachedSrc) return cachedSrc;

  const loadingSrc = groupIconLoadingCache.get(cacheKey);
  if (loadingSrc) return await loadingSrc;

  const loadIcon = loadGroupIconSrc(groupIcon, cacheKey).finally(() => {
    groupIconLoadingCache.delete(cacheKey);
  });

  groupIconLoadingCache.set(cacheKey, loadIcon);
  return await loadIcon;
};

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
  const { t } = useTranslation();
  const { type, group, proxy, headState = DEFAULT_STATE } = item;
  const currentProfileUid = useProfilesStore(
    (s) => s.currentProfile?.uid ?? "",
  );
  const enableGroupIcon = useVergeStore(
    (s) => s.verge.enable_group_icon ?? true,
  );
  const headStateActions = useMemo(
    () =>
      createScopedHeadStateActions({
        current: currentProfileUid,
        groupName: group.name,
      }),
    [currentProfileUid, group.name],
  );
  const groupIcon = group.icon?.trim() ?? "";
  const isHttpIcon = groupIcon.startsWith("http");
  const isDataIcon = groupIcon.startsWith("data");
  const isInlineSvgIcon = groupIcon.startsWith("<svg");
  const shouldLoadHttpIcon = enableGroupIcon && isHttpIcon;
  const iconCacheKey = shouldLoadHttpIcon ? normalizeIconUrl(groupIcon) : "";
  const [iconCachePath, setIconCachePath] = useState(
    () => groupIconSrcCache.get(iconCacheKey) ?? "",
  );

  useAsyncEffect(
    async function* () {
      if (!shouldLoadHttpIcon) {
        setIconCachePath("");
        return;
      }

      const cachedIconSrc = groupIconSrcCache.get(iconCacheKey);
      if (cachedIconSrc) {
        setIconCachePath(cachedIconSrc);
        return;
      }

      setIconCachePath("");

      try {
        const iconSrc = await getGroupIconSrc(groupIcon);
        yield;
        setIconCachePath(iconSrc);
      } catch {
        yield;
        setIconCachePath("");
      }
    },
    [shouldLoadHttpIcon, groupIcon, iconCacheKey],
  );

  if (type === 0) {
    return (
      <div
        className={cn("py-1", {
          // "py-0": stickyed && headState.open,
        })}>
        <Card
          id={groupId(group.name)}
          className={cn(
            "mx-2 flex h-17.5 cursor-pointer items-center rounded-xl px-4 shadow-sm transition-[background-color_0s,box-shadow_0.1s]",
            stickyed && headState.open && "shadow-md",
          )}
          sx={(theme) => {
            const tint = theme.palette.mode === "light" ? 0.08 : 0.18;
            const hoverTint = theme.palette.mode === "light" ? 0.14 : 0.28;
            return {
              background: `linear-gradient(0deg, ${alpha(theme.palette.primary.main, tint)}, ${alpha(theme.palette.primary.main, tint)}), ${theme.palette.background.paper}`,
              "&:hover": {
                background: `linear-gradient(0deg, ${alpha(theme.palette.primary.main, hoverTint)}, ${alpha(theme.palette.primary.main, hoverTint)}), ${theme.palette.background.paper}`,
              },
            };
          }}
          onClick={async () => {
            if (headState?.open) {
              await onGroupToggle?.(group);
            }
            headStateActions.setOpen(!headState?.open);
          }}>
          {enableGroupIcon && (
            <Box className="flex h-15 w-15 shrink-0 items-center pr-2">
              {isHttpIcon && !iconCachePath && (
                <Box sx={GROUP_ICON_LOADING_STYLE}>
                  <CircularProgress size={18} />
                </Box>
              )}
              {isHttpIcon && iconCachePath && (
                <img
                  src={iconCachePath}
                  width="32px"
                  style={GROUP_ICON_STYLE}
                />
              )}
              {isDataIcon && (
                <img src={groupIcon} width="32px" style={GROUP_ICON_STYLE} />
              )}
              {isInlineSvgIcon && (
                <img
                  src={encodeSvgDataUri(groupIcon)}
                  width="32px"
                  style={GROUP_ICON_STYLE}
                />
              )}
            </Box>
          )}
          <Box className="flex w-full flex-col overflow-hidden">
            <span className="text-text-primary truncate text-[16px] leading-tight font-bold">
              {group.name}
            </span>
            <span className="mt-1 inline-block truncate">
              <span className="bg-primary/15 text-primary mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] leading-normal font-semibold">
                {group.type}
              </span>
              <span className="text-text-secondary text-[13px]">
                {group.now}
              </span>
            </span>
          </Box>

          <ProxyGroupTools
            sx={{ pr: 3 }}
            groupName={group.name}
            onLocation={() => onLocation(group)}
            onCheckDelay={() => onCheckAll(group.name)}
          />
          {headState?.open ? <ExpandLessRounded /> : <ExpandMoreRounded />}
        </Card>
      </div>
    );
  }

  // TODO: 拆分该组件
  // render list 数据已经移除该类型数据, 该 head 已经集成在 type === 0 的组件中
  if (type === 1) {
    return (
      <ProxyHead
        sx={{ pl: 2, pr: 3, pt: 1 }}
        groupName={group.name}
        onLocation={() => onLocation(group)}
        onCheckDelay={() => onCheckAll(group.name)}
      />
    );
  }

  if (type === 2) {
    return (
      <ProxyItem
        group={group}
        proxy={proxy!}
        selected={group.now === proxy?.name}
        fixed={group.fixed === proxy?.name}
        showType={headState?.showType}
        delayVersion={delayVersion}
        sx={{ py: "4px", px: 2 }}
        onClick={() => onChangeProxy(group, proxy!)}
      />
    );
  }

  if (type === 3) {
    return (
      <Box className="flex flex-col items-center justify-center py-4 pl-0">
        <InboxRounded className="text-[2.5em] text-inherit" />
        <Typography className="text-inherit">
          {t("common.empty.noProxies")}
        </Typography>
      </Box>
    );
  }

  if (type === 4) {
    return (
      <ProxyItemMiniCol
        item={item}
        delayVersion={delayVersion}
        onChangeProxy={onChangeProxy}
      />
    );
  }
});
