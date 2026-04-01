import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { LogLevel } from "tauri-plugin-mihomo-api";

export type LogFilter = "all" | "inf" | "warn" | "err";

type State = {
  enable: boolean;
  logLevel: LogLevel;
  logFilter: LogFilter;
};

type Actions = {
  toggle: () => void;
  setLogLevel: (level: LogLevel) => void;
  setLogFilter: (filter: LogFilter) => void;
};

export const useClashLogStore = create<State & Actions>()(
  devtools(
    persist(
      immer((set) => ({
        enable: true,
        logLevel: "info",
        logFilter: "all",
        toggle: () => set((state) => (state.enable = !state.enable)),
        setLogLevel: (level) =>
          set((state) => {
            state.logLevel = level;
          }),
        setLogFilter: (filter) =>
          set((state) => {
            state.logFilter = filter;
          }),
      })),
      {
        name: "clash-log",
        version: 1,
      },
    ),
    { name: "clashLogStore" },
  ),
);
