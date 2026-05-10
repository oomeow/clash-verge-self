import type { Traffic } from "tauri-plugin-mihomo-api";

import {
  ManagedMihomoWebSocket,
  subscribeManagedMihomoWebSocketText,
} from "@/services/mihomo-websocket";
import { useSWRSubscription } from "@/services/swr";
import { useRefreshTrafficDateStore } from "@/stores";

export const useTrafficData = () => {
  const date = useRefreshTrafficDateStore((s) => s.date);
  const refresh = useRefreshTrafficDateStore((s) => s.refresh);
  const subscriptKey = `getClashTraffic-${date}`;

  const response = useSWRSubscription<Traffic, any, string | null>(
    subscriptKey,
    (_key, { next }) =>
      subscribeManagedMihomoWebSocketText({
        connect: ManagedMihomoWebSocket.connectTraffic,
        onText: (text) => next(null, JSON.parse(text) as Traffic),
        onError: (err) => next(err, { up: 0, down: 0 }),
      }),
    {
      fallbackData: { up: 0, down: 0 },
      keepPreviousData: true,
    },
  );

  return { response, refreshGetClashTraffic: refresh };
};
