import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import {
  alpha,
  Box,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  styled,
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

const Widget = styled("div")(() => ({
  padding: "3px 6px",
  fontSize: 14,
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
    <Box sx={[{ pr: 2, ...{ sx } }]}>
      <ListItemButton
        id={proxyId(group.name, proxy.name)}
        dense
        data-delay-version={delayVersion}
        data-fixed={fixed}
        selected={selected}
        onClick={() => onClick?.(proxy.name)}
        sx={(theme) => {
          const showDelay = delay > 0;
          const { mode, primary, warning } = theme.palette;
          const selectColor = mode === "light" ? primary.main : primary.light;
          const fixedColor = mode === "light" ? warning.main : warning.light;
          return {
            borderRadius: 1,
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
              transition: "opacity 0s",
            },
            "& [data-pin][data-fixed='true']": { opacity: 1 },
            "& [data-pin][data-fixed='true'][data-selected='false']": {
              filter: "grayscale(1)",
              opacity: 0.6,
            },
            "&::before": {
              content: '""',
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 0,
              borderRadius: "3px 0 0 3px",
              transition: "width 0s",
            },
            "&.Mui-selected::before": {
              width: "3px",
              backgroundColor: selectColor,
            },
            "&.Mui-selected": {
              bgcolor:
                mode === "light"
                  ? alpha(primary.main, 0.15)
                  : alpha(primary.main, 0.35),
            },
            '&[data-fixed="true"]:not(.Mui-selected)::before': {
              width: "2px",
              backgroundColor: alpha(fixedColor, 0.25),
            },
            '&[data-fixed="true"].Mui-selected::before': {
              width: "3px",
              backgroundColor: fixedColor,
            },
            '&[data-fixed="true"].Mui-selected': {
              bgcolor:
                mode === "light"
                  ? alpha(warning.main, 0.08)
                  : alpha(warning.main, 0.18),
            },
            backgroundColor: "#ffffff",
            ...theme.applyStyles("dark", {
              backgroundColor: "#24252f",
            }),
            transition: "background-color 0s",
            marginBottom: "2px",
          };
        }}>
        <ListItemText
          title={proxy.name}
          secondary={
            <span className="flex flex-col">
              <span className="text-primary-text line-clamp-2 text-sm">
                {proxy.name}
                {showType && proxy.now && (
                  <span className="text-secondary-text ml-1">
                    - {proxy.now}
                  </span>
                )}
              </span>
              <span className="mt-0.5 flex flex-nowrap">
                {showType && !!proxy.providerName && (
                  <TypeSpan data-proxy-provider>{proxy.providerName}</TypeSpan>
                )}
                {showType && <TypeSpan>{proxy.type}</TypeSpan>}
                {showType && proxy.udp && <TypeSpan>UDP</TypeSpan>}
                {showType && proxy.xudp && <TypeSpan>XUDP</TypeSpan>}
                {showType && proxy.tfo && <TypeSpan>TFO</TypeSpan>}
              </span>
            </span>
          }
        />

        <ListItemIcon
          sx={{ justifyContent: "flex-end", color: "primary.main" }}>
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
