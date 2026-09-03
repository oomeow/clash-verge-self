import { Channel, invoke } from "@tauri-apps/api/core";

import type {
  BaseConfig,
  Connections,
  CoreUpdaterChannel,
  Groups,
  LogLevel,
  MihomoVersion,
  Proxies,
  ProxyDelay,
  ProxyInfo,
  ProxyProvider,
  ProxyProviders,
  RuleProviders,
  Rules,
} from "./bindings";

export * from "./bindings";
export type MihomoGroupDelay = Record<string, number>;

// ======================= functions =======================

/**
 * 更新控制器地址
 * @param controller 控制器地址, 例如：127.0.0.1:9090
 */
export async function updateController(controller: string): Promise<void> {
  const [host, portStr] = controller.trim().split(":");
  const port = parseInt(portStr, 10);
  await invoke<void>("plugin:mihomo|update_controller", { host, port });
}

/**
 * 更新控制器的密钥
 * @param secret 控制器的密钥
 */
export async function updateSecret(secret: string): Promise<void> {
  await invoke<void>("plugin:mihomo|update_secret", { secret });
}

/**
 * 获取 Mihomo 版本信息
 */
export async function getVersion(): Promise<MihomoVersion> {
  return await invoke<MihomoVersion>("plugin:mihomo|get_version");
}

/**
 * 清除 FakeIP 缓存
 */
export async function flushFakeIp(): Promise<void> {
  await invoke<void>("plugin:mihomo|flush_fakeip");
}

/**
 * 清除 DNS 缓存
 */
export async function flushDNS(): Promise<void> {
  await invoke<void>("plugin:mihomo|flush_dns");
}

// connections
/**
 * 获取所有连接信息
 * @returns 所有连接信息
 */
export async function getConnections(): Promise<Connections> {
  return await invoke<Connections>("plugin:mihomo|get_connections");
}

/**
 * 关闭所有连接
 */
export async function closeAllConnections(): Promise<void> {
  await invoke<void>("plugin:mihomo|close_all_connections");
}

/**
 * 关闭指定连接
 * @param connectionId 连接 ID
 */
export async function closeConnection(connectionId: string): Promise<void> {
  await invoke<void>("plugin:mihomo|close_connection", { connectionId });
}

// groups
/**
 * 获取所有代理组信息
 * @returns 所有代理组信息
 */
export async function getGroups(): Promise<Groups> {
  return await invoke<Groups>("plugin:mihomo|get_groups");
}

/**
 * 获取指定代理组信息
 * @param groupName 代理组名称
 * @returns 指定代理组信息
 */
export async function getGroupByName(groupName: string): Promise<ProxyInfo> {
  return await invoke<ProxyInfo>("plugin:mihomo|get_group_by_name", {
    groupName,
  });
}

/**
 * 对指定代理组进行延迟测试
 *
 * 注：返回值中不包含超时的节点
 * @param groupName 代理组名称
 * @param testUrl 测试 url
 * @param timeout 超时时间（毫秒）
 * @param keepFixed 是否保留已固定的节点, 默认 false
 * @returns 代理组里代理节点的延迟
 */
export async function delayGroup(
  groupName: string,
  testUrl: string,
  timeout: number,
  keepFixed = false,
): Promise<MihomoGroupDelay> {
  return await invoke<MihomoGroupDelay>("plugin:mihomo|delay_group", {
    groupName,
    testUrl,
    timeout,
    keepFixed,
  });
}

// providers
/**
 * 获取所有代理提供者信息
 * @returns 所有代理提供者信息
 */
export async function getProxyProviders(): Promise<ProxyProviders> {
  return await invoke<ProxyProviders>("plugin:mihomo|get_proxy_providers");
}

/**
 * 获取指定的代理提供者信息
 * @param providerName 代理提供者名称
 * @returns 代理提供者信息
 */
export async function getProxyProviderByName(
  providerName: string,
): Promise<ProxyProvider> {
  return await invoke<ProxyProvider>(
    "plugin:mihomo|get_proxy_provider_by_name",
    { providerName },
  );
}

/**
 * 更新代理提供者信息
 * @param providerName 代理提供者名称
 */
export async function updateProxyProvider(providerName: string): Promise<void> {
  await invoke<void>("plugin:mihomo|update_proxy_provider", {
    providerName,
  });
}

/**
 * 对指定的代理提供者进行健康检查
 * @param providerName 代理提供者名称
 */
export async function healthcheckProxyProvider(
  providerName: string,
): Promise<void> {
  await invoke<void>("plugin:mihomo|healthcheck_proxy_provider", {
    providerName,
  });
}

/**
 * 对指定代理提供者下的指定节点（非代理组）进行健康检查, 并返回新的延迟信息
 * @param providerName 代理提供者名称
 * @param proxyName 代理节点名称 (非代理组)
 * @param testUrl 测试 url
 * @param timeout 超时时间
 * @returns 该代理节点的延迟
 */
export async function healthcheckNodeInProvider(
  providerName: string,
  proxyName: string,
  testUrl: string,
  timeout: number,
): Promise<ProxyDelay> {
  return await invoke<ProxyDelay>(
    "plugin:mihomo|healthcheck_node_in_provider",
    {
      providerName,
      proxyName,
      testUrl,
      timeout,
    },
  );
}

// proxies
/**
 * 获取所有代理信息
 * @returns 所有代理信息
 */
export async function getProxies(): Promise<Proxies> {
  return await invoke<Proxies>("plugin:mihomo|get_proxies");
}

/**
 * 获取指定代理信息
 * @param proxyName 代理名称
 * @returns 代理信息
 */
export async function getProxyByName(
  proxyName: string,
): Promise<ProxyInfo | null> {
  return await invoke<ProxyInfo>("plugin:mihomo|get_proxy_by_name", {
    proxiesName: proxyName,
  });
}

/**
 * 为指定代理选择节点
 *
 * 一般为指定代理组下使用指定的代理节点 【代理组/节点】
 * @param groupName 代理组名称
 * @param node 代理节点
 */
export async function selectNodeForGroup(
  groupName: string,
  node: string,
): Promise<void> {
  await invoke<void>("plugin:mihomo|select_node_for_group", {
    groupName,
    node,
  });
}

/**
 * 指定代理组下不再使用固定的代理节点
 *
 * 一般用于自动选择的代理组（例如：URLTest 类型的代理组）下的节点
 * @param groupName 代理组名称
 */
export async function unfixedProxy(groupName: string): Promise<void> {
  await invoke<void>("plugin:mihomo|unfixed_proxy", {
    groupName,
  });
}

/**
 * 对指定代理进行延迟测试
 *
 * 一般用于代理节点的延迟测试，也可传代理组名称（只会测试代理组下选中的代理节点）
 * @param proxyName 代理节点名称
 * @param testUrl 测试 url
 * @param timeout 超时时间
 * @returns 该代理节点的延迟信息
 */
export async function delayProxyByName(
  proxyName: string,
  testUrl: string,
  timeout: number,
): Promise<ProxyDelay> {
  return await invoke<ProxyDelay>("plugin:mihomo|delay_proxy_by_name", {
    proxyName,
    testUrl,
    timeout,
  });
}

// rules
/**
 * 获取所有规则信息
 * @returns 所有规则信息
 */
export async function getRules(): Promise<Rules> {
  return await invoke<Rules>("plugin:mihomo|get_rules");
}

export async function updateRulesDisable(
  rules: Record<number, boolean>,
): Promise<void> {
  return await invoke<void>("plugin:mihomo|update_rules_disable", {
    rules,
  });
}

/**
 * 获取所有规则提供者信息
 * @returns 所有规则提供者信息
 */
export async function getRuleProviders(): Promise<RuleProviders> {
  return await invoke<RuleProviders>("plugin:mihomo|get_rule_providers");
}

/**
 * 更新规则提供者信息
 * @param providerName 规则提供者名称
 */
export async function updateRuleProvider(providerName: string): Promise<void> {
  await invoke<void>("plugin:mihomo|update_rule_provider", {
    providerName,
  });
}

// runtime config
/**
 * 获取基础配置
 * @returns 基础配置
 */
export async function getBaseConfig(): Promise<BaseConfig> {
  return await invoke<BaseConfig>("plugin:mihomo|get_base_config");
}

/**
 * 重新加载配置
 * @param force 强制更新
 * @param configPath 配置文件路径
 */
export async function reloadConfig(
  force: boolean,
  configPath: string,
): Promise<void> {
  await invoke<void>("plugin:mihomo|reload_config", {
    force,
    configPath,
  });
}

/**
 * 更改基础配置
 * @param data 基础配置更改后的内容, 例如：{"tun": {"enabled": true}}
 */
export async function patchBaseConfig(
  data: Record<string, any>,
): Promise<void> {
  await invoke<void>("plugin:mihomo|patch_base_config", {
    data,
  });
}

/**
 * 更新 Geo
 */
export async function updateGeo(): Promise<void> {
  await invoke<void>("plugin:mihomo|update_geo");
}

/**
 * 重启核心
 */
export async function restart(): Promise<void> {
  await invoke<void>("plugin:mihomo|restart");
}

// upgrade
/**
 * 升级核心，将当前运行中的核心升级到选择的通道的最新版
 * @param channel 升级通道, 默认 auto
 *    - release: 稳定版
 *    - alpha: 测试版
 *    - auto: 根据当前运行的核心版本自动选择升级通道
 * @param force 是否强制升级，默认 false
 *    - false: 若当前版本为最新版，返回当前为最新版的错误，不再执行升级操作, 否则下载最新版，覆盖升级
 *    - true: 直接下载最新版，强制覆盖升级
 */
export async function upgradeCore(
  channel: CoreUpdaterChannel = "auto",
  force = false,
): Promise<void> {
  await invoke<void>("plugin:mihomo|upgrade_core", { channel, force });
}

/**
 * 更新 UI
 */
export async function upgradeUi(): Promise<void> {
  await invoke<void>("plugin:mihomo|upgrade_ui");
}

/**
 * 更新 Geo
 */
export async function upgradeGeo(): Promise<void> {
  await invoke<void>("plugin:mihomo|upgrade_geo");
}

/**
 * 获取存储的值
 * @param key 存储的键
 * @returns 存储的值；当 key 不存在时返回 null
 */
export async function getStorageValue<T>(key: string): Promise<T | undefined> {
  return await invoke<T>("plugin:mihomo|get_storage_value", { key });
}

/**
 * 设置存储的键值
 * @param key 存储的键
 * @param value 存储的值
 */
export async function setStorageValue<T>(key: string, value: T): Promise<void> {
  await invoke<void>("plugin:mihomo|set_storage_value", { key, value });
}

/**
 * 删除存储的键值
 * @param key 存储的键
 */
export async function deleteStorageValue(key: string): Promise<void> {
  await invoke<void>("plugin:mihomo|delete_storage_value", { key });
}

/**
 * 清除 Rust 侧中所有的 WebSocket 连接
 */
export async function clearAllWsConnections(): Promise<void> {
  await invoke<void>("plugin:mihomo|clear_all_ws_connections");
}

export interface MessageKind<T, D> {
  type: T;
  data: D;
}

export interface CloseFrame {
  code: number;
  reason: string;
}

export type Message =
  | MessageKind<"Text", string>
  | MessageKind<"Binary", number[]>
  | MessageKind<"Ping", number[]>
  | MessageKind<"Pong", number[]>
  | MessageKind<"Close", CloseFrame | null>;

export class MihomoWebSocket {
  id: string;
  private readonly listeners: Set<(arg: Message) => void>;
  private static instances = new Set<MihomoWebSocket>();

  constructor(id: string, listeners: Set<(arg: Message) => void>) {
    this.id = id;
    this.listeners = listeners;
  }

  /**
   * 监听 Mihomo 的流量信息
   * @returns WebSocket 实例
   */
  static async connect_traffic(): Promise<MihomoWebSocket> {
    const listeners: Set<(arg: Message) => void> = new Set();
    const onMessage = new Channel<Message>();
    onMessage.onmessage = (message: Message): void => {
      listeners.forEach((l) => {
        l(message);
      });
    };
    const id = await invoke<string>("plugin:mihomo|ws_traffic", {
      onMessage,
    });
    const instance = new MihomoWebSocket(id, listeners);
    MihomoWebSocket.instances.add(instance);
    return instance;
  }

  /**
   * 监听 Mihomo 的内存信息
   * @returns WebSocket 实例
   */
  static async connect_memory(): Promise<MihomoWebSocket> {
    const listeners: Set<(arg: Message) => void> = new Set();
    const onMessage = new Channel<Message>();
    onMessage.onmessage = (message: Message): void => {
      listeners.forEach((l) => {
        l(message);
      });
    };
    const id = await invoke<string>("plugin:mihomo|ws_memory", {
      onMessage,
    });
    const instance = new MihomoWebSocket(id, listeners);
    MihomoWebSocket.instances.add(instance);
    return instance;
  }

  /**
   * 监听 Mihomo 的连接信息
   * @returns WebSocket 实例
   */
  static async connect_connections(): Promise<MihomoWebSocket> {
    const listeners: Set<(arg: Message) => void> = new Set();
    const onMessage = new Channel<Message>();
    onMessage.onmessage = (message: Message): void => {
      listeners.forEach((l) => {
        l(message);
      });
    };
    const id = await invoke<string>("plugin:mihomo|ws_connections", {
      onMessage,
    });
    const instance = new MihomoWebSocket(id, listeners);
    MihomoWebSocket.instances.add(instance);
    return instance;
  }

  /**
   * 监听 Mihomo 的日志信息
   * @returns WebSocket 实例
   */
  static async connect_logs(level: LogLevel): Promise<MihomoWebSocket> {
    const listeners: Set<(arg: Message) => void> = new Set();
    const onMessage = new Channel<Message>();
    onMessage.onmessage = (message: Message): void => {
      listeners.forEach((l) => {
        l(message);
      });
    };
    const id = await invoke<string>("plugin:mihomo|ws_logs", {
      level,
      onMessage,
    });
    const instance = new MihomoWebSocket(id, listeners);
    MihomoWebSocket.instances.add(instance);
    return instance;
  }

  /**
   * WebSocket 接收数据的回调函数
   * @param cb 回调函数
   */
  addListener(cb: (arg: Message) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // /**
  //  * 发送消息到 WebSocket 连接
  //  * @param message 发送的消息
  //  */
  // async send(message: Message | string | number[]): Promise<void> {
  //   let m: Message;
  //   if (typeof message === "string") {
  //     m = { type: "Text", data: message };
  //   } else if (typeof message === "object" && "type" in message) {
  //     m = message;
  //   } else if (Array.isArray(message)) {
  //     m = { type: "Binary", data: message };
  //   } else {
  //     throw new Error(
  //       "invalid `message` type, expected a `{ type: string, data: any }` object, a string or a numeric array",
  //     );
  //   }
  //   await invoke("plugin:mihomo|ws_send", { id: this.id, message: m });
  // }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    try {
      await invoke("plugin:mihomo|ws_disconnect", {
        id: this.id,
        forceTimeout: 0,
      });
      this.listeners.clear();
    } catch (ignore) {
      // ignore
    } finally {
      MihomoWebSocket.instances.delete(this);
    }
  }

  /**
   * 清理全部的 websocket 连接资源
   */
  static async cleanupAll() {
    await Promise.all(
      Array.from(MihomoWebSocket.instances).map((instance) => instance.close()),
    );
    MihomoWebSocket.instances.clear();
    await clearAllWsConnections();
  }
}
