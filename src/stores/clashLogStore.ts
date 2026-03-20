import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyUpdater, type Updater } from "./utils";

interface IClashLog {
  enable: boolean;
  logLevel: "debug" | "info" | "warning" | "error" | "silent";
  logFilter: "all" | "inf" | "warn" | "err";
}

const defaultClashLog: IClashLog = {
  enable: true,
  logLevel: "info",
  logFilter: "all",
};

interface ClashLogState {
  clashLog: IClashLog;
  setClashLog: (next: Updater<IClashLog>) => void;
}

export const useClashLogStore = create<ClashLogState>()(
  persist(
    (set) => ({
      clashLog: defaultClashLog,
      setClashLog: (next) =>
        set((state) => ({
          clashLog: applyUpdater(next, state.clashLog),
        })),
    }),
    {
      name: "clash-log",
      version: 1,
      partialize: (state) => ({ clashLog: state.clashLog }),
    },
  ),
);

export const useClashLog = () => {
  const clashLog = useClashLogStore((s) => s.clashLog);
  const setClashLog = useClashLogStore((s) => s.setClashLog);
  return [clashLog, setClashLog] as const;
};
