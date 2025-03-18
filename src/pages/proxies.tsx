import { BasePage } from "@/components/base";
import { ProviderButton } from "@/components/proxy/provider-button";
import { ProxyGroups } from "@/components/proxy/proxy-groups";
import { useVerge } from "@/hooks/use-verge";
import { patchClashConfig } from "@/services/cmds";
import useGroupsStore from "@/store/use-groups-store";
import { cn } from "@/utils";
import { Box, Button, ButtonGroup } from "@mui/material";
import { useLockFn, useMemoizedFn } from "ahooks";
import { SortAsc, SortAscIcon, SortDesc, Wifi } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import {
  closeAllConnections,
  delayGroup,
  delayProxyByName,
  getBaseConfig,
  selectNodeForProxy,
} from "tauri-plugin-mihomo-api";

const ProxyPage = () => {
  const { t } = useTranslation();

  const groups = useGroupsStore((state) => state.groups);
  const toggleExpandGroup = useGroupsStore((state) => state.toggleExpandGroup);
  const getGroup = useGroupsStore((state) => state.getGroup);
  const fetchGroups = useGroupsStore((state) => state.fetchGroups);

  const { data: clashConfig, mutate: mutateClash } = useSWR(
    "getClashConfig",
    getBaseConfig,
  );

  const { verge } = useVerge();

  const modeList = ["rule", "global", "direct"];

  const curMode = clashConfig?.mode?.toLowerCase();

  const onChangeMode = useMemoizedFn(
    useLockFn(async (mode: string) => {
      // await updateConfigs({ mode });
      await patchClashConfig({ mode });
      mutateClash();
      // 断开连接
      if (mode !== curMode && verge?.auto_close_connection) {
        closeAllConnections();
      }
    }),
  );

  useEffect(() => {
    if (curMode && !modeList.includes(curMode)) {
      onChangeMode("rule");
    }
  }, [curMode]);

  useEffect(() => {
    fetchGroups();
  }, []);

  return (
    <BasePage
      full
      contentStyle={{ height: "100%" }}
      title={t("Proxy Groups")}
      header={
        <Box display="flex" alignItems="center" gap={1}>
          <ProviderButton key={"provider"} />

          <ButtonGroup size="small">
            {modeList.map((mode) => (
              <Button
                key={mode}
                variant={mode === curMode ? "contained" : "outlined"}
                onClick={() => onChangeMode(mode)}
                sx={{ textTransform: "capitalize" }}>
                {t(mode)}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
      }>
      {/* <ProxyGroups mode={curMode!} /> */}
      {groups.map((group, index) => {
        return (
          <div
            key={group.name}
            className={cn("flex h-fit w-full flex-col items-center", {
              "mt-2": index === 0,
            })}>
            <div
              className="sticky top-0 z-10 h-16 w-full cursor-pointer bg-white px-2 shadow-md"
              onClick={() => toggleExpandGroup(group.name)}>
              <span className="text-lg font-bold">{group.name}</span>
              <div className="flex items-center space-x-1">
                <button
                  className="btn btn-xs btn-circle p-1"
                  onClick={async () => {
                    await delayGroup(
                      group.name,
                      "https://www.gstatic.com/generate_204",
                      5000,
                    );
                    await fetchGroups();
                  }}>
                  <Wifi />
                </button>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 p-2">
              {group.all.map((proxy) => {
                return (
                  <div
                    key={proxy.name}
                    onClick={async () => {
                      await selectNodeForProxy(group.name, proxy.name);
                      await fetchGroups();
                    }}
                    className={cn(
                      "btn btn-sm btn-soft flex items-center justify-between",
                      {
                        "btn-primary btn-active": group.now === proxy.name,
                      },
                    )}>
                    <p className="line-clamp-2">{proxy.name}</p>
                    <button
                      className="btn btn-xs btn-square px-4 text-green-500"
                      onClick={async (e) => {
                        e.preventDefault();
                        await delayProxyByName(
                          proxy.name,
                          "https://www.gstatic.com/generate_204",
                          5000,
                        );
                        await fetchGroups();
                      }}>
                      {proxy.history[0]?.delay ?? "-"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </BasePage>
  );
};

export default ProxyPage;
