import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import useSWRSubscription from "swr/subscription";
import { MihomoWebSocket } from "tauri-plugin-mihomo-api";
import { useVerge } from "./use-verge";
import { listen } from "@tauri-apps/api/event";

const initData: IConnections = {
  uploadTotal: 0,
  downloadTotal: 0,
  connections: [],
};

export const useConnectionData = () => {
  const [count, setCount] = useState(0);
  const subscriptKey = `getClashConnection-${count}`;

  const ws = useRef<MihomoWebSocket | null>(null);
  const ws_first_connection = useRef<boolean>(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const response = useSWRSubscription<IConnections, any, string | null>(
    subscriptKey,
    (_key, { next }) => {
      const connect = () =>
        MihomoWebSocket.connect_connections()
          .then((ws_) => {
            ws.current = ws_;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            ws_.addListener((msg) => {
              if (msg.type === "Text") {
                if (msg.data.startsWith("websocket error")) {
                  next(null);
                } else {
                  const data = JSON.parse(msg.data) as IConnections;
                  next(null, (old = initData) => {
                    const oldConn = old.connections;
                    const maxLen = data.connections?.length;
                    const connections: IConnectionsItem[] = [];
                    const rest = (data.connections || []).filter((each) => {
                      const index = oldConn.findIndex((o) => o.id === each.id);
                      if (index >= 0 && index < maxLen) {
                        const old = oldConn[index];
                        each.curUpload = each.upload - old.upload;
                        each.curDownload = each.download - old.download;
                        connections[index] = each;
                        return false;
                      }
                      return true;
                    });
                    for (let i = 0; i < maxLen; ++i) {
                      if (!connections[i] && rest.length > 0) {
                        connections[i] = rest.shift()!;
                        connections[i].curUpload = 0;
                        connections[i].curDownload = 0;
                      }
                    }
                    return { ...data, connections };
                  });
                }
              }
            });
          })
          .catch((e) => {
            timeoutRef.current = setTimeout(() => connect(), 1000);
          });

      if (
        ws_first_connection.current ||
        (ws.current && !ws_first_connection.current)
      ) {
        ws_first_connection.current = false;
        connect();
      }

      return () => {
        ws.current?.close(0);
      };
    },
    {
      fallbackData: [],
      keepPreviousData: true,
    },
  );

  useEffect(() => {
    const unlistenRefreshWebsocket = listen("verge://refresh-websocket", () => {
      setCount((prev) => (prev += 1));
    });

    return () => {
      unlistenRefreshWebsocket.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    mutate(`$sub$${subscriptKey}`);
  }, [count]);

  const refreshGetClashConnection = () => {
    setCount((prev) => (prev += 1));
  };

  return { response, refreshGetClashConnection };
};
