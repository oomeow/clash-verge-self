import { BasePage } from "@/components/base";
import { ProviderButton } from "@/components/proxy/provider-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVerge } from "@/hooks/use-verge";
import { patchClashConfig } from "@/services/cmds";
import useGroupsStore, { Group } from "@/store/use-groups-store";
import { cn } from "@/utils";
import { useLockFn, useMemoizedFn } from "ahooks";
import { findIndex } from "lodash-es";
import { Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const [visibleItems, setVisibleItems] = useState<Group[]>([]);
  const currentIndex = useRef(0); // 当前渲染到的索引
  const dataRef = useRef<Group[]>([]); // 保持数据引用一致性

  useEffect(() => {
    if (groups) {
      dataRef.current = groups;
    }
  }, [groups]);

  // 分批渲染逻辑
  useEffect(() => {
    if (dataRef.current.length === 0) return;

    let animationFrameId = 0;
    const renderNextBatch = () => {
      const nextIndex = currentIndex.current + 10;
      console.log("nextIndex:", nextIndex);
      const nextBatch = dataRef.current.slice(currentIndex.current, nextIndex);
      console.log("nextBatch:", nextBatch);

      // 更新可见项（合并已渲染的部分）
      setVisibleItems((prev) => [...prev, ...nextBatch]);
      currentIndex.current = nextIndex;

      // 继续渲染下一批次
      if (currentIndex.current < dataRef.current.length) {
        animationFrameId = requestAnimationFrame(renderNextBatch);
      }
    };

    // 启动首次渲染
    animationFrameId = requestAnimationFrame(renderNextBatch);

    // 清理未完成的渲染
    return () => cancelAnimationFrame(animationFrameId);
  }, [groups, dataRef]);

  return (
    <BasePage
      full
      contentStyle={{ height: "100%" }}
      title={t("Proxy Groups")}
      header={
        <div className="flex items-center gap-1">
          <ProviderButton key={"provider"} />

          {/* <ButtonGroup size="small"> */}
          {modeList.map((mode) => (
            <Button
              key={mode}
              variant={mode === curMode ? "default" : "outline"}
              onClick={() => onChangeMode(mode)}>
              {t(mode)}
            </Button>
          ))}
          {/* </ButtonGroup> */}
        </div>
      }>
      {/* <ProxyGroups mode={curMode!} /> */}
      {visibleItems.map((group, index) => {
        const groupName = group.name;
        return (
          <div
            key={groupName}
            className={cn("mx-2 flex h-fit flex-col items-center", {
              "mt-2": index === 0,
            })}>
            <div
              className="sticky top-2 z-10 my-[2px] h-16 w-full cursor-pointer rounded-md bg-white px-2 shadow-md"
              onClick={() => toggleExpandGroup(groupName)}>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">{groupName}</span>
                <Badge>{group.type}</Badge>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6 p-1"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const res = await delayGroup(
                      groupName,
                      "https://www.gstatic.com/generate_204",
                      5000,
                    );
                    updateGroupDelay(groupName, res);
                  }}>
                  <Wifi />
                </Button>
              </div>
            </div>
            {!expandedGroups[groupName] ? (
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
                        "bg-primary text-primary-foreground flex items-center justify-between p-2",
                        {
                          "border border-dashed border-red-500":
                            group.now === proxyName,
                        },
                      )}>
                      {/* <p className="line-clamp-2">{proxyName}</p> */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>{proxyName}</TooltipTrigger>
                          <TooltipContent>
                            <p className="line-clamp-2">{proxyName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <button
                        className="btn btn-xs btn-square w-fit px-2 text-green-500"
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
                        }}>
                        {proxiesDelay[groupName]?.[proxyName] == -1
                          ? "Timeout"
                          : proxiesDelay[groupName]?.[proxyName] == undefined
                            ? "check"
                            : proxiesDelay[groupName]?.[proxyName]}
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
