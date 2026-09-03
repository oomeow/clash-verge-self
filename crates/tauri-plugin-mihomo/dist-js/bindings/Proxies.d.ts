import type { ProxyInfo } from "./ProxyInfo";
/**
 * proxies
 */
export type Proxies = {
    proxies: {
        [key in string]: ProxyInfo;
    };
};
