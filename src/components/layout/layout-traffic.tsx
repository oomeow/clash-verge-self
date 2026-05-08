import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import MemoryOutlined from "@mui/icons-material/MemoryOutlined";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { t } from "i18next";
import { debounce } from "lodash-es";
import { useEffect, useRef } from "react";

import { useConnectionData } from "@/hooks/use-connection-data";
import { useLogData } from "@/hooks/use-log-data";
import { useMemoryData } from "@/hooks/use-memory-data";
import { useTrafficData } from "@/hooks/use-traffic-data";
import { useVisibility } from "@/hooks/use-visibility";
import { restartSidecar } from "@/services/cmds";
import { useVergeStore } from "@/stores";
import parseTraffic from "@/utils/parse-traffic";

import { useNotice } from "../base/notifies";
import { TrafficGraph, type TrafficRef } from "./traffic-graph";

// setup the traffic
export const LayoutTraffic = () => {
  const trafficGraph = useVergeStore((s) => s.verge.traffic_graph ?? true);
  const displayMemory = useVergeStore(
    (s) => s.verge.enable_memory_usage ?? true,
  );
  const { notice } = useNotice();
  const pageVisible = useVisibility();

  // init mihomo websocket data
  const {
    response: { data: traffic = { up: 0, down: 0 } },
  } = useTrafficData();
  const {
    response: { data: memory = { inuse: 0 } },
  } = useMemoryData();
  useLogData();
  useConnectionData();

  const trafficRef = useRef<TrafficRef>(null);

  useEffect(() => {
    if (trafficRef.current) trafficRef.current.appendData(traffic);
  }, [traffic]);

  const [up, upUnit] = parseTraffic(traffic.up);
  const [down, downUnit] = parseTraffic(traffic.down);
  const [inuse, inuseUnit] = parseTraffic(memory.inuse);

  const iconStyle: any = {
    sx: { fontSize: 16 },
  };
  const valStyle: any = {
    component: "span",
    // color: "primary",
    textAlign: "center",
    sx: { flex: "1 1 56px", userSelect: "none" },
  };
  const unitStyle: any = {
    component: "span",
    color: "grey.500",
    fontSize: "12px",
    textAlign: "right",
    sx: { flex: "0 1 27px", userSelect: "none" },
  };

  const restartClashCore = debounce(async () => {
    try {
      await restartSidecar();
      notice("success", t(`messages.clash.core.restarted`), 1000);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  }, 500);

  return (
    <Box sx={{ width: "100%" }} onClick={trafficRef.current?.toggleStyle}>
      {trafficGraph && pageVisible && (
        <div style={{ width: "100%", height: 60, marginBottom: 6 }}>
          <TrafficGraph ref={trafficRef} />
        </div>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}>
        <Box
          sx={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
          <ArrowUpward
            {...iconStyle}
            color={+up > 0 ? "secondary" : "disabled"}
          />
          <Typography {...valStyle} color="secondary">
            {up}
          </Typography>
          <Typography {...unitStyle}>{upUnit}/s</Typography>
        </Box>

        <Box
          sx={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
          <ArrowDownward
            {...iconStyle}
            color={+down > 0 ? "primary" : "disabled"}
          />
          <Typography {...valStyle} color="primary">
            {down}
          </Typography>
          <Typography {...unitStyle}>{downUnit}/s</Typography>
        </Box>

        {displayMemory && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
            }}>
            <Tooltip title={t("common.actions.restart")}>
              <IconButton
                color="primary"
                sx={{ p: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  restartClashCore();
                }}>
                <MemoryOutlined {...iconStyle} />
              </IconButton>
            </Tooltip>
            <Box
              title={t("pages.settings.verge.layout.memoryUsage")}
              sx={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
              <Typography {...valStyle}>{inuse}</Typography>
              <Typography {...unitStyle}>{inuseUnit}</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
