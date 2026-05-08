import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import { alpha, Box, ListItemButton, styled, Typography } from "@mui/material";
import { memo } from "react";
import { Proxy } from "tauri-plugin-mihomo-api";

import { BaseLoading } from "@/components/base";
import delayManager, { DEFAULT_LATENCY_TIMEOUT } from "@/services/delay";
import { useVergeStore } from "@/stores";

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

const Widget = styled("div")(({ theme: { typography } }) => ({
  padding: "2px 4px",
  fontSize: 14,
  fontFamily: typography.fontFamily,
  borderRadius: "4px",
}));

const TypeSpan = styled("span")(
  ({
    theme: {
      palette: { text },
      typography,
    },
  }) => ({
    display: "inline-block",
    border: `1px solid ${text.secondary}`,
    color: "text.secondary",
    borderRadius: 4,
    fontSize: 10,
    fontFamily: typography.fontFamily,
    marginRight: "4px",
    marginTop: "auto",
    padding: "0 4px",
    wordBreak: "keep-all",
    lineHeight: 1.5,
    "&[data-proxy-provider]": {
      backgroundColor: alpha(text.secondary, 0.2),
    },
  }),
);

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
      dense
      data-delay-version={delayVersion}
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
        ({ palette: { mode, primary } }) => {
          const bgcolor = mode === "light" ? "#ffffff" : "#24252f";
          const showDelay = delay > 0;
          const selectColor = mode === "light" ? primary.main : primary.light;

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
                  ? alpha(primary.main, 0.15)
                  : alpha(primary.main, 0.35),
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
              <TypeSpan data-proxy-provider>{proxy.providerName}</TypeSpan>
            )}
            <TypeSpan>{proxy.type}</TypeSpan>
            {proxy.udp && <TypeSpan>UDP</TypeSpan>}
            {proxy.xudp && <TypeSpan>XUDP</TypeSpan>}
            {proxy.tfo && <TypeSpan>TFO</TypeSpan>}
          </Box>
        )}
      </Box>
      <Box sx={{ ml: 0.5, color: "primary.main" }}>
        {delay === -2 && (
          <Widget>
            <BaseLoading />
          </Widget>
        )}
        {proxy.type !== "Direct" && delay !== -2 && (
          <Widget
            className="the-check"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelay();
            }}
            sx={({ palette }) => ({
              display: "none", // hover才显示
              ":hover": { bgcolor: alpha(palette.primary.main, 0.15) },
            })}>
            Check
          </Widget>
        )}

        {proxy.type !== "Direct" && delay >= 0 && (
          // 显示延迟
          <Widget
            className="the-delay"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelay();
            }}
            sx={({ palette }) => ({
              color: delayManager.formatDelayColor(delay, timeout),
              ":hover": { bgcolor: alpha(palette.primary.main, 0.15) },
            })}>
            {delayManager.formatDelay(delay, timeout)}
          </Widget>
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
