import { useEffect, useMemo } from "react";
import { Proxy } from "tauri-plugin-mihomo-api";

import { useWindowSize } from "@/hooks/use-window-size";
import { useProxiesSWR } from "@/services/swr";
import { useProfilesStore, useVergeStore } from "@/stores";
import type { HeadState } from "@/stores/proxyHeadStateStore";
import {
  DEFAULT_STATE,
  useProxyHeadStateStore,
} from "@/stores/proxyHeadStateStore";

import { filterSort } from "./use-filter-sort";

const EMPTY_HEAD_STATES: Record<string, HeadState> = {};

export enum RenderType {
  GROUP_HEADER = 0,
  PROXY_ITEM = 1,
  EMPTY_MESSAGE = 2,
  PROXY_COL = 3,
}

export type IProxyGroupItem = Omit<Proxy, "all"> & {
  all: Proxy[];
};

export interface IRenderItem {
  // 组 ｜ item ｜ empty | item col
  type: RenderType;
  key: string;
  group: IProxyGroupItem;
  proxy?: Proxy;
  col?: number;
  proxyCol?: Proxy[];
  headState?: HeadState;
}

export const useRenderList = (mode: string) => {
  const { data: proxiesData, mutate: mutateProxies } = useProxiesSWR();

  const currentProfileUid = useProfilesStore((s) => s.currentProfile?.uid);
  const proxyLayoutColumn = useVergeStore(
    (s) => s.verge.proxy_layout_column || 6,
  );
  const { size } = useWindowSize();
  const headStates = useProxyHeadStateStore((state) =>
    currentProfileUid
      ? (state.headStates[currentProfileUid] ?? EMPTY_HEAD_STATES)
      : EMPTY_HEAD_STATES,
  );

  let col = proxyLayoutColumn;

  // 自适应
  if (col >= 6 || col <= 0) {
    if (size.width > 1450) col = 4;
    else if (size.width > 1024) col = 3;
    else if (size.width > 900) col = 2;
    else if (size.width >= 700) col = 2;
    else col = 1;
  }

  // make sure that fetch the proxies successfully
  useEffect(() => {
    if (!proxiesData) return;
    const { groups, proxies } = proxiesData;

    if (
      (mode === "rule" && !groups.length) ||
      (mode === "global" && proxies.length < 2)
    ) {
      setTimeout(() => mutateProxies(), 500);
    }
  }, [proxiesData, mode]);

  const renderList: IRenderItem[] = useMemo(() => {
    if (!proxiesData) return [];

    // global 模式下将 GLOBAL 代理组置为首位
    const isGlobalMode = mode === "global";
    const groups = proxiesData.groups.filter((group) => !group.hidden);
    const renderGroups = isGlobalMode
      ? [proxiesData.global, ...groups]
      : groups;

    const retList = renderGroups.flatMap((group) => {
      const headState = headStates[group.name] || DEFAULT_STATE;
      const ret: IRenderItem[] = [
        { type: RenderType.GROUP_HEADER, key: group.name, group, headState },
      ];

      if (headState?.open) {
        const proxies = filterSort(
          group.all,
          group.name,
          headState.filterText,
          headState.sortType,
        );

        if (!proxies.length) {
          ret.push({
            type: RenderType.EMPTY_MESSAGE,
            key: `empty-${group.name}`,
            group,
            headState,
          });
        }

        // 支持多列布局
        if (col > 1) {
          return ret.concat(
            groupList(proxies, col).map((proxyCol) => ({
              type: RenderType.PROXY_COL,
              key: `col-${group.name}-${proxyCol[0].name}`,
              group,
              headState,
              col,
              proxyCol,
            })),
          );
        }

        return ret.concat(
          proxies.map((proxy) => ({
            type: RenderType.PROXY_ITEM,
            key: `${group.name}-${proxy.name}`,
            group,
            proxy,
            headState,
          })),
        );
      }
      return ret;
    });

    return retList;
  }, [headStates, proxiesData, mode, col]);

  return {
    renderList,
    onProxies: mutateProxies,
  };
};

function groupList<T = any>(list: T[], size: number): T[][] {
  return list.reduce((p, n) => {
    if (!p.length) return [[n]];

    const i = p.length - 1;
    if (p[i].length < size) {
      p[i].push(n);
      return p;
    }

    p.push([n]);
    return p;
  }, [] as T[][]);
}
