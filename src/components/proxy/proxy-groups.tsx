import { Box } from "@mui/material";
import { useLockFn, useMemoizedFn, useThrottleFn } from "ahooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  closeConnection,
  getConnections,
  Proxy,
  selectNodeForGroup,
  unfixedProxy,
} from "tauri-plugin-mihomo-api";

import { ProxyGroupSidebar } from "@/components/proxy/proxy-group-sidebar";
import { ProxyRender } from "@/components/proxy/proxy-render";
import LoadingPage from "@/pages/loading";
import delayManager from "@/services/delay";
import { useProfilesStore, useVergeStore } from "@/stores";
import { cn, findAndHighlightElement } from "@/utils";
import { groupId, proxyId } from "@/utils/proxyId";

import {
  BaseEmpty,
  StickyVirtualList,
  type StickyVirtualListHandle,
} from "../base";
import {
  IProxyGroupItem,
  type IRenderItem,
  useRenderList,
} from "./use-render-list";

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
  const groupNamesForDelayCheck = useMemo(
    () => Array.from(new Set([...groupNameList, "GLOBAL"])),
    [groupNameList],
  );

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
    useLockFn(async (group: IProxyGroupItem, proxy: Proxy) => {
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
      const nextProxyName = unfixing ? undefined : proxy.name;
      const selectedIndex = selected.findIndex(
        (item) => item.name === group.name,
      );

      if (selectedIndex < 0) {
        selected.push({ name, now: nextProxyName });
      } else {
        selected[selectedIndex] = { name, now: nextProxyName };
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
      const names = proxies
        .filter((p) => p.type !== "Direct")
        .map((p) => p.name);
      await delayManager.checkListDelay(names, groupName, timeout);
      onProxies();
    },
    { wait: 1000 },
  );

  // 滚到对应的分组
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
        await stickyListRef.current?.waitForScrollEnd();
        findAndHighlightElement(groupId(groupName));
      }
    },
    [renderList],
  );

  // 滚到对应的节点
  const handleLocation = useCallback(
    async (group: IProxyGroupItem) => {
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
        await stickyListRef.current?.waitForScrollEnd();
        findAndHighlightElement(proxyId(name, now!));
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

  const renderGroupItem = useCallback(
    (item: IRenderItem, _index: number, stickyed: boolean) => (
      <ProxyRender
        key={item.key}
        item={item}
        stickyed={stickyed}
        delayVersion={groupDelayVersions[item.group.name] ?? 0}
        onLocation={handleLocation}
        onCheckAll={handleCheckAll}
        onGroupToggle={handleGroupToggle}
        onChangeProxy={handleChangeProxy}
      />
    ),
    [
      groupDelayVersions,
      handleChangeProxy,
      handleCheckAll,
      handleGroupToggle,
      handleLocation,
    ],
  );

  const renderProxyItem = useCallback(
    (item: IRenderItem) => (
      <ProxyRender
        key={item.key}
        item={item}
        delayVersion={groupDelayVersions[item.group.name] ?? 0}
        onLocation={handleLocation}
        onCheckAll={handleCheckAll}
        onGroupToggle={handleGroupToggle}
        onChangeProxy={handleChangeProxy}
      />
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
          "pr-8": isRuleMode,
        })}>
        <StickyVirtualList
          ref={stickyListRef}
          className="h-full w-full"
          items={renderList}
          isGroupItem={(item) => item.type === 0}
          getItemKey={(item) => item.key}
          estimateGroupItemHeight={78}
          estimateItemHeight={64}
          renderGroupItem={renderGroupItem}
          renderItem={renderProxyItem}
        />
      </Box>

      {isRuleMode && (
        <div className="absolute top-0 right-0 bottom-0 z-10 mr-0 w-8 bg-transparent transition-all duration-100 hover:w-30">
          <ProxyGroupSidebar
            groupNameList={groupNameList}
            onGroupNameClick={(groupName) => {
              handleGroupLocation(groupName);
            }}
          />
        </div>
      )}
    </Box>
  );
};
