import { Box } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLockFn, useMemoizedFn, useThrottleFn } from "ahooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  closeConnection,
  getConnections,
  healthcheckProxyProvider,
  selectNodeForGroup,
  unfixedProxy,
} from "tauri-plugin-mihomo-api";

import { ProxyGroupSidebar } from "@/components/proxy/proxy-group-sidebar";
import { ProxyRender } from "@/components/proxy/proxy-render";
import LoadingPage from "@/pages/loading";
import delayManager from "@/services/delay";
import { useProfilesStore, useVergeStore } from "@/stores";
import { cn } from "@/utils";

import { BaseEmpty } from "../base";
import { type IRenderItem, useRenderList } from "./use-render-list";

interface Props {
  mode: string;
}

const ESTIMATED_GROUP_HEIGHT = 78;
const ESTIMATED_ITEM_HEIGHT = 64;

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

  const currentProfile = useProfilesStore((s) => s.currentProfile);
  const patchCurrentProfile = useProfilesStore((s) => s.patchCurrentProfile);

  const scrollParentRef = useRef<HTMLDivElement>(null);
  const [groupDelayVersions, setGroupDelayVersions] = useState<
    Record<string, number>
  >({});
  const groupIndexes = useMemo(
    () =>
      renderList.reduce<number[]>((indexes, item, index) => {
        if (item.type === 0) indexes.push(index);
        return indexes;
      }, []),
    [renderList],
  );
  const groupSections = useMemo(
    () =>
      groupIndexes.map((groupIndex, index) => ({
        groupIndex,
        nextGroupIndex: groupIndexes[index + 1] ?? renderList.length,
      })),
    [groupIndexes, renderList.length],
  );
  const rowVirtualizer = useVirtualizer({
    count: renderList.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (index) =>
      renderList[index]?.type === 0
        ? ESTIMATED_GROUP_HEIGHT
        : ESTIMATED_ITEM_HEIGHT,
    getItemKey: (index) => renderList[index]?.key ?? index,
    overscan: 8,
  });
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
      if (!currentProfile) return;
      const selected = [...(currentProfile.selected ?? [])];

      const index = selected.findIndex((item) => item.name === group.name);

      if (index < 0) {
        selected.push({ name, now: unfixing ? undefined : proxy.name });
      } else {
        selected[index] = {
          name,
          now: unfixing ? undefined : proxy.name,
        };
      }
      await patchCurrentProfile({ selected });
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
        rowVirtualizer.scrollToIndex(index, {
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
    [renderList, rowVirtualizer],
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
        rowVirtualizer.scrollToIndex(index, {
          align: "center",
          behavior: "smooth",
        });
      }
    },
    [renderList, rowVirtualizer],
  );

  const renderProxyItem = useCallback(
    (item: IRenderItem, index: number, total: number) => (
      <div
        key={item.key}
        className={cn("py-1", {
          // "pt-2": index === 0,
          "pb-2": index === total - 1,
        })}>
        <ProxyRender
          key={item.key}
          item={item}
          delayVersion={groupDelayVersions[item.group.name] ?? 0}
          onLocation={handleLocation}
          onCheckAll={handleCheckAll}
          onChangeProxy={handleChangeProxy}
        />
      </div>
    ),
    [groupDelayVersions, handleChangeProxy, handleCheckAll, handleLocation],
  );

  const groupNameList = renderList
    .filter((item) => item.type === 0)
    .map((item) => item.key);
  const getVirtualOffset = useCallback(
    (index: number) =>
      rowVirtualizer.measurementsCache[index]?.start ??
      renderList
        .slice(0, index)
        .reduce(
          (total, item) =>
            total +
            (item.type === 0 ? ESTIMATED_GROUP_HEIGHT : ESTIMATED_ITEM_HEIGHT),
          0,
        ),
    [renderList, rowVirtualizer],
  );

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
        <Box ref={scrollParentRef} className="h-full overflow-auto">
          <Box
            sx={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}>
            <Box
              sx={{
                inset: 0,
                pointerEvents: "none",
                position: "absolute",
                zIndex: 10,
              }}>
              {groupSections.map(({ groupIndex, nextGroupIndex }) => {
                const group = renderList[groupIndex];
                const start = getVirtualOffset(groupIndex);
                const end =
                  nextGroupIndex < renderList.length
                    ? getVirtualOffset(nextGroupIndex)
                    : rowVirtualizer.getTotalSize();

                return (
                  <Box
                    key={group.key}
                    sx={{
                      height: Math.max(end - start, ESTIMATED_GROUP_HEIGHT),
                      left: 0,
                      position: "absolute",
                      top: start,
                      width: "100%",
                    }}>
                    <Box
                      ref={rowVirtualizer.measureElement}
                      data-index={groupIndex}
                      sx={(theme) => ({
                        background: "#ffffff",
                        ...theme.applyStyles("dark", {
                          background: "#282A36",
                        }),
                        pointerEvents: "auto",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                      })}>
                      {renderProxyItem(group, groupIndex, renderList.length)}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = renderList[virtualRow.index];
              if (item.type === 0) return null;

              return (
                <Box
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  sx={{
                    left: 0,
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    width: "100%",
                    zIndex: 1,
                  }}>
                  {renderProxyItem(item, virtualRow.index, renderList.length)}
                </Box>
              );
            })}
          </Box>
        </Box>
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
