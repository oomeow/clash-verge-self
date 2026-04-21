import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { ProxySortType } from "@/components/proxy/use-filter-sort";

export interface HeadState {
  open: boolean;
  showType: boolean;
  sortType: ProxySortType;
  filterText: string;
  textState: "url" | "filter" | null;
  testUrl: string;
}

export const DEFAULT_STATE: HeadState = {
  open: false,
  showType: true,
  sortType: 0,
  filterText: "",
  textState: null,
  testUrl: "",
};

type ProxyHeadStateState = {
  headStates: Record<string, Record<string, HeadState>>;
};

type HeadStateScope = {
  current: string;
  groupName: string;
};

export type ScopedHeadStateActions = {
  setOpen: (open: boolean) => void;
  setShowType: (showType: boolean) => void;
  setSortType: (sortType: ProxySortType) => void;
  setFilterText: (filterText: string) => void;
  setTextState: (textState: "url" | "filter" | null) => void;
  setTestUrl: (testUrl: string) => void;
};

type ProxyHeadStateActions = {
  updateHeadState: (
    scope: HeadStateScope,
    updater: (headState: HeadState) => void,
  ) => void;
};

const ensureHeadState = (
  headStates: Record<string, Record<string, HeadState>>,
  current: string,
  groupName: string,
) => {
  headStates[current] ??= {};
  headStates[current][groupName] ??= { ...DEFAULT_STATE };
  return headStates[current][groupName];
};

export const useProxyHeadStateStore = create<
  ProxyHeadStateState & ProxyHeadStateActions
>()(
  persist(
    immer((set) => ({
      headStates: {},
      updateHeadState: (scope, updater) =>
        set((state) => {
          updater(
            ensureHeadState(state.headStates, scope.current, scope.groupName),
          );
        }),
    })),
    {
      name: "proxy-head-state",
      version: 1,
    },
  ),
);

export const createScopedHeadStateActions = (
  scope: HeadStateScope,
): ScopedHeadStateActions => ({
  setOpen: (open) => {
    useProxyHeadStateStore.getState().updateHeadState(scope, (headState) => {
      headState.open = open;
    });
  },
  setShowType: (showType) => {
    useProxyHeadStateStore.getState().updateHeadState(scope, (headState) => {
      headState.showType = showType;
    });
  },
  setSortType: (sortType) => {
    useProxyHeadStateStore.getState().updateHeadState(scope, (headState) => {
      headState.sortType = sortType;
    });
  },
  setFilterText: (filterText) => {
    useProxyHeadStateStore.getState().updateHeadState(scope, (headState) => {
      headState.filterText = filterText;
    });
  },
  setTextState: (textState) => {
    useProxyHeadStateStore.getState().updateHeadState(scope, (headState) => {
      headState.textState = textState;
    });
  },
  setTestUrl: (testUrl) => {
    useProxyHeadStateStore.getState().updateHeadState(scope, (headState) => {
      headState.testUrl = testUrl;
    });
  },
});
