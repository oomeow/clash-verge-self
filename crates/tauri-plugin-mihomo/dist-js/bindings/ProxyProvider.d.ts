import type { ProviderType } from "./ProviderType";
import type { Proxy } from "./Proxy";
import type { SubscriptionInfo } from "./SubscriptionInfo";
import type { VehicleType } from "./VehicleType";
export type ProxyProvider = {
    name: string;
    type: ProviderType;
    vehicleType: VehicleType;
    proxies: Array<Proxy>;
    testUrl: string;
    expectedStatus: string;
    updatedAt: string | null;
    subscriptionInfo: SubscriptionInfo | null;
};
