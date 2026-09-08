import { Box, CircularProgress } from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useEffect, useState } from "react";

import DefaultGroupIcon from "@/assets/image/default_group_icon.svg?react";
import { downloadIconCache } from "@/services/cmds";
import { useVergeStore } from "@/stores";

const GROUP_ICON_STYLE: Record<string, string> = {
  width: "36px",
  height: "36px",
};
const GROUP_ICON_LOADING_STYLE = {
  ...GROUP_ICON_STYLE,
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
    .replace(/[\p{Cc}<>:"/\\|?*]/gu, "-")
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
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

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

export const ProxyGroupIcon = memo(function ProxyGroupIcon(props: {
  groupIcon: string;
}) {
  const { groupIcon } = props;
  const enableGroupIcon = useVergeStore(
    (s) => s.verge.enable_group_icon ?? true,
  );
  const hasGroupIcon = groupIcon !== "";
  const isHttpIcon = groupIcon.startsWith("http");
  const isDataIcon = groupIcon.startsWith("data");
  const isInlineSvgIcon = groupIcon.startsWith("<svg");
  const shouldLoadHttpIcon = enableGroupIcon && isHttpIcon;
  const iconCacheKey = shouldLoadHttpIcon ? normalizeIconUrl(groupIcon) : "";
  const [iconCachePath, setIconCachePath] = useState(
    () => groupIconSrcCache.get(iconCacheKey) ?? "",
  );

  useEffect(() => {
    let cancelled = false;

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

    getGroupIconSrc(groupIcon)
      .then((iconSrc) => {
        if (!cancelled) setIconCachePath(iconSrc);
      })
      .catch(() => {
        if (!cancelled) setIconCachePath("");
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoadHttpIcon, groupIcon, iconCacheKey]);

  if (!enableGroupIcon) return null;

  const renderIcon = () => {
    if (!hasGroupIcon) {
      return <DefaultGroupIcon className="text-primary h-full w-full" />;
    }

    if (isHttpIcon) {
      return iconCachePath ? (
        <img alt="group-icon" src={iconCachePath} style={GROUP_ICON_STYLE} />
      ) : (
        <CircularProgress size={18} />
      );
    }

    if (isDataIcon) {
      return <img alt="group-icon" src={groupIcon} style={GROUP_ICON_STYLE} />;
    }

    if (isInlineSvgIcon) {
      return (
        <img
          alt="group-icon"
          src={encodeSvgDataUri(groupIcon)}
          style={GROUP_ICON_STYLE}
        />
      );
    }

    return <DefaultGroupIcon className="text-primary h-full w-full" />;
  };

  return (
    <Box className="flex h-15 w-15 shrink-0 items-center pr-2">
      <Box sx={GROUP_ICON_LOADING_STYLE}>{renderIcon()}</Box>
    </Box>
  );
});
