import type { Traffic } from "tauri-plugin-mihomo-api";

import {
  ManagedMihomoWebSocket,
  subscribeManagedMihomoWebSocketText,
} from "@/services/managedMihomoWs";
import { useSWRSubscription } from "@/services/swr";

export const useTrafficData = () => {
  const subscriptKey = `getClashTraffic`;

  const response = useSWRSubscription<Traffic, any, string | null>(
    subscriptKey,
    (_key, { next }) =>
      subscribeManagedMihomoWebSocketText({
        connect: ManagedMihomoWebSocket.connectTraffic,
        onText: (text) => next(null, JSON.parse(text) as Traffic),
        onError: (err) =>
          next(err, { up: 0, down: 0, up_total: 0, down_total: 0 }),
      }),
    {
      fallbackData: { up: 0, down: 0, up_total: 0, down_total: 0 },
      keepPreviousData: true,
    },
  );

  return { response };
};
