import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import MemoryOutlined from "@mui/icons-material/MemoryOutlined";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
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

  const restartClashCore = debounce(async () => {
    try {
      await restartSidecar();
      notice("success", t(`messages.clash.core.restarted`), 1000);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  }, 500);

  return (
    <Box className="w-full" onClick={trafficRef.current?.toggleStyle}>
      {trafficGraph && pageVisible && (
        <div style={{ width: "100%", height: 60, marginBottom: 6 }}>
          <TrafficGraph ref={trafficRef} />
        </div>
      )}

      <Stack direction="column" spacing={0.75}>
        <Stack direction="row" className="items-center whitespace-nowrap">
          <ArrowUpward
            fontSize="small"
            color={+up > 0 ? "secondary" : "disabled"}
          />
          <Typography
            component="span"
            className="flex-[1_1_56px] text-center select-none"
            color="secondary">
            {up}
          </Typography>
          <Typography
            component="span"
            className="flex-[0_1_27px] text-right text-xs select-none"
            color="grey.500">
            {upUnit}/s
          </Typography>
        </Stack>

        <Stack direction="row" className="items-center whitespace-nowrap">
          <ArrowDownward
            fontSize="small"
            color={+down > 0 ? "primary" : "disabled"}
          />
          <Typography
            component="span"
            className="flex-[1_1_56px] text-center select-none"
            color="primary">
            {down}
          </Typography>
          <Typography
            component="span"
            className="flex-[0_1_27px] text-right text-xs select-none"
            color="grey.500">
            {downUnit}/s
          </Typography>
        </Stack>

        {displayMemory && (
          <Stack direction="row" className="items-center whitespace-nowrap">
            <Tooltip title={t("common.actions.restart")}>
              <IconButton
                color="primary"
                className="p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  restartClashCore();
                }}>
                <MemoryOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box
              title={t("pages.settings.verge.layout.memoryUsage")}
              className="flex flex-1 items-center">
              <Typography
                component="span"
                className="flex-[1_1_56px] text-center select-none">
                {inuse}
              </Typography>
              <Typography
                component="span"
                className="flex-[0_1_27px] text-right text-xs select-none"
                color="grey.500">
                {inuseUnit}
              </Typography>
            </Box>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
