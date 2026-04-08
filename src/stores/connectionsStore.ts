import { GridSortItem, GridSortModel } from "@mui/x-data-grid";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type ConnectionsLayout = "table" | "list";

export type ConnectionsTabName = "active" | "closed";

export type ConnectionsOrderType =
  | "Default"
  | "Upload Speed"
  | "Download Speed";

type ConnectionsState = {
  layout: ConnectionsLayout;
  curOrderOpt: ConnectionsOrderType;
  tabName: ConnectionsTabName;
  tabSortModel: GridSortItem[];
  tabColumnsWidths: Record<string, number>;
};

type ConnectionsActions = {
  setConnectionsLayout: (layout: ConnectionsLayout) => void;
  setOrderType: (orderType: ConnectionsOrderType) => void;
  setTabName: (tabName: ConnectionsTabName) => void;
  setTabSortModel: (sortModel: GridSortItem[]) => void;
  setTabColumnWidth: (tabColumn: string, width: number) => void;
};

export const useConnectionsStore = create<
  ConnectionsState & ConnectionsActions
>()(
  persist(
    immer((set) => ({
      layout: "table",
      curOrderOpt: "Default",
      tabName: "active",
      tabSortModel: [],
      tabColumnsWidths: {},
      setConnectionsLayout: (layout) =>
        set((state) => {
          state.layout = layout;
        }),
      setOrderType: (orderType) =>
        set((state) => {
          state.curOrderOpt = orderType;
        }),
      setTabName: (tabName) =>
        set((state) => {
          state.tabName = tabName;
        }),
      setTabSortModel: (sortModel) =>
        set((state) => {
          state.tabSortModel = sortModel;
        }),
      setTabColumnWidth: (tabColumn, width) =>
        set((state) => {
          state.tabColumnsWidths[tabColumn] = width;
        }),
    })),
    {
      name: "connections-settings",
      version: 1,
    },
  ),
);
