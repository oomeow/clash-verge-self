import { getProxies, Proxy } from "tauri-plugin-mihomo-api";
import { create } from "zustand";

export type Group = Omit<Proxy, "all" | "id"> & {
  expanded: boolean;
  all: Proxy[];
};

type State = {
  groups: Group[];
};

type Action = {
  toggleExpandGroup: (name: string) => void;
  getGroup: (name: string) => Group | undefined;
  fetchGroups: () => Promise<void>;
};

const useGroupsStore = create<State & Action>()((set, get) => ({
  groups: [],
  toggleExpandGroup: (name: string) => {
    const group = get().groups.find((g) => g.name === name);
    if (!group) return;
    const expanded = !group.expanded;
    set((state) => ({
      ...state,
      groups: state.groups.map((g) =>
        g.name === name ? { ...g, expanded } : g,
      ),
    }));
  },

  getGroup: (name: string) => {
    return get().groups.find((g) => g.name === name);
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
          expanded: false,
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

    set({ groups });
  },
}));

export default useGroupsStore;
