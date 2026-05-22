import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import { alpha, Box, ListItemButton, Typography } from "@mui/material";
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
  fixed: boolean;
  selected: boolean;
  showType?: boolean;
  delayVersion?: number;
  onClick?: (name: string) => void;
}

// 多列布局
export const ProxyItemMini = memo(function ProxyItemMini(props: Props) {
  const {
    group,
    proxy,
    fixed,
    selected,
    showType = true,
    delayVersion,
    onClick,
  } = props;
  const timeout = useVergeStore(
    (s) => s.verge.default_latency_timeout ?? DEFAULT_LATENCY_TIMEOUT,
  );
  const delay = delayManager.getDelayFix(proxy, group.name);

  const onDelay = async () => {
    await delayManager.checkDelay(proxy.name, group.name, timeout);
  };

  return (
    <ListItemButton
      id={proxyId(group.name, proxy.name)}
      dense
      data-delay-version={delayVersion}
      data-fixed={fixed}
      selected={selected}
      onClick={() => onClick?.(proxy.name)}
      sx={[
        {
          height: 56,
          borderRadius: 1.5,
          pl: 1.5,
          pr: 1,
          justifyContent: "space-between",
          alignItems: "center",
        },
        ({ palette: { mode, primary, warning, background } }) => {
          const bgcolor = background.paper;
          const showDelay = delay > 0;
          const selectColor = mode === "light" ? primary.main : primary.light;
          const fixedColor = mode === "light" ? warning.main : warning.light;

          return {
            "&:hover": {
              bgcolor:
                mode === "light"
                  ? alpha(primary.main, 0.15)
                  : alpha(primary.main, 0.35),
            },
            "&:hover .the-check": { display: !showDelay ? "block" : "none" },
            "&:hover .the-delay": { display: showDelay ? "block" : "none" },
            "&:hover .the-icon": { display: "none" },
            "& .the-pin, & .the-unpin": {
              position: "absolute",
              fontSize: "12px",
              top: "-5px",
              right: "-5px",
            },
            "& .the-unpin": { filter: "grayscale(1)" },
            "&.Mui-selected": {
              width: `calc(100% + 3px)`,
              marginLeft: `-3px`,
              borderLeft: `3px solid ${selectColor}`,
              bgcolor:
                mode === "light"
                  ? alpha(primary.main, 0.25)
                  : alpha(primary.main, 0.45),
            },
            '&[data-fixed="true"]:not(.Mui-selected)': {
              borderLeft: `2px solid ${alpha(fixedColor, 0.25)}`,
            },
            '&[data-fixed="true"].Mui-selected': {
              borderLeft: `3px solid ${fixedColor}`,
              bgcolor:
                mode === "light"
                  ? alpha(warning.main, 0.08)
                  : alpha(warning.main, 0.18),
            },
            backgroundColor: bgcolor,
            transition: "background-color 0s",
          };
        },
      ]}>
      <Box
        title={`${proxy.name}${proxy.now ? "\n" + proxy.now : ""}`}
        sx={{
          width: "100%",
          overflow: "hidden",
        }}>
        <Typography
          variant="body2"
          component="div"
          sx={{
            color: "text.primary",
            display: "block",
            textOverflow: "ellipsis",
            wordBreak: "break-all",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}>
          {proxy.name}
        </Typography>

        {showType && (
          <Box
            sx={{
              display: "flex",
              flexWrap: "nowrap",
              flex: "none",
              marginTop: "4px",
            }}>
            {proxy.now && (
              <Typography
                variant="body2"
                component="div"
                sx={{
                  color: "text.secondary",
                  display: "block",
                  textOverflow: "ellipsis",
                  wordBreak: "break-all",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  marginRight: "8px",
                }}>
                {proxy.now}
              </Typography>
            )}
            {!!proxy.providerName && (
              <span
                className="border-text-secondary/40 text-text-secondary data-proxy-provider:bg-text-secondary/15 mt-auto mr-1 inline-block rounded-full border px-1.5 text-[10px] leading-normal break-keep"
                data-proxy-provider>
                {proxy.providerName}
              </span>
            )}
            <span className="border-text-secondary/40 text-text-secondary mt-auto mr-1 inline-block rounded-full border px-1.5 text-[10px] leading-normal break-keep">
              {proxy.type}
            </span>
            {proxy.udp && (
              <span className="border-text-secondary/40 text-text-secondary mt-auto mr-1 inline-block rounded-full border px-1.5 text-[10px] leading-normal break-keep">
                UDP
              </span>
            )}
            {proxy.xudp && (
              <span className="border-text-secondary/40 text-text-secondary mt-auto mr-1 inline-block rounded-full border px-1.5 text-[10px] leading-normal break-keep">
                XUDP
              </span>
            )}
            {proxy.tfo && (
              <span className="border-text-secondary/40 text-text-secondary mt-auto mr-1 inline-block rounded-full border px-1.5 text-[10px] leading-normal break-keep">
                TFO
              </span>
            )}
          </Box>
        )}
      </Box>
      <Box sx={{ ml: 0.5, color: "primary.main" }}>
        {delay === -2 && (
          <div className="rounded-md px-1.5 py-0.5 text-sm">
            <BaseLoading />
          </div>
        )}
        {proxy.type !== "Direct" && delay !== -2 && (
          <Box
            component="div"
            className="the-check hover:bg-primary/15 rounded-md px-1.5 py-0.5 text-sm"
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
            className="the-delay hover:bg-primary/15 rounded-md px-1.5 py-0.5 text-sm"
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
            sx={{ fontSize: 16, mr: 0.5, display: "block" }}
          />
        )}
      </Box>
      {fixed && (
        // 展示fixed状态
        <span className={selected ? "the-pin" : "the-unpin"}>📌</span>
      )}
    </ListItemButton>
  );
});
