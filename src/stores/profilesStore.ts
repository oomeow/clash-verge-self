import { isEqual } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  createProfile as createProfileCmd,
  deleteProfile as deleteProfileCmd,
  enhanceProfiles as enhanceProfilesCmd,
  getChains as getChainsCmd,
  getProfiles,
  importProfile as importProfileCmd,
  patchProfile as patchProfileCmd,
  patchProfilesConfig,
  reorderProfile as reorderProfileCmd,
  updateProfile as updateProfileCmd,
} from "@/services/cmds";

type ProfilesState = {
  config: IProfilesConfig;
  currentProfile?: IProfileItem;
  profileItems: IProfileItem[];
  globalChainItems: IProfileItem[];
  enabledGlobalChainUids: string[];
  chainItemsByProfileUid: Record<string, IProfileItem[]>;
  // 切换订阅时, 使用中的订阅的激活状态
  activatingItemUids: string[];
};

type ProfilesDerivedState = Pick<
  ProfilesState,
  | "config"
  | "currentProfile"
  | "profileItems"
  | "globalChainItems"
  | "enabledGlobalChainUids"
>;

type ProfilesPersistedState = Pick<
  ProfilesState,
  | "config"
  | "currentProfile"
  | "profileItems"
  | "globalChainItems"
  | "enabledGlobalChainUids"
  | "chainItemsByProfileUid"
>;

type ProfilesSnapshot = Pick<
  ProfilesState,
  | "config"
  | "currentProfile"
  | "profileItems"
  | "globalChainItems"
  | "enabledGlobalChainUids"
  | "chainItemsByProfileUid"
>;

type ProfilesActions = {
  setConfig: (config: IProfilesConfig) => void;
  refreshConfig: () => Promise<IProfilesConfig>;
  patchConfig: (value: Partial<IProfilesConfig>) => Promise<void>;
  patchCurrentProfile: (value: Partial<IProfileItem>) => Promise<void>;
  patchProfile: (uid: string, profile: Partial<IProfileItem>) => Promise<void>;
  createProfile: (
    item: Partial<IProfileItem>,
    fileData?: string | null,
  ) => Promise<void>;
  importProfile: (url: string) => Promise<IProfilesConfig>;
  reorderProfile: (activeId: string, overId: string) => Promise<void>;
  updateProfile: (uid: string, option?: IProfileOption) => Promise<void>;
  deleteProfile: (uid: string) => Promise<void>;
  enhanceProfiles: () => Promise<void>;
  setProfileChains: (profileUid: string | null, chains: IProfileItem[]) => void;
  fetchProfileChains: (profileUid: string | null) => Promise<IProfileItem[]>;
  setActivatingItemUids: (uids: string[]) => void;
  clearActivatingItemUids: (expectedUids?: string[]) => void;
};

type ProfilesStore = ProfilesState & ProfilesActions;
type ProfilesStoreSet = (partial: Partial<ProfilesStore>) => void;
type ProfilesStoreGet = () => ProfilesStore;

const getChainKey = (profileUid: string | null) => profileUid ?? "__global__";

const isProfileType = (type?: IProfileItem["type"]) =>
  type === "local" || type === "remote";

const isChainType = (type?: IProfileItem["type"]) =>
  type === "merge" || type === "script";

const toProfileView = (config: IProfilesConfig = {}): ProfilesDerivedState => {
  const items = (config.items ?? []).filter(
    (item): item is IProfileItem => !!item,
  );
  const globalChainItems = items.filter(
    (item) => isChainType(item.type) && item.scope === "global",
  );

  return {
    config,
    currentProfile: items.find((item) => item.uid === config.current),
    profileItems: items.filter((item) => isProfileType(item.type)),
    globalChainItems,
    enabledGlobalChainUids: globalChainItems
      .filter((item) => item.enable)
      .map((item) => item.uid),
  };
};

const pickProfilesState = (state: ProfilesState): ProfilesDerivedState => ({
  config: state.config,
  currentProfile: state.currentProfile,
  profileItems: state.profileItems,
  globalChainItems: state.globalChainItems,
  enabledGlobalChainUids: state.enabledGlobalChainUids,
});

const pickProfilesSnapshot = (state: ProfilesState): ProfilesSnapshot => ({
  ...pickProfilesState(state),
  chainItemsByProfileUid: state.chainItemsByProfileUid,
});

const commitConfig = (
  set: ProfilesStoreSet,
  get: ProfilesStoreGet,
  config: IProfilesConfig,
) => {
  const nextState = toProfileView(config);
  if (!isEqual(pickProfilesState(get()), nextState)) {
    set(nextState);
  }
  return config;
};

const reorderItems = <T extends { uid: string }>(
  items: T[],
  activeId: string,
  overId: string,
) => {
  const activeIndex = items.findIndex((item) => item.uid === activeId);
  const overIndex = items.findIndex((item) => item.uid === overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return items;
  }

  const nextItems = items.slice();
  const [item] = nextItems.splice(activeIndex, 1);
  nextItems.splice(overIndex, 0, item);
  return nextItems;
};

const reorderConfig = (
  config: IProfilesConfig,
  activeId: string,
  overId: string,
) => {
  const items = (config.items ?? []).filter(
    (item): item is IProfileItem => !!item,
  );
  return {
    ...config,
    items: reorderItems(items, activeId, overId),
  };
};

const reorderChainCache = (
  cache: Record<string, IProfileItem[]>,
  activeId: string,
  overId: string,
) =>
  Object.fromEntries(
    Object.entries(cache).map(([key, items]) => [
      key,
      items.some((item) => item.uid === activeId) &&
      items.some((item) => item.uid === overId)
        ? reorderItems(items, activeId, overId)
        : items,
    ]),
  );

const commitReorder = (
  set: ProfilesStoreSet,
  get: ProfilesStoreGet,
  activeId: string,
  overId: string,
) => {
  const nextState = toProfileView(
    reorderConfig(get().config, activeId, overId),
  );
  const nextChainItemsByProfileUid = reorderChainCache(
    get().chainItemsByProfileUid,
    activeId,
    overId,
  );

  set({
    ...nextState,
    chainItemsByProfileUid: nextChainItemsByProfileUid,
  });
};

export const useProfilesStore = create<ProfilesStore>()(
  persist(
    (set, get) => ({
      config: {},
      currentProfile: undefined,
      profileItems: [],
      globalChainItems: [],
      enabledGlobalChainUids: [],
      chainItemsByProfileUid: {},
      activatingItemUids: [],

      setConfig: (config) => {
        commitConfig(set, get, config);
      },

      refreshConfig: async () => {
        const config = await getProfiles();
        return commitConfig(set, get, config);
      },

      patchConfig: async (value) => {
        await patchProfilesConfig(value);
        await get().refreshConfig();
      },

      patchCurrentProfile: async (value) => {
        const current = get().config.current;
        if (!current) return;
        await get().patchProfile(current, value);
      },

      patchProfile: async (uid, profile) => {
        await patchProfileCmd(uid, profile);
        await get().refreshConfig();
      },

      createProfile: async (item, fileData) => {
        await createProfileCmd(item, fileData);
        await get().refreshConfig();
      },

      importProfile: async (url) => {
        await importProfileCmd(url);
        return get().refreshConfig();
      },

      reorderProfile: async (activeId, overId) => {
        const previousState = pickProfilesSnapshot(get());
        commitReorder(set, get, activeId, overId);

        try {
          await reorderProfileCmd(activeId, overId);
          await get().refreshConfig();
        } catch (error) {
          set(previousState);
          throw error;
        }
      },

      updateProfile: async (uid, option) => {
        await updateProfileCmd(uid, option);
        await get().refreshConfig();
      },

      deleteProfile: async (uid) => {
        await deleteProfileCmd(uid);
        await get().refreshConfig();
      },

      enhanceProfiles: async () => {
        await enhanceProfilesCmd();
        await get().refreshConfig();
      },

      setProfileChains: (profileUid, chains) => {
        const key = getChainKey(profileUid);
        if (isEqual(get().chainItemsByProfileUid[key], chains)) return;

        set({
          chainItemsByProfileUid: {
            ...get().chainItemsByProfileUid,
            [key]: chains,
          },
        });
      },

      fetchProfileChains: async (profileUid) => {
        const chains = await getChainsCmd(profileUid);
        get().setProfileChains(profileUid, chains);
        return chains;
      },

      setActivatingItemUids: (uids) => {
        if (isEqual(get().activatingItemUids, uids)) return;
        set({ activatingItemUids: uids });
      },

      clearActivatingItemUids: (expectedUids) => {
        if (expectedUids && !isEqual(get().activatingItemUids, expectedUids)) {
          return;
        }
        get().setActivatingItemUids([]);
      },
    }),
    {
      name: "profiles-store",
      partialize: (state): ProfilesPersistedState => ({
        config: state.config,
        currentProfile: state.currentProfile,
        profileItems: state.profileItems,
        globalChainItems: state.globalChainItems,
        enabledGlobalChainUids: state.enabledGlobalChainUids,
        chainItemsByProfileUid: state.chainItemsByProfileUid,
      }),
    },
  ),
);
