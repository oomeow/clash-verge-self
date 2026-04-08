import { useEffect, useRef } from "react";
import { mutate } from "swr";
import useSWRSubscription from "swr/subscription";
import { MihomoWebSocket } from "tauri-plugin-mihomo-api";
import { useRefreshConnectionDateStore } from "@/stores";

export interface ConnectionMonitorData {
  uploadTotal: number;
  downloadTotal: number;
  activeConnections: IConnectionsItem[];
  closedConnections: IConnectionsItem[];
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
                    const oldConn = old.activeConnections;
                    const oldClosedConnections = old.closedConnections;

                    const maxLen = data.connections?.length;
                    const activeConnections: IConnectionsItem[] = [];
                    const rest = (data.connections || []).filter((each) => {
                      const index = oldConn.findIndex((o) => o.id === each.id);
                      if (index >= 0 && index < maxLen) {
                        const old = oldConn[index];
                        each.curUpload = each.upload - old.upload;
                        each.curDownload = each.download - old.download;
                        activeConnections[index] = each;
                        return false;
                      }
                      return true;
                    });
                    for (let i = 0; i < maxLen; ++i) {
                      if (!activeConnections[i] && rest.length > 0) {
                        activeConnections[i] = rest.shift()!;
                        activeConnections[i].curUpload = 0;
                        activeConnections[i].curDownload = 0;
                      }
                    }

                    const ids = activeConnections.map((item) => item.id);
                    const closed = oldConn.filter(
                      (item) => !ids.includes(item.id),
                    );
                    const closedConnections = [
                      ...oldClosedConnections,
                      ...closed,
                    ];
                    closedConnections.length > MAX_CLOSED_CONNS
                      ? closedConnections.slice(-MAX_CLOSED_CONNS)
                      : closedConnections;

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
