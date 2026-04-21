import { Box } from "@mui/material";
import { useLockFn, useMemoizedFn, useThrottleFn } from "ahooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import {
  closeConnection,
  getConnections,
  healthcheckProxyProvider,
  selectNodeForGroup,
  unfixedProxy,
} from "tauri-plugin-mihomo-api";

import { ProxyGroupSidebar } from "@/components/proxy/proxy-group-sidebar";
import { ProxyRender } from "@/components/proxy/proxy-render";
import { useProfiles } from "@/hooks/use-profiles";
import LoadingPage from "@/pages/loading";
import delayManager from "@/services/delay";
import { useVergeStore } from "@/stores";
import { cn } from "@/utils";

import { BaseEmpty } from "../base";
import { useRenderList } from "./use-render-list";

interface Props {
  mode: string;
}

export const ProxyGroups = (props: Props) => {
  const { mode } = props;
  const { t } = useTranslation();
  const isDirectMode = mode === "direct";
  const isRuleMode = mode === "rule";

  const { renderList, onProxies } = useRenderList(mode);
  const timeout = useVergeStore((s) => s.verge.default_latency_timeout ?? 5000);
  const autoCloseConnection = useVergeStore(
    (s) => s.verge.auto_close_connection ?? true,
  );

  const { current, patchCurrent } = useProfiles();

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [groupDelayVersions, setGroupDelayVersions] = useState<
    Record<string, number>
  >({});
  const groupNamesForDelayCheck = useMemo(() => {
    const names = Array.from(
      new Set(
        renderList
          .filter((item) => item.type === 0)
          .map((item) => item.group.name)
          .concat(["GLOBAL"]),
      ),
    );
    return names;
  }, [renderList]);

  useEffect(() => {
    if (!groupNamesForDelayCheck.length) return;

    const listeners = groupNamesForDelayCheck.map((groupName) => {
      const listener = () => {
        setGroupDelayVersions((prev) => ({
          ...prev,
          [groupName]: (prev[groupName] ?? 0) + 1,
        }));
      };
      delayManager.setGroupListener(groupName, listener);
      return { groupName, listener };
    });

    return () => {
      listeners.forEach(({ groupName, listener }) => {
        delayManager.removeGroupListener(groupName, listener);
      });
    };
  }, [groupNamesForDelayCheck]);

  // 切换分组的节点代理
  const handleChangeProxy = useMemoizedFn(
    useLockFn(async (group: IProxyGroupItem, proxy: IProxyItem) => {
      if (!["Selector", "URLTest", "Fallback"].includes(group.type)) return;

      const { name, type, fixed, now } = group;
      let unfixing = false;
      if (type === "URLTest") {
        if (fixed === proxy.name) {
          unfixing = true;
          await unfixedProxy(group.name);
        } else {
          await selectNodeForGroup(name, proxy.name);
        }
      } else {
        await selectNodeForGroup(name, proxy.name);
      }
      onProxies();

      // 断开连接
      if (autoCloseConnection) {
        getConnections().then(({ connections }) => {
          connections?.forEach((conn) => {
            if (conn.chains.includes(now!)) {
              closeConnection(conn.id);
            }
          });
        });
      }

      // 保存到 selected 中
      if (!current) return;
      if (!current.selected) current.selected = [];

      const index = current.selected.findIndex(
        (item) => item.name === group.name,
      );

      if (index < 0) {
        current.selected.push({ name, now: unfixing ? undefined : proxy.name });
      } else {
        current.selected[index] = {
          name,
          now: unfixing ? undefined : proxy.name,
        };
      }
      await patchCurrent({ selected: current.selected });
    }),
  );

  // 测全部延迟
  const { run: handleCheckAll } = useThrottleFn(
    async (groupName: string) => {
      const proxies = renderList
        .filter(
          (e) => e.group?.name === groupName && (e.type === 2 || e.type === 4),
        )
        .flatMap((e) => e.proxyCol || e.proxy!)
        .filter(Boolean);
      const providers = new Set(
        proxies.map((p) => p!.provider!).filter(Boolean),
      );

      if (providers.size) {
        Promise.allSettled(
          [...providers].map((p) => healthcheckProxyProvider(p)),
        ).then(() => onProxies());
      }
      const names = proxies
        .filter((p) => !p!.provider && p.type !== "Direct")
        .map((p) => p!.name);
      await delayManager.checkListDelay(names, groupName, timeout);
      onProxies();
    },
    { wait: 1000 },
  );

  // 滚到对应的节点
  const handleGroupLocation = useCallback(
    async (groupName: string) => {
      if (!groupName) return;

      const index = renderList.findIndex(
        (e) => e.type === 0 && e.key === groupName,
      );

      if (index >= 0) {
        virtuosoRef.current?.scrollToIndex?.({
          index,
          align: "start",
          behavior: "auto",
        });

        // highlight group
        const highlightGroup = () => {
          let ele = document.getElementById(`group-${groupName}`);
          if (!ele) {
            requestAnimationFrame(() => highlightGroup());
          } else {
            ele = document.getElementById(`group-${groupName}`);
            if (ele) {
              ele.classList.add("animate-highlight");
              setTimeout(() => {
                ele?.classList.remove("animate-highlight");
              }, 1000);
            }
          }
        };

        highlightGroup();
      }
    },
    [renderList, virtuosoRef],
  );

  // 滚到对应的节点
  const handleLocation = useCallback(
    (group: IProxyGroupItem) => {
      if (!group) return;
      const { name, now } = group;

      const index = renderList.findIndex(
        (e) =>
          e.group?.name === name &&
          ((e.type === 2 && e.proxy?.name === now) ||
            (e.type === 4 && e.proxyCol?.some((p) => p.name === now))),
      );

      if (index >= 0) {
        virtuosoRef.current?.scrollToIndex?.({
          index,
          align: "center",
          behavior: "smooth",
        });
      }
    },
    [renderList, virtuosoRef],
  );

  const groupNameList = renderList
    .filter((item) => item.type === 0)
    .map((item) => item.key);

  if (isDirectMode) {
    return <BaseEmpty text={t("common.empty.directMode")} />;
  }

  if (renderList.length === 0) return <LoadingPage />;

  return (
    <Box className="relative flex h-full w-full">
      <Box
        className={cn("h-full w-full", {
          "pr-7": isRuleMode,
        })}>
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: "100%" }}
          totalCount={renderList.length}
          increaseViewportBy={256}
          itemContent={(index) => (
            <div
              className={cn("py-1", {
                "pt-2": index === 0,
                "pb-2": index === renderList.length - 1,
              })}>
              <ProxyRender
                key={renderList[index].key}
                item={renderList[index]}
                delayVersion={
                  groupDelayVersions[renderList[index].group.name] ?? 0
                }
                onLocation={handleLocation}
                onCheckAll={handleCheckAll}
                onChangeProxy={handleChangeProxy}
              />
            </div>
          )}
        />
      </Box>

      {isRuleMode && (
        <div className="absolute top-0 right-0 bottom-0 z-10 mr-0 w-7 bg-transparent hover:w-30">
          <div className="flex h-full w-full items-center justify-center hover:shadow-2xl">
            <ProxyGroupSidebar
              groupNameList={groupNameList}
              onGroupNameClick={(groupName) => {
                handleGroupLocation(groupName);
              }}
            />
          </div>
        </div>
      )}
    </Box>
  );
};
