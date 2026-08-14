import { Update } from "@tauri-apps/plugin-updater";
import useBaseSWR, { mutate, SWRConfig, type SWRConfiguration } from "swr";
import useBaseSWRSubscription from "swr/subscription";

import { calcuProxies, calcuProxyProviders } from "@/services/api";
import {
  checkService,
  checkUpdate,
  getClashInfo,
  getMihomoVersions,
  getRuntimeConfig,
  listMihomoDownloads,
} from "@/services/cmds";

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
  mihomoVersions: "getMihomoVersions",
  mihomoDownloads: "listMihomoDownloads",
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

export const swrSubscriptionKey = (key: string | null) =>
  key ? `$sub$${key}` : null;

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

let requestSeq = 0;
let committedUpdate: Update | null = null;

/// 关闭 Update 资源，失败时记录日志（模块内无 notice 上下文）
const closeUpdate = (update: Update) => {
  update.close().catch((err: unknown) => {
    console.error("[updater] failed to close update", err);
  });
};

/// 检查更新并管理资源生命周期：
/// - 过期响应只释放自己的实例，返回当前已提交的实例，不覆盖缓存
/// - 新结果通过 SWR onSuccess（缓存提交后）才释放上一个实例，
///   此时 viewer / 更新按钮已切换到新数据，旧实例不再被引用
const checkUpdateWithLifecycle = async () => {
  const seq = ++requestSeq;
  const update = await checkUpdate();
  if (seq !== requestSeq) {
    if (update) {
      closeUpdate(update);
    }
    return committedUpdate;
  }
  return update;
};

/// 将手动检查的结果同步进 SWR 缓存并接管其资源生命周期
export const syncCheckUpdateCache = async (update: Update | null) => {
  if (update !== committedUpdate) {
    if (committedUpdate) {
      closeUpdate(committedUpdate);
    }
    committedUpdate = update;
  }
  await mutate(swrKeys.checkUpdate, update, { revalidate: false });
};

export const useCheckUpdateSWR = (enabled = true) =>
  useSWR(enabled ? swrKeys.checkUpdate : null, checkUpdateWithLifecycle, {
    ...updateSWRConfig,
    onSuccess: (data: Update | null) => {
      if (data !== committedUpdate) {
        if (committedUpdate) {
          closeUpdate(committedUpdate);
        }
        committedUpdate = data ?? null;
      }
    },
  });

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

export const useMihomoVersionsSWR = () =>
  useSWR(swrKeys.mihomoVersions, getMihomoVersions, { fallbackData: [] });

export const useMihomoDownloadsSWR = () =>
  useSWR(swrKeys.mihomoDownloads, listMihomoDownloads, { fallbackData: [] });
