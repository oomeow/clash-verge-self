import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import {
  alpha,
  Box,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SxProps,
  Theme,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { memo } from "react";
import { Proxy } from "tauri-plugin-mihomo-api";

import { BaseLoading } from "@/components/base";
import delayManager, { DEFAULT_LATENCY_TIMEOUT } from "@/services/delay";
import { useVergeStore } from "@/stores";
import { proxyId } from "@/utils/proxyId";

import { IProxyGroupItem } from "./use-render-list";

interface Props {
  group: IProxyGroupItem;
  proxy: Proxy;
  selected: boolean;
  fixed: boolean;
  showType?: boolean;
  delayVersion?: number;
  sx?: SxProps<Theme>;
  onClick?: (name: string) => void;
}

export const ProxyItem = memo(function ProxyItem(props: Props) {
  const {
    group,
    proxy,
    selected,
    fixed,
    showType = true,
    delayVersion,
    sx,
    onClick,
  } = props;
  const timeout = useVergeStore(
    (s) => s.verge.default_latency_timeout ?? DEFAULT_LATENCY_TIMEOUT,
  );
  const delay = delayManager.getDelayFix(proxy, group.name);

  const onDelay = useLockFn(async () => {
    await delayManager.checkDelay(proxy.name, group.name, timeout);
  });

  return (
    <Box sx={sx}>
      <ListItemButton
        id={proxyId(group.name, proxy.name)}
        dense
        data-delay-version={delayVersion}
        data-fixed={fixed}
        selected={selected}
        onClick={() => onClick?.(proxy.name)}
        sx={(theme) => {
          const showDelay = delay > 0;
          const { primary, warning, background } = theme.palette;
          const isLight = theme.palette.mode === "light";
          const selectColor = isLight ? primary.main : primary.light;
          const fixedColor = isLight ? warning.main : warning.light;
          return {
            borderRadius: 2,
            backgroundColor: background.paper,
            boxShadow: isLight
              ? "0 1px 2px rgba(0,0,0,0.04)"
              : "0 1px 2px rgba(0,0,0,0.15)",
            transition: "background-color 0s",
            "&:hover": {
              bgcolor: alpha(primary.main, isLight ? 0.08 : 0.14),
            },
            "&:hover .the-check": { display: !showDelay ? "block" : "none" },
            "&:hover .the-delay": { display: showDelay ? "block" : "none" },
            "&:hover .the-icon": { display: "none" },
            position: "relative",
            "& [data-pin]": {
              position: "absolute",
              fontSize: "12px",
              top: "-5px",
              right: "-5px",
              opacity: 0,
              transition: "opacity 0.15s",
            },
            "& [data-pin][data-fixed='true']": { opacity: 1 },
            "& [data-pin][data-fixed='true'][data-selected='false']": {
              filter: "grayscale(1)",
              opacity: 0.6,
            },
            "&.Mui-selected": {
              borderLeft: `3px solid ${selectColor}`,
              bgcolor: alpha(primary.main, 0.12),
            },
            "&.Mui-selected:hover": {
              bgcolor: alpha(primary.main, 0.12),
            },
            ...theme.applyStyles("dark", {
              "&.Mui-selected": {
                bgcolor: alpha(primary.main, 0.22),
              },
              "&.Mui-selected:hover": {
                bgcolor: alpha(primary.main, 0.22),
              },
            }),
            '&[data-fixed="true"]:not(.Mui-selected)': {
              borderLeft: `2px solid ${alpha(fixedColor, 0.4)}`,
            },
            '&[data-fixed="true"].Mui-selected': {
              borderLeft: `3px solid ${fixedColor}`,
              bgcolor: alpha(warning.main, 0.12),
            },
            '&[data-fixed="true"].Mui-selected:hover': {
              bgcolor: alpha(warning.main, 0.12),
            },
            ...theme.applyStyles("dark", {
              '&[data-fixed="true"].Mui-selected': {
                bgcolor: alpha(warning.main, 0.22),
              },
              '&[data-fixed="true"].Mui-selected:hover': {
                bgcolor: alpha(warning.main, 0.22),
              },
            }),
            marginBottom: "2px",
          };
        }}>
        <ListItemText
          title={`${proxy.name}${proxy.now ? `\n(${proxy.now})` : ""}`}
          secondary={
            <span className="flex flex-col">
              <span className="text-text-primary line-clamp-2 text-sm">
                {proxy.name}
              </span>
              {showType && (
                <span className="mt-0.5 flex flex-nowrap">
                  {proxy.now && (
                    <span className="text-text-secondary mr-1">
                      {proxy.now}
                    </span>
                  )}
                  {!!proxy.providerName && (
                    <span
                      className="bg-text-secondary/8 text-text-secondary data-proxy-provider:bg-text-secondary/12 mt-auto mr-1 inline-block rounded-full px-1.5 text-[10px] leading-normal break-keep"
                      data-proxy-provider>
                      {proxy.providerName}
                    </span>
                  )}
                  <span className="bg-text-secondary/8 text-text-secondary mt-auto mr-1 inline-block rounded-full px-1.5 text-[10px] leading-normal break-keep">
                    {proxy.type}
                  </span>
                  {proxy.udp && (
                    <span className="bg-text-secondary/8 text-text-secondary mt-auto mr-1 inline-block rounded-full px-1.5 text-[10px] leading-normal break-keep">
                      UDP
                    </span>
                  )}
                  {proxy.xudp && (
                    <span className="bg-text-secondary/8 text-text-secondary mt-auto mr-1 inline-block rounded-full px-1.5 text-[10px] leading-normal break-keep">
                      XUDP
                    </span>
                  )}
                  {proxy.tfo && (
                    <span className="bg-text-secondary/8 text-text-secondary mt-auto mr-1 inline-block rounded-full px-1.5 text-[10px] leading-normal break-keep">
                      TFO
                    </span>
                  )}
                </span>
              )}
            </span>
          }
        />

        <ListItemIcon
          sx={{ justifyContent: "flex-end", color: "primary.main" }}>
          {delay === -2 && (
            <div className="rounded-md px-1.5 py-0.75 text-sm">
              <BaseLoading />
            </div>
          )}

          {proxy.type !== "Direct" && delay !== -2 && (
            <Box
              component="div"
              className="the-check hover:bg-primary/15 rounded-md px-1.5 py-0.75 text-sm"
              sx={{ display: "none" }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelay();
              }}>
              Check
            </Box>
          )}

          {proxy.type !== "Direct" && delay >= 0 && (
            // 显示延迟
            <div
              className="the-delay hover:bg-primary/15 rounded-md px-1.5 py-0.75 text-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelay();
              }}
              style={{ color: delayManager.formatDelayColor(delay, timeout) }}>
              {delayManager.formatDelay(delay, timeout)}
            </div>
          )}

          {proxy.type !== "Direct" && delay !== -2 && delay < 0 && selected && (
            // 展示已选择的icon
            <CheckCircleOutlineRounded
              className="the-icon"
              sx={{ fontSize: 16 }}
            />
          )}
        </ListItemIcon>

        {fixed !== undefined && (
          // 展示fixed状态
          <span data-pin data-fixed={fixed} data-selected={selected}>
            📌
          </span>
        )}
      </ListItemButton>
    </Box>
  );
});
