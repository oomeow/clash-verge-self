import type { Connection, Connections } from "tauri-plugin-mihomo-api";

import {
  ManagedMihomoWebSocket,
  subscribeManagedMihomoWebSocketText,
} from "@/services/managedMihomoWs";
import { mutate, swrSubscriptionKey, useSWRSubscription } from "@/services/swr";

export type IConnectionsItem = Connection & {
  curUpload?: number; // upload speed, calculate at runtime
  curDownload?: number; // download speed, calculate at runtime
};

export type IClosedConnectionItem = IConnectionsItem & {
  closedTime: number;
};

export interface ConnectionMonitorData {
  uploadTotal: number;
  downloadTotal: number;
  activeConnections: IClosedConnectionItem[];
  closedConnections: IClosedConnectionItem[];
}

export const initConnData: ConnectionMonitorData = {
  uploadTotal: 0,
  downloadTotal: 0,
  activeConnections: [],
  closedConnections: [],
};

const MAX_CLOSED_CONNS = 500;

const updateConnections = (
  data: Connections,
  old: ConnectionMonitorData = initConnData,
): ConnectionMonitorData => {
  const oldActiveConns = old.activeConnections;
  const oldClosedConns = old.closedConnections;
  const oldActiveConnMap = new Map(oldActiveConns.map((c) => [c.id, c]));

  const activeConnections = (
    (data.connections as IConnectionsItem[]) || []
  ).map((c) => {
    const prev = oldActiveConnMap.get(c.id);
    const curUpload = prev ? c.upload - prev.upload : 0;
    const curDownload = prev ? c.download - prev.download : 0;
    return {
      ...c,
      curUpload,
      curDownload,
      closedTime: 0,
    } as IClosedConnectionItem;
  });

  const activeIds = new Set(activeConnections.map((item) => item.id));
  const closed = oldActiveConns
    .filter((item) => !activeIds.has(item.id))
    .map((item) => ({ ...item, closedTime: Date.now() }));
  const closedConnections = [...oldClosedConns, ...closed].slice(
    -MAX_CLOSED_CONNS,
  );

  return {
    uploadTotal: data.uploadTotal,
    downloadTotal: data.downloadTotal,
    activeConnections,
    closedConnections,
  };
};

export const useConnectionData = () => {
  const subscriptKey = `getClashConnection`;

  const response = useSWRSubscription<
    ConnectionMonitorData,
    any,
    string | null
  >(
    subscriptKey,
    (_key, { next }) =>
      subscribeManagedMihomoWebSocketText({
        connect: ManagedMihomoWebSocket.connectConnections,
        onText: (text) =>
          next(null, (old = initConnData) =>
            updateConnections(JSON.parse(text) as Connections, old),
          ),
        onError: next,
      }),
    {
      fallbackData: initConnData,
      keepPreviousData: true,
    },
  );

  const clearClosedConnections = () => {
    const current = response.data ?? initConnData;
    mutate(swrSubscriptionKey(subscriptKey), {
      ...current,
      closedConnections: [],
    });
  };

  return {
    response,
    clearClosedConnections,
  };
};
