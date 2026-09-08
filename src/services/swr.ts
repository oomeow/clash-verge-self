import type { Update } from "@tauri-apps/plugin-updater";
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

/// 开始一次更新检查（SWR 自动检查与手动检查共用同一请求序列）
const beginCheck = () => ++requestSeq;

/// 请求是否仍是最新；过期响应只能释放自己的实例，不能覆盖已提交结果
const isLatestCheck = (seq: number) => seq === requestSeq;

/// 替换当前已提交的 Update 资源（先关闭旧的，避免 resources_table 持续增长）
const replaceCommittedUpdate = (update: Update | null) => {
  if (update !== committedUpdate) {
    if (committedUpdate) {
      closeUpdate(committedUpdate);
    }
    committedUpdate = update;
  }
};

/// SWR 检查：校验序列后返回结果，由 SWR 提交缓存，onSuccess 中做提交登记
const checkUpdateWithLifecycle = async () => {
  const seq = beginCheck();
  const update = await checkUpdate();
  if (!isLatestCheck(seq)) {
    if (update) {
      closeUpdate(update);
    }
    return committedUpdate;
  }
  return update;
};

/// 手动检查：与 SWR 检查共用请求序列，校验通过后提交到 SWR 缓存
export const checkUpdateNow = async () => {
  const seq = beginCheck();
  const update = await checkUpdate();
  if (!isLatestCheck(seq)) {
    if (update) {
      closeUpdate(update);
    }
    return committedUpdate;
  }
  replaceCommittedUpdate(update);
  await mutate(swrKeys.checkUpdate, update, { revalidate: false });
  return update;
};

/// 取消更新检查缓存（切换更新渠道时调用）：使进行中的检查过期、
/// 释放已提交的 Update 资源，并清空 SWR 缓存，避免旧渠道的检查结果残留
export const clearUpdateCache = () => {
  beginCheck();
  replaceCommittedUpdate(null);
  mutate(swrKeys.checkUpdate, undefined, { revalidate: false });
};

export const useCheckUpdateSWR = (enabled = true) =>
  useSWR(enabled ? swrKeys.checkUpdate : null, checkUpdateWithLifecycle, {
    ...updateSWRConfig,
    onSuccess: (data: Update | null) => {
      replaceCommittedUpdate(data);
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
