import { useEffect, useRef } from "react";
import { MihomoWebSocket } from "tauri-plugin-mihomo-api";

import { mutate, swrSubscriptionKey, useSWRSubscription } from "@/services/swr";
import { useRefreshMemoryDateStore } from "@/stores";

export const useMemoryData = () => {
  const date = useRefreshMemoryDateStore((s) => s.date);
  const refresh = useRefreshMemoryDateStore((s) => s.refresh);
  const subscriptKey = `getClashMemory-${date}`;

  const ws = useRef<MihomoWebSocket | null>(null);
  const wsFirstConnection = useRef<boolean>(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const response = useSWRSubscription<IMemoryUsageItem, any, string | null>(
    subscriptKey,
    (_key, { next }) => {
      const reconnect = async () => {
        await ws.current?.close();
        ws.current = null;
        timeoutRef.current = setTimeout(async () => await connect(), 500);
      };

      const connect = () =>
        MihomoWebSocket.connect_memory()
          .then((ws_) => {
            ws.current = ws_;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            ws_.addListener(async (msg) => {
              if (msg.type === "Text") {
                if (msg.data.startsWith("Websocket error")) {
                  next(msg.data, { inuse: 0 });
                  await reconnect();
                } else {
                  const data = JSON.parse(msg.data) as IMemoryUsageItem;
                  next(null, data);
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
      fallbackData: { inuse: 0 },
      keepPreviousData: true,
    },
  );

  useEffect(() => {
    mutate(swrSubscriptionKey(subscriptKey));
  }, [date, subscriptKey]);

  const refreshGetClashMemory = () => {
    refresh();
  };

  return { response, refreshGetClashMemory };
};
