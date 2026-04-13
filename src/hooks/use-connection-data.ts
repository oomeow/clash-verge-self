import { useEffect, useRef } from "react";
import { mutate } from "swr";
import useSWRSubscription from "swr/subscription";
import { MihomoWebSocket } from "tauri-plugin-mihomo-api";
import { useRefreshConnectionDateStore } from "@/stores";

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

export const useConnectionData = () => {
  const date = useRefreshConnectionDateStore((s) => s.date);
  const refresh = useRefreshConnectionDateStore((s) => s.refresh);
  const subscriptKey = `getClashConnection-${date}`;

  const ws = useRef<MihomoWebSocket | null>(null);
  const wsFirstConnection = useRef<boolean>(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const response = useSWRSubscription<
    ConnectionMonitorData,
    any,
    string | null
  >(
    subscriptKey,
    (_key, { next }) => {
      const reconnect = async () => {
        await ws.current?.close();
        ws.current = null;
        timeoutRef.current = setTimeout(async () => await connect(), 500);
      };

      const connect = () =>
        MihomoWebSocket.connect_connections()
          .then((ws_) => {
            ws.current = ws_;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            ws_.addListener(async (msg) => {
              if (msg.type === "Text") {
                if (msg.data.startsWith("Websocket error")) {
                  next(msg.data);
                  await reconnect();
                } else {
                  const data = JSON.parse(msg.data) as IConnections;
                  next(null, (old = initConnData) => {
                    const oldActiveConns = old.activeConnections;
                    const oldClosedConns = old.closedConnections;
                    const oldActiveConnMap = new Map(
                      oldActiveConns.map((c, _i) => [c.id, c]),
                    );

                    const activeConnections = (data.connections || []).map(
                      (c) => {
                        const prev = oldActiveConnMap.get(c.id);
                        if (prev) {
                          c.curUpload = c.upload - prev.upload;
                          c.curDownload = c.download - prev.download;
                        } else {
                          c.curUpload = 0;
                          c.curDownload = 0;
                        }
                        return { ...c, closedTime: 0 } as IClosedConnectionItem;
                      },
                    );

                    const activeIds = new Set(
                      activeConnections.map((item) => item.id),
                    );
                    const closed = oldActiveConns
                      .filter((item) => !activeIds.has(item.id))
                      .map((item) => ({ ...item, closedTime: Date.now() }));
                    const closedConnections = [
                      ...oldClosedConns,
                      ...closed,
                    ].slice(-MAX_CLOSED_CONNS);

                    return {
                      uploadTotal: data.uploadTotal,
                      downloadTotal: data.downloadTotal,
                      activeConnections,
                      closedConnections,
                    };
                  });
                }
              }
            });
          })
          .catch((_) => {
            if (!ws.current) {
              timeoutRef.current = setTimeout(async () => await connect(), 500);
            }
          });

      if (
        wsFirstConnection.current ||
        (ws.current && !wsFirstConnection.current)
      ) {
        wsFirstConnection.current = false;
        if (ws.current) {
          ws.current.close();
          ws.current = null;
        }
        connect();
      }

      return () => {
        ws.current?.close();
      };
    },
    {
      fallbackData: initConnData,
      keepPreviousData: true,
    },
  );

  useEffect(() => {
    mutate(`$sub$${subscriptKey}`);
  }, [date, subscriptKey]);

  const refreshGetClashConnection = () => {
    refresh();
  };

  const clearClosedConnections = () => {
    mutate(`$sub$${subscriptKey}`, {
      uploadTotal: response.data?.uploadTotal ?? 0,
      downloadTotal: response.data?.downloadTotal ?? 0,
      activeConnections: response.data?.activeConnections ?? [],
      closedConnections: [],
    });
  };

  return { response, refreshGetClashConnection, clearClosedConnections };
};
