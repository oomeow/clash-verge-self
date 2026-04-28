import { check } from "@tauri-apps/plugin-updater";
import useBaseSWR, { mutate, SWRConfig, type SWRConfiguration } from "swr";
import useBaseSWRSubscription from "swr/subscription";

import { calcuProxies, calcuProxyProviders } from "@/services/api";
import { checkService, getClashInfo, getRuntimeConfig } from "@/services/cmds";

export { mutate, SWRConfig };
export const useSWR = useBaseSWR;
export const useSWRSubscription = useBaseSWRSubscription;

export const swrKeys = {
  checkService: "checkService",
  checkUpdate: "checkUpdate",
  clashInfo: "getClashInfo",
  mihomoCoresInfo: "getMihomoCoresInfo",
  proxies: "getProxies",
  proxyProviders: "getProxyProviders",
  runtimeConfig: "getRuntimeConfig",
} as const;

export const appSWRConfig: SWRConfiguration = {
  errorRetryCount: 10,
  errorRetryInterval: 1000,
  revalidateOnFocus: true,
  revalidateOnMount: true,
};

export const updateSWRConfig: SWRConfiguration = {
  errorRetryCount: 2,
  revalidateIfStale: false,
  focusThrottleInterval: 36e5, // 1 hour
};

export const swrSubscriptionKey = (key: string | null) => `$sub$${key}`;

export const refreshClashSWR = () => {
  mutate(swrKeys.proxies);
  mutate(swrKeys.clashInfo);
  mutate(swrKeys.runtimeConfig);
  mutate(swrKeys.proxyProviders);
};

export const useRuntimeConfigSWR = () =>
  useSWR(swrKeys.runtimeConfig, getRuntimeConfig);

export const useClashInfoSWR = () => useSWR(swrKeys.clashInfo, getClashInfo);

export const useProxiesSWR = () =>
  useSWR(swrKeys.proxies, calcuProxies, { refreshInterval: 45000 });

export const useProxyProvidersSWR = () =>
  useSWR(swrKeys.proxyProviders, calcuProxyProviders);

export const useCheckUpdateSWR = (enabled = true) =>
  useSWR(enabled ? swrKeys.checkUpdate : null, check, updateSWRConfig);

export const useServiceStatusSWR = () =>
  useSWR<"active" | "installed" | "uninstall" | "unknown">(
    swrKeys.checkService,
    checkService,
    {
      revalidateIfStale: false,
      shouldRetryOnError: false,
      focusThrottleInterval: 36e5, // 1 hour
      fallbackData: "uninstall",
    },
  );
