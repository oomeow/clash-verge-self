import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConnectionsLayout = "table" | "list";

export type ConnectionsTabName = "active" | "closed";

export type ConnectionsOrderType =
  "Default" | "Upload Speed" | "Download Speed";

export type ConnectionSortItem = {
  id: string;
  desc: boolean;
};

type ConnectionsState = {
  layout: ConnectionsLayout;
  curOrderOpt: ConnectionsOrderType;
  // tabName: ConnectionsTabName;
  tabSortModel: ConnectionSortItem[];
  tabColumnsWidths: Record<string, number>;
  tabColumnOrder: string[];
  tabColumnsVisibility: Record<string, boolean>;
};

type ConnectionsActions = {
  setConnectionsLayout: (layout: ConnectionsLayout) => void;
  setOrderType: (orderType: ConnectionsOrderType) => void;
  // setTabName: (tabName: ConnectionsTabName) => void;
  setTabSortModel: (sortModel: ConnectionSortItem[]) => void;
  setTabColumnWidth: (tabColumn: string, width: number) => void;
  setTabColumnOrder: (columnOrder: string[]) => void;
  setTabColumnsVisibility: (visibility: Record<string, boolean>) => void;
};

export const useConnectionsStore = create<
  ConnectionsState & ConnectionsActions
>()(
  persist(
    (set) => ({
      layout: "table",
      curOrderOpt: "Default",
      // tabName: "active",
      tabSortModel: [],
      tabColumnsWidths: {},
      tabColumnOrder: [],
      tabColumnsVisibility: {},
      setConnectionsLayout: (layout) => set({ layout }),
      setOrderType: (orderType) => set({ curOrderOpt: orderType }),
      // setTabName: (tabName) => set({ tabName }),
      setTabSortModel: (tabSortModel) => set({ tabSortModel }),
      setTabColumnWidth: (tabColumn, width) =>
        set((state) => ({
          tabColumnsWidths: { ...state.tabColumnsWidths, [tabColumn]: width },
        })),
      setTabColumnOrder: (tabColumnOrder) => set({ tabColumnOrder }),
      setTabColumnsVisibility: (tabColumnsVisibility) =>
        set({ tabColumnsVisibility }),
    }),
    {
      name: "connections-settings",
      version: 1,
    },
  ),
);
