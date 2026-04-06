import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { ProxySortType } from "@/components/proxy/use-filter-sort";

export interface HeadState {
  open?: boolean;
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

type ProxyHeadStateActions = {
  setOpen: (current: string, groupName: string, open?: boolean) => void;
  setShowType: (current: string, groupName: string, showType: boolean) => void;
  setSortType: (
    current: string,
    groupName: string,
    sortType: ProxySortType,
  ) => void;
  setFilterText: (
    current: string,
    groupName: string,
    filterText: string,
  ) => void;
  setTextState: (
    current: string,
    groupName: string,
    textState: "url" | "filter" | null,
  ) => void;
  setTestUrl: (current: string, groupName: string, testUrl: string) => void;
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
      setOpen: (current, groupName, open) =>
        set((state) => {
          ensureHeadState(state.headStates, current, groupName).open = open;
        }),
      setShowType: (current, groupName, showType) =>
        set((state) => {
          ensureHeadState(state.headStates, current, groupName).showType =
            showType;
        }),
      setSortType: (current, groupName, sortType) =>
        set((state) => {
          ensureHeadState(state.headStates, current, groupName).sortType =
            sortType;
        }),
      setFilterText: (current, groupName, filterText) =>
        set((state) => {
          ensureHeadState(state.headStates, current, groupName).filterText =
            filterText;
        }),
      setTextState: (current, groupName, textState) =>
        set((state) => {
          ensureHeadState(state.headStates, current, groupName).textState =
            textState;
        }),
      setTestUrl: (current, groupName, testUrl) =>
        set((state) => {
          ensureHeadState(state.headStates, current, groupName).testUrl =
            testUrl;
        }),
    })),
    {
      name: "proxy-head-state",
      version: 2,
    },
  ),
);
