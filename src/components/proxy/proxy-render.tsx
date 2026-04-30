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
import { useMemoizedFn } from "ahooks";
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
  const [iconCachePath, setIconCachePath] = useState("");
  const groupIcon = group.icon?.trim() ?? "";
  const isHttpIcon = groupIcon.startsWith("http");
  const isDataIcon = groupIcon.startsWith("data");
  const isInlineSvgIcon = groupIcon.startsWith("<svg");

  const initIconCachePath = useMemoizedFn(
    async (groupName: string, groupIcon: string) => {
      if (isHttpIcon) {
        const fileName =
          groupName.replaceAll(" ", "") + "-" + getFileName(groupIcon);
        const iconPath = await downloadIconCache(groupIcon, fileName);
        setIconCachePath(convertFileSrc(iconPath));
      }
    },
  );

  const getFileName = useMemoizedFn((url: string) => {
    return url.substring(url.lastIndexOf("/") + 1);
  });

  useEffect(() => {
    if (!isHttpIcon) {
      setIconCachePath("");
      return;
    }
    initIconCachePath(group.name, groupIcon);
  }, [initIconCachePath, isHttpIcon, group.name, groupIcon]);

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
        {enableGroupIcon && isHttpIcon && (
          <img
            src={iconCachePath === "" ? groupIcon : iconCachePath}
            width="32px"
            style={{ marginRight: "12px", borderRadius: "6px" }}
          />
        )}
        {enableGroupIcon && isDataIcon && (
          <img
            src={groupIcon}
            width="32px"
            style={{ marginRight: "12px", borderRadius: "6px" }}
          />
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
