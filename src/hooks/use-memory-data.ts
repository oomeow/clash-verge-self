import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import useSWRSubscription from "swr/subscription";
import { MihomoWebSocket } from "tauri-plugin-mihomo-api";
import { useVerge } from "./use-verge";
import { listen } from "@tauri-apps/api/event";

export const useMemoryData = () => {
  const [count, setCount] = useState(0);
  const subscriptKey = `getClashMemory-${count}`;

  const ws = useRef<MihomoWebSocket | null>(null);
  const ws_first_connection = useRef<boolean>(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const response = useSWRSubscription<IMemoryUsageItem, any, string | null>(
    subscriptKey,
    (_key, { next }) => {
      const connect = () =>
        MihomoWebSocket.connect_memory()
          .then((ws_) => {
            ws.current = ws_;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            ws_.addListener((msg) => {
              if (msg.type === "Text") {
                if (msg.data.startsWith("websocket error")) {
                  next(msg, { inuse: 0 });
                } else {
                  const data = JSON.parse(msg.data) as IMemoryUsageItem;
                  next(null, data);
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
      fallbackData: { inuse: 0 },
      keepPreviousData: true,
    },
  );

  useEffect(() => {
    const unlistenRefreshWebsocket = listen("verge://refresh-websocket", () => {
      setCount((prev) => (prev += 1));
      // mutate(`$sub$${subscriptKey}`);
    });

    return () => {
      unlistenRefreshWebsocket.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    mutate(`$sub$${subscriptKey}`);
  }, [count]);

  const refreshGetClashMemory = () => {
    setCount((prev) => (prev += 1));
  };

  return { response, refreshGetClashMemory };
};
