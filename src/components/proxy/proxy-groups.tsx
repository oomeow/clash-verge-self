import { Box } from "@mui/material";
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

import {
  BaseEmpty,
  StickyVirtualList,
  type StickyVirtualListHandle,
} from "../base";
import { type IRenderItem, useRenderList } from "./use-render-list";

interface Props {
  mode: string;
}

/// 固定的组高度，用于手动计算组高度偏移量
export const FIXED_GROUP_HEIGHT = 76;
/// 预估的项高度，用于 tanstack/react-virtual 动态计算高度
const ESTIMATED_PROXY_ITEM_HEIGHT = 64;

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

  const stickyListRef = useRef<StickyVirtualListHandle>(null);
  const [groupDelayVersions, setGroupDelayVersions] = useState<
    Record<string, number>
  >({});

  const groupNameList = useMemo(
    () => renderList.filter((item) => item.type === 0).map((item) => item.key),
    [renderList],
  );
  const groupNamesForDelayCheck = useMemo(() => {
    return Array.from(
      new Set(
        renderList
          .filter((item) => item.type === 0)
          .map((item) => item.group.name)
          .concat(["GLOBAL"]),
      ),
    );
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
        stickyListRef.current?.scrollToIndex(index, {
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
    [renderList],
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
        stickyListRef.current?.scrollToIndex(index, {
          align: "center",
          behavior: "smooth",
        });
      }
    },
    [renderList],
  );

  const handleGroupToggle = useCallback(
    async (group: IProxyGroupItem) => {
      const index = renderList.findIndex(
        (item) => item.type === 0 && item.group.name === group.name,
      );
      if (index < 0) return;

      if (!stickyListRef.current?.isItemScrolledPastStart(index, 1)) return;

      stickyListRef.current.scrollToIndex(index, {
        align: "start",
        behavior: "auto",
      });

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    },
    [renderList],
  );

  const renderProxyItem = useCallback(
    (item: IRenderItem) => (
      <div
        key={item.key}
        className={cn("pb-2", {
          "py-0": item.type === 0,
        })}>
        <ProxyRender
          key={item.key}
          item={item}
          delayVersion={groupDelayVersions[item.group.name] ?? 0}
          onLocation={handleLocation}
          onCheckAll={handleCheckAll}
          onGroupToggle={handleGroupToggle}
          onChangeProxy={handleChangeProxy}
        />
      </div>
    ),
    [
      groupDelayVersions,
      handleChangeProxy,
      handleCheckAll,
      handleGroupToggle,
      handleLocation,
    ],
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
        <StickyVirtualList
          ref={stickyListRef}
          className="h-full overflow-auto"
          items={renderList}
          isGroupItem={(item) => item.type === 0}
          getItemKey={(item) => item.key}
          estimateItemSize={(item) =>
            item.type === 0 ? FIXED_GROUP_HEIGHT : ESTIMATED_PROXY_ITEM_HEIGHT
          }
          groupItemSize={FIXED_GROUP_HEIGHT}
          stickyHeaderSx={(theme) => ({
            background: "#ffffff",
            ...theme.applyStyles("dark", {
              background: "#282A36",
            }),
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          })}
          renderItem={renderProxyItem}
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
