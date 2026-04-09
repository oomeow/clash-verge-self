import { create } from "zustand";
import { persist } from "zustand/middleware";

import { LogLevel } from "tauri-plugin-mihomo-api";

export type LogFilter = "all" | "inf" | "warn" | "err";

type State = {
  enable: boolean;
  logLevel: LogLevel;
  logFilter: LogFilter;
};

type Actions = {
  toggleEnable: () => void;
  setLogLevel: (level: LogLevel) => void;
  setLogFilter: (filter: LogFilter) => void;
};

export const useClashLogStore = create<State & Actions>()(
  persist(
    (set) => ({
      enable: true,
      logLevel: "info",
      logFilter: "all",
      toggleEnable: () =>
        set((state) => {
          return { ...state, enable: !state.enable };
        }),
      setLogLevel: (level) =>
        set((state) => {
          return { ...state, logLevel: level };
        }),
      setLogFilter: (filter) =>
        set((state) => {
          return { ...state, logFilter: filter };
        }),
    }),
    {
      name: "clash-log",
      version: 1,
    },
  ),
);
