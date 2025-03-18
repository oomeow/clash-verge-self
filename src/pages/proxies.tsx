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
  const expandedGroups = useGroupsStore((state) => state.expandedGroups);
  const proxiesDelay = useGroupsStore((state) => state.proxiesDelay);

  const getGroup = useGroupsStore((state) => state.getGroup);
  const toggleExpandGroup = useGroupsStore((state) => state.toggleExpandGroup);
  const updateProxyDelay = useGroupsStore((state) => state.updateProxyDelay);
  const updateGroupDelay = useGroupsStore((state) => state.updateGroupDelay);
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
        const groupName = group.name;
        return (
          <div
            key={groupName}
            className={cn("mx-2 flex h-fit flex-col items-center", {
              "mt-2": index === 0,
            })}>
            <div
              className="sticky top-0 z-10 my-[2px] h-16 w-full cursor-pointer rounded-md bg-white px-2 shadow-md"
              onClick={() => toggleExpandGroup(groupName)}>
              <span className="text-lg font-bold">{groupName}</span>
              <div className="flex items-center space-x-1">
                <button
                  className="btn btn-xs btn-circle p-1"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const res = await delayGroup(
                      groupName,
                      "https://www.gstatic.com/generate_204",
                      5000,
                    );
                    updateGroupDelay(groupName, res);
                    // await fetchGroups();
                  }}>
                  <Wifi />
                </button>
              </div>
            </div>
            {expandedGroups[groupName] ? (
              <div className="grid w-full grid-cols-3 gap-2 p-2">
                {group.all.map((proxy) => {
                  const { name: proxyName } = proxy;
                  return (
                    <div
                      key={proxyName}
                      onClick={async () => {
                        await selectNodeForProxy(groupName, proxyName);
                        await fetchGroups();
                      }}
                      className={cn(
                        "btn btn-sm btn-soft flex items-center justify-between",
                        {
                          "btn-primary btn-active": group.now === proxyName,
                        },
                      )}>
                      <p className="line-clamp-2">{proxyName}</p>
                      <button
                        className="btn btn-xs btn-square px-4 text-green-500"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const delay = await delayProxyByName(
                            proxyName,
                            "https://www.gstatic.com/generate_204",
                            5000,
                          );
                          if (delay.message) {
                            updateProxyDelay(groupName, proxyName, -1);
                          } else {
                            updateProxyDelay(groupName, proxyName, delay.delay);
                          }
                          // await fetchGroups();
                        }}>
                        {proxiesDelay[groupName]?.[proxyName] ?? "check"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div></div>
            )}
          </div>
        );
      })}
    </BasePage>
  );
};

export default ProxyPage;
