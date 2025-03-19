import { getProxies, Proxy } from "tauri-plugin-mihomo-api";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type Group = Omit<Proxy, "all" | "id"> & {
  all: Proxy[];
};

type ProxiesDelay = Record<string, Record<string, number | undefined>>;

type State = {
  groups: Group[];
  expandedGroups: Record<string, boolean>;
  proxiesDelay: ProxiesDelay;
};

type Action = {
  getGroup: (name: string) => Group | undefined;
  toggleExpandGroup: (name: string) => void;
  updateProxyDelay: (
    groupName: string,
    proxyName: string,
    delay: number,
  ) => void;
  updateGroupDelay: (
    groupName: string,
    proxiesDelay: Record<string, number>,
  ) => void;
  fetchGroups: () => Promise<void>;
};

const useGroupsStore = create<State & Action>()(
  immer((set, get) => ({
    groups: [],
    expandedGroups: {},
    proxiesDelay: {},
    getGroup: (name: string) => {
      return get().groups.find((g) => g.name === name);
    },
    toggleExpandGroup: (name: string) => {
      const nextExpanded = !get().expandedGroups[name];
      set((state) => {
        state.expandedGroups[name] = nextExpanded;
      });
    },
    updateProxyDelay: (groupName: string, proxyName: string, delay: number) => {
      set((state) => {
        state.proxiesDelay[groupName][proxyName] = delay;
      });
    },
    updateGroupDelay: (
      groupName: string,
      proxiesDelay: Record<string, number>,
    ) => {
      const proxiesInGroup = get().groups.find(
        (group) => group.name === groupName,
      )?.all;
      const allProxiesDelay = proxiesInGroup
        ?.map((item) => {
          const itemName = item.name;
          return { [itemName]: proxiesDelay[itemName] ?? -1 } as Record<
            string,
            number
          >;
        })
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});
      if (allProxiesDelay) {
        set((state) => {
          state.proxiesDelay[groupName] = allProxiesDelay;
        });
      }
    },
    fetchGroups: async () => {
      const proxies = await getProxies();
      const proxiesMap = proxies.proxies;
      if (!proxiesMap) return;

      // select and convert to groups
      const entries = Object.entries(proxies.proxies);
      const allGroups = entries
        .filter(([_, item]) => item.all)
        .map(([_, item]) => {
          const group = {
            ...item,
            all: [],
          } as Group;
          item.all.forEach((name) => {
            group.all.push(proxiesMap[name]);
          });
          return group;
        });

      // use global all to order groups
      const globalGroups = allGroups.find((g) => g.name === "GLOBAL")!;
      const groups = globalGroups.all
        .filter((item) => !!allGroups.find((group) => group.name === item.name))
        .map((item) => {
          const groupName = item.name;
          return allGroups.find((g) => g.name === groupName)!;
        });
      for (let i = 0; i < 10; i++) {
        const proxies = [];
        for (let j = 0; j < 300; j++) {
          proxies.push({ name: `Proxy ${j + 1}` });
        }
        groups.push({
          name: `Group ${i + 1}`,
          all: [...proxies],
        } as Group);
      }
      set((state) => {
        state.groups = groups;
      });
    },
  })),
);

export default useGroupsStore;
