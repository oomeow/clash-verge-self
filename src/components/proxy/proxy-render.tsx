import ExpandLessRounded from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import {
  alpha,
  Box,
  CircularProgress,
  ListItemButton,
  ListItemText,
  styled,
  Typography,
} from "@mui/material";
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

const StyledPrimary = styled("span")`
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
`;
const StyledSubtitle = styled("span")(({ theme }) => ({
  fontSize: "13px",
  color: theme.palette.text.secondary,
}));

const ListItemTextChild = styled("span")`
  display: block;
`;

const StyledTypeBox = styled(ListItemTextChild)(({ theme }) => ({
  display: "inline-block",
  border: "1px solid #ccc",
  borderColor: alpha(theme.palette.primary.main, 0.5),
  color: alpha(theme.palette.primary.main, 0.8),
  borderRadius: 4,
  fontSize: 10,
  padding: "0 4px",
  lineHeight: 1.5,
  marginRight: "8px",
}));

const GROUP_ICON_STYLE = { marginRight: "12px", borderRadius: "6px" };
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
      sx={{
        height: 56,
        display: "grid",
        gap: 1,
        px: 2,
        my: "4px",
        gridTemplateColumns: `repeat(${item.col! || 2}, 1fr)`,
      }}>
      {proxyCol?.map((proxy) => (
        <ProxyItemMini
          key={item.key + proxy.name}
          groupName={group.name}
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
          "py-0": stickyed && headState.open,
        })}>
        <ListItemButton
          id={`group-${group.name}`}
          dense
          sx={(theme) => ({
            background: "#ffffff",
            ...theme.applyStyles("dark", {
              background: "#282A36",
            }),
            ":hover": {
              background: "#f5f5f5",
              ...theme.applyStyles("dark", {
                background: "#383A46",
              }),
            },
            height: "70px",
            margin: "0 8px",
            borderRadius: "8px",
            // boxSizing: "border-box",
            transition:
              "background-color 0s, margin 0.1s, border-radius 0.1s, box-shadow 0.1s",
            ...(stickyed &&
              headState.open && {
                margin: "0",
                borderRadius: "0",
                boxShadow:
                  "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
              }),
          })}
          onClick={async () => {
            if (headState?.open) {
              await onGroupToggle?.(group);
            }
            headStateActions.setOpen(!headState?.open);
          }}>
          {enableGroupIcon && (
            <>
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
            </>
          )}
          <ListItemText
            sx={{ minWidth: 0 }}
            primary={<StyledPrimary>{group.name}</StyledPrimary>}
            secondary={
              <span className="mt-0.5 inline-block truncate">
                <StyledTypeBox>{group.type}</StyledTypeBox>
                <StyledSubtitle>{group.now}</StyledSubtitle>
              </span>
            }
            slotProps={{
              secondary: { sx: { display: "flex", alignItems: "center" } },
            }}
          />

          <ProxyGroupTools
            sx={{ pr: 3 }}
            groupName={group.name}
            onLocation={() => onLocation(group)}
            onCheckDelay={() => onCheckAll(group.name)}
          />
          {headState?.open ? <ExpandLessRounded /> : <ExpandMoreRounded />}
        </ListItemButton>
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
        sx={{ py: "4px", pl: 2 }}
        onClick={() => onChangeProxy(group, proxy!)}
      />
    );
  }

  if (type === 3) {
    return (
      <Box
        sx={{
          py: 2,
          pl: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <InboxRounded sx={{ fontSize: "2.5em", color: "inherit" }} />
        <Typography sx={{ color: "inherit" }}>
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
