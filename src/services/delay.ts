import {
  delayGroup,
  delayProxyByName,
  healthcheckNodeInProvider,
  Proxy,
} from "tauri-plugin-mihomo-api";

export const DEFAULT_TEST_URL = "https://www.gstatic.com/generate_204";
export const DEFAULT_LATENCY_TIMEOUT = 5000;

const hashKey = (name: string, group: string) => `${group ?? ""}::${name}`;

class DelayManager {
  private cache = new Map<string, [number, number]>();
  private urlMap = new Map<string, string>();

  // 每个item的监听
  private listenerMap = new Map<string, (time: number) => void>();

  // 每个分组的监听
  private groupListenerMap = new Map<string, Set<() => void>>();

  setUrl(group: string, url: string | undefined) {
    this.urlMap.set(group, url ?? DEFAULT_TEST_URL);
  }

  getUrl(group: string) {
    return this.urlMap.get(group) || DEFAULT_TEST_URL;
  }

  setListener(name: string, group: string, listener: (time: number) => void) {
    const key = hashKey(name, group);
    this.listenerMap.set(key, listener);
  }

  removeListener(name: string, group: string) {
    const key = hashKey(name, group);
    this.listenerMap.delete(key);
  }

  setGroupListener(group: string, listener: () => void) {
    const listeners = this.groupListenerMap.get(group) ?? new Set<() => void>();
    listeners.add(listener);
    this.groupListenerMap.set(group, listeners);
  }

  removeGroupListener(group: string, listener?: () => void) {
    if (!listener) {
      this.groupListenerMap.delete(group);
      return;
    }

    const listeners = this.groupListenerMap.get(group);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.groupListenerMap.delete(group);
    }
  }

  setDelay(name: string, group: string, delay: number) {
    const key = hashKey(name, group);
    this.cache.set(key, [Date.now(), delay]);
    this.listenerMap.get(key)?.(delay);
    this.groupListenerMap.get(group)?.forEach((listener) => listener());
  }

  getDelay(name: string, group: string) {
    if (!name) return -1;

    const result = this.cache.get(hashKey(name, group));
    if (result && Date.now() - result[0] <= 18e5) {
      return result[1];
    }
    return -1;
  }

  /// 暂时修复provider的节点延迟排序的问题
  getDelayFix(proxy: Proxy, groupName: string) {
    const delay = this.getDelay(proxy.name, groupName);
    if (delay >= 0 || delay === -2) return delay;

    if (proxy.history.length > 0) {
      return proxy.history[proxy.history.length - 1].delay;
    }
    return -1;
  }

  // 统一延迟测试检测
  async unifiedDelayCheck(
    name: string,
    url: string,
    timeout: number,
    providerName?: string,
  ) {
    if (providerName)
      return healthcheckNodeInProvider(providerName, name, url, timeout);
    return delayProxyByName(name, url, timeout);
  }

  async checkDelay(
    name: string,
    group: string,
    timeout: number,
    providerName?: string,
  ) {
    let delay: number;
    this.setDelay(name, group, -2);

    try {
      const url = this.getUrl(group);
      const result = await this.unifiedDelayCheck(
        name,
        url,
        timeout,
        providerName,
      );
      delay = result.delay;
    } catch {
      delay = 1e6; // error
    }

    this.setDelay(name, group, delay);
    return delay;
  }

  async checkListDelay(
    proxies: Proxy[],
    group: string,
    timeout: number,
    concurrency = 36,
  ) {
    const names = proxies.map((o) => o.name).filter(Boolean);
    // 设置正在延迟测试中
    names.forEach((name) => this.setDelay(name, group, -2));

    let total = names.length;

    if (total > 30) {
      const url = this.getUrl(group);
      try {
        const result = await delayGroup(group, url, timeout, true);
        const resultNames = Object.keys(result);
        const timeoutNames = names.filter(
          (name) => !resultNames.includes(name),
        );
        timeoutNames.forEach((name) => this.setDelay(name, group, 0));
        Object.entries(result).forEach(([name, delay]) => {
          this.setDelay(name, group, delay);
        });
      } catch (err) {
        console.error(err);
        // group delay error, which means that all proxies are timeout
        names.forEach((name) => this.setDelay(name, group, 0));
      }
      return null;
    }

    let current = 0;
    return new Promise((resolve) => {
      const help = async (): Promise<void> => {
        if (current >= concurrency) return;
        const curProxy = proxies.shift();
        if (!curProxy) return;
        current += 1;
        await this.checkDelay(
          curProxy.name,
          group,
          timeout,
          curProxy.providerName,
        );
        current -= 1;
        total -= 1;
        if (total <= 0) resolve(null);
        else return help();
      };
      for (let i = 0; i < concurrency; ++i) help();
    });
  }

  formatDelay(delay: number, timeout = DEFAULT_LATENCY_TIMEOUT) {
    if (delay < 0) return "Error";
    if (delay == 0) return "Timeout";
    if (delay > 1e5) return "Error";
    if (delay >= timeout) return "Timeout"; // 5s
    return `${delay}`;
  }

  formatDelayColor(delay: number, timeout = DEFAULT_LATENCY_TIMEOUT) {
    if (delay <= 0) return "#ff3d00"; // 超时 -> 红色
    if (delay < 500) return "#2ecc71"; // 小于 500ms -> 绿色
    if (delay < timeout) return "#f39c12"; // 小于超时时间 -> 黄色
    return "#ff3d00"; // 大于等于超时时间 -> 红色
  }
}

export default new DelayManager();
