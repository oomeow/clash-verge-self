import dayjs from "dayjs";
import type { Log, LogLevel } from "tauri-plugin-mihomo-api";

import {
  ManagedMihomoWebSocket,
  subscribeManagedMihomoWebSocketText,
} from "@/services/managedMihomoWs";
import { mutate, swrSubscriptionKey, useSWRSubscription } from "@/services/swr";
import { useClashLogStore, useRefreshLogsDateStore } from "@/stores";

export type ILogItem = Log & {
  time?: string;
};

const MAX_LOG_NUM = 1000;

const filterLogsByLevel = (logs: ILogItem[], logLevel: LogLevel) => {
  switch (logLevel) {
    case "debug":
      return logs.filter((i) =>
        ["debug", "info", "warning", "error"].includes(i.type),
      );
    case "info":
      return logs.filter((i) => ["info", "warning", "error"].includes(i.type));
    case "warning":
      return logs.filter((i) => ["warning", "error"].includes(i.type));
    case "error":
      return logs.filter((i) => i.type === "error");
    case "silent":
      return [];
    default:
      return logs;
  }
};

const parseLogMessage = (text: string) => {
  const data = JSON.parse(text) as ILogItem | ILogItem[];
  const snapshot = Array.isArray(data);
  const logs = snapshot ? data : [data];
  const now = dayjs().format("MM-DD HH:mm:ss");

  return {
    logs: logs.map((log) => ({
      ...log,
      time: log.time ?? now,
    })),
    snapshot,
  };
};

export const useLogData = () => {
  const enableLog = useClashLogStore((s) => s.enable);
  const logLevel = useClashLogStore((s) => s.logLevel);

  const date = useRefreshLogsDateStore((s) => s.date);
  const refresh = useRefreshLogsDateStore((s) => s.refresh);
  const subscriptKey = enableLog ? `getClashLog-${logLevel}-${date}` : null;

  const response = useSWRSubscription<ILogItem[], any, string | null>(
    subscriptKey,
    (_key, { next }) => {
      let disposed = false;
      const buffer: ILogItem[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        if (disposed) return;
        if (buffer.length > 0) {
          next(null, (l) => {
            let newList = [...(l ?? []), ...buffer.splice(0)];
            if (newList.length > MAX_LOG_NUM) {
              newList = newList.slice(-Math.min(MAX_LOG_NUM, newList.length));
            }
            return newList;
          });
        }
        flushTimer = null;
      };

      const unsubscribe = subscribeManagedMihomoWebSocketText({
        connect: () => ManagedMihomoWebSocket.connectLogs(logLevel),
        onText: (text) => {
          const { logs, snapshot } = parseLogMessage(text);
          const filteredLogs = filterLogsByLevel(logs, logLevel);

          if (snapshot) {
            const nextLogs = [...filteredLogs, ...buffer.splice(0)].slice(
              -MAX_LOG_NUM,
            );
            if (flushTimer) clearTimeout(flushTimer);
            flushTimer = null;
            next(null, nextLogs);
            return;
          }

          buffer.push(...filteredLogs);

          if (!flushTimer) {
            flushTimer = setTimeout(flush, 50);
          }
        },
        onError: next,
      });

      return () => {
        disposed = true;
        if (flushTimer) clearTimeout(flushTimer);
        unsubscribe();
      };
    },
    {
      fallbackData: [],
      keepPreviousData: true,
    },
  );

  const refreshGetClashLog = (clear = false) => {
    if (clear) {
      mutate(swrSubscriptionKey(subscriptKey), []);
    } else {
      refresh();
    }
  };

  return { response, refreshGetClashLog };
};
