import ExpandLessRounded from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import {
  alpha,
  Box,
  ListItemButton,
  ListItemText,
  styled,
  Typography,
} from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { downloadIconCache } from "@/services/cmds";
import { useProfilesStore, useVergeStore } from "@/stores";
import {
  createScopedHeadStateActions,
  DEFAULT_STATE,
} from "@/stores/proxyHeadStateStore";

import { ProxyHead } from "./proxy-head";
import { ProxyItem } from "./proxy-item";
import { ProxyItemMini } from "./proxy-item-mini";
import type { IRenderItem } from "./use-render-list";

interface RenderProps {
  item: IRenderItem;
  delayVersion: number;
  onLocation: (group: IProxyGroupItem) => void;
  onCheckAll: (groupName: string) => void;
  onChangeProxy: (group: IProxyGroupItem, proxy: IProxyItem) => void;
}

interface ProxyColProps {
  item: IRenderItem;
  delayVersion: number;
  onChangeProxy: (group: IProxyGroupItem, proxy: IProxyItem) => void;
}

const StyledPrimary = styled("span")`
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const StyledSubtitle = styled("span")`
  font-size: 13px;
  overflow: hidden;
  color: text.secondary;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

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
const groupIconSrcCache = new Map<string, string>();
const groupIconLoadingCache = new Map<string, Promise<string>>();

const getGroupIconCacheKey = (groupName: string, groupIcon: string) =>
  `${groupName}::${groupIcon}`;

const getFileName = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.substring(pathname.lastIndexOf("/") + 1);
    if (fileName) return decodeURIComponent(fileName);
  } catch {
    // fallback for non-standard URL strings
  }

  return url.substring(url.lastIndexOf("/") + 1);
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-\s]+|[.\-\s]+$/g, "")
    .slice(0, 80) || "icon";

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getGroupIconSrc = async (groupName: string, groupIcon: string) => {
  const cacheKey = getGroupIconCacheKey(groupName, groupIcon);
  const cachedSrc = groupIconSrcCache.get(cacheKey);
  if (cachedSrc) return cachedSrc;

  const loadingSrc = groupIconLoadingCache.get(cacheKey);
  if (loadingSrc) return loadingSrc;

  const fileName = `${sanitizeFileName(getFileName(groupIcon))}-${await sha256Hex(
    groupIcon,
  )}`;
  const loadIcon = downloadIconCache(groupIcon, fileName)
    .then((iconPath) => {
      const iconSrc = convertFileSrc(iconPath);
      groupIconSrcCache.set(cacheKey, iconSrc);
      return iconSrc;
    })
    .finally(() => {
      groupIconLoadingCache.delete(cacheKey);
    });

  groupIconLoadingCache.set(cacheKey, loadIcon);
  return loadIcon;
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
  const { item, delayVersion, onLocation, onCheckAll, onChangeProxy } = props;
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
  const [iconCachePath, setIconCachePath] = useState(() =>
    isHttpIcon
      ? (groupIconSrcCache.get(getGroupIconCacheKey(group.name, groupIcon)) ??
        "")
      : "",
  );

  useEffect(() => {
    if (!isHttpIcon) {
      setIconCachePath("");
      return;
    }

    const cacheKey = getGroupIconCacheKey(group.name, groupIcon);
    const cachedSrc = groupIconSrcCache.get(cacheKey);
    if (cachedSrc) {
      setIconCachePath(cachedSrc);
      return;
    }

    let canceled = false;
    setIconCachePath("");
    getGroupIconSrc(group.name, groupIcon)
      .then((iconSrc) => {
        if (!canceled) {
          setIconCachePath(iconSrc);
        }
      })
      .catch(() => {
        if (!canceled) {
          setIconCachePath("");
        }
      });

    return () => {
      canceled = true;
    };
  }, [isHttpIcon, group.name, groupIcon]);

  if (type === 0) {
    return (
      <ListItemButton
        id={`group-${group.name}`}
        dense
        sx={(theme) => ({
          background: "#ffffff",
          ...theme.applyStyles("dark", {
            background: "#282A36",
          }),
          height: "70px",
          margin: "0 8px",
          borderRadius: "8px",
          transition: "background-color 0s",
        })}
        onClick={() => headStateActions.setOpen(!headState?.open)}>
        {enableGroupIcon && isHttpIcon && iconCachePath && (
          <img src={iconCachePath} width="32px" style={GROUP_ICON_STYLE} />
        )}
        {enableGroupIcon && isDataIcon && (
          <img src={groupIcon} width="32px" style={GROUP_ICON_STYLE} />
        )}
        {enableGroupIcon && isInlineSvgIcon && (
          <img
            src={`data:image/svg+xml;base64,${btoa(groupIcon)}`}
            width="32px"
          />
        )}
        <ListItemText
          primary={<StyledPrimary>{group.name}</StyledPrimary>}
          secondary={
            <ListItemTextChild
              sx={{
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                pt: "2px",
              }}>
              <span style={{ marginTop: "2px", display: "block" }}>
                <StyledTypeBox>{group.type}</StyledTypeBox>
                <StyledSubtitle sx={{ color: "text.secondary" }}>
                  {group.now}
                </StyledSubtitle>
              </span>
            </ListItemTextChild>
          }
          slotProps={{
            secondary: {
              sx: { display: "flex", alignItems: "center", color: "#ccc" },
            },
          }}
        />
        {headState?.open ? <ExpandLessRounded /> : <ExpandMoreRounded />}
      </ListItemButton>
    );
  }

  if (type === 1) {
    return (
      <ProxyHead
        sx={{ pl: 2, pr: 3 }}
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
        sx={{ py: 0, pl: 2 }}
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
