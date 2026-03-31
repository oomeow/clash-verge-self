import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { LogLevel } from "tauri-plugin-mihomo-api";

interface IClashLog {
  enable: boolean;
  logLevel: LogLevel;
  logFilter: "all" | "inf" | "warn" | "err";
}

const defaultClashLog: IClashLog = {
  enable: true,
  logLevel: "info",
  logFilter: "all",
};

interface ClashLogState {
  clashLog: IClashLog;
  setClashLog: (next: IClashLog) => void;
}

export const useClashLogStore = create<ClashLogState>()(
  devtools(
    persist(
      immer((set) => ({
        clashLog: defaultClashLog,
        setClashLog: (next) =>
          set(
            (state) => {
              state.clashLog = next;
            },
            false,
            "clashLog/setClashLog",
          ),
      })),
      {
        name: "clash-log",
        version: 1,
        partialize: (state) => ({ clashLog: state.clashLog }),
      },
    ),
    { name: "clashLogStore" },
  ),
);
