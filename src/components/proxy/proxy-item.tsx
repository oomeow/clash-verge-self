import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import {
  alpha,
  ListItem,
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
    <ListItem sx={sx}>
      <ListItemButton
        dense
        data-delay-version={delayVersion}
        selected={selected}
        onClick={() => onClick?.(proxy.name)}
        sx={(theme) => {
          const showDelay = delay > 0;
          return {
            borderRadius: 1,
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
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              borderLeft: `3px solid ${theme.palette.primary.main}`,
              ...theme.applyStyles("dark", {
                bgcolor: alpha(theme.palette.primary.main, 0.35),
                borderLeft: `3px solid ${theme.palette.primary.light}`,
              }),
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
            <span className="flex items-center">
              <span className="mr-1 line-clamp-2">
                <span className="text-primary-text text-sm">
                  {proxy.name}
                  {showType && proxy.now && ` - ${proxy.now}`}
                </span>
              </span>
              <span className="flex flex-nowrap">
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

        {fixed && (
          // 展示fixed状态
          <span className={selected ? "the-pin" : "the-unpin"}>📌</span>
        )}
      </ListItemButton>
    </ListItem>
  );
});
