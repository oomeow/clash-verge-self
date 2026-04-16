import { GridSortItem } from "@mui/x-data-grid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConnectionsLayout = "table" | "list";

export type ConnectionsTabName = "active" | "closed";

export type ConnectionsOrderType =
  | "Default"
  | "Upload Speed"
  | "Download Speed";

type ConnectionsState = {
  layout: ConnectionsLayout;
  curOrderOpt: ConnectionsOrderType;
  // tabName: ConnectionsTabName;
  tabSortModel: GridSortItem[];
  tabColumnsWidths: Record<string, number>;
};

type ConnectionsActions = {
  setConnectionsLayout: (layout: ConnectionsLayout) => void;
  setOrderType: (orderType: ConnectionsOrderType) => void;
  // setTabName: (tabName: ConnectionsTabName) => void;
  setTabSortModel: (sortModel: GridSortItem[]) => void;
  setTabColumnWidth: (tabColumn: string, width: number) => void;
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
      setConnectionsLayout: (layout) => set({ layout }),
      setOrderType: (orderType) => set({ curOrderOpt: orderType }),
      // setTabName: (tabName) => set({ tabName }),
      setTabSortModel: (tabSortModel) => set({ tabSortModel }),
      setTabColumnWidth: (tabColumn, width) =>
        set((state) => ({
          tabColumnsWidths: { ...state.tabColumnsWidths, [tabColumn]: width },
        })),
    }),
    {
      name: "connections-settings",
      version: 1,
    },
  ),
);
