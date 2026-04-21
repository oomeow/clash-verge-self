import useSWR from "swr";

import { checkService } from "@/services/cmds";

export const useService = () => {
  const { data: serviceStatus, mutate: mutateCheckService } = useSWR<
    "active" | "installed" | "uninstall" | "unknown"
  >("checkService", checkService, {
    revalidateIfStale: false,
    shouldRetryOnError: false,
    focusThrottleInterval: 36e5, // 1 hour
    fallbackData: "uninstall",
  });

  return { serviceStatus, mutateCheckService };
};
