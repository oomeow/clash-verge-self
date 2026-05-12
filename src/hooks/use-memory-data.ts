import type { Memory } from "tauri-plugin-mihomo-api";

import {
  ManagedMihomoWebSocket,
  subscribeManagedMihomoWebSocketText,
} from "@/services/managedMihomoWs";
import { useSWRSubscription } from "@/services/swr";

export const useMemoryData = () => {
  const subscriptKey = `getClashMemory`;

  const response = useSWRSubscription<Memory, any, string | null>(
    subscriptKey,
    (_key, { next }) =>
      subscribeManagedMihomoWebSocketText({
        connect: ManagedMihomoWebSocket.connectMemory,
        onText: (text) => {
          try {
            next(null, JSON.parse(text) as Memory);
          } catch (e) {
            next(e, { inuse: 0 } as Memory);
          }
        },
        onError: (err) => next(err, { inuse: 0 } as Memory),
      }),
    {
      fallbackData: { inuse: 0 },
      keepPreviousData: true,
    },
  );

  return { response };
};
