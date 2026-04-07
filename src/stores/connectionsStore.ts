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
};

type ConnectionsActions = {
  setConnectionsLayout: (layout: ConnectionsLayout) => void;
  setOrderType: (orderType: ConnectionsOrderType) => void;
  setTabName: (tabName: ConnectionsTabName) => void;
};

export const useConnectionsStore = create<
  ConnectionsState & ConnectionsActions
>()(
  persist(
    immer((set) => ({
      layout: "table",
      curOrderOpt: "Default",
      tabName: "active",
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
    })),
    {
      name: "connections-settings",
      version: 1,
    },
  ),
);
