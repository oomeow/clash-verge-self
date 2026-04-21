import { LogLevel } from "tauri-plugin-mihomo-api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      toggleEnable: () => set((state) => ({ enable: !state.enable })),
      setLogLevel: (level) => set({ logLevel: level }),
      setLogFilter: (filter) => set({ logFilter: filter }),
    }),
    {
      name: "clash-log",
      version: 1,
    },
  ),
);
