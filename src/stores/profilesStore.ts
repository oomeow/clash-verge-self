import { isEqual } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LogMessage } from "@/components/profile/profile-more";
import {
  createProfile as createProfileCmd,
  deleteProfile as deleteProfileCmd,
  enhanceProfiles as enhanceProfilesCmd,
  getChains as getChainsCmd,
  getProfiles,
  getRuntimeLogs,
  importProfile as importProfileCmd,
  patchProfile as patchProfileCmd,
  patchProfilesConfig,
  reorderProfile as reorderProfileCmd,
  updateProfile as updateProfileCmd,
} from "@/services/cmds";

type ProfilesState = {
  currentProfile?: IProfileItem;
  profileItems: IProfileItem[];
  globalChainItems: IProfileItem[];
  chainItemsByProfileUid: Record<string, IProfileItem[]>;
  chainLogs: Record<string, LogMessage[]>;
  // 切换订阅时, 使用中的订阅的激活状态
  activatingItemUids: string[];
};

type ProfilesDerivedState = Pick<
  ProfilesState,
  "currentProfile" | "profileItems" | "globalChainItems"
>;

type ProfilesPersistedState = Pick<
  ProfilesState,
  | "currentProfile"
  | "profileItems"
  | "globalChainItems"
  | "chainItemsByProfileUid"
>;

type ProfilesSnapshot = Pick<
  ProfilesState,
  | "currentProfile"
  | "profileItems"
  | "globalChainItems"
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
  refreshChainLogs: () => Promise<Record<string, LogMessage[]>>;
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

const isEnabledChainUid = (state: ProfilesState, uid?: string) => {
  if (!uid) return false;
  if (state.globalChainItems.some((item) => item.uid === uid && item.enable)) {
    return true;
  }
  return Object.values(state.chainItemsByProfileUid).some((items) =>
    items.some((item) => item.uid === uid && item.enable),
  );
};

const shouldRefreshChainLogs = (
  state: ProfilesState,
  uid?: string,
  profile?: Partial<IProfileItem>,
) => {
  if (!uid) return false;
  return (
    uid === state.currentProfile?.uid ||
    isEnabledChainUid(state, uid) ||
    profile?.enable === true
  );
};

const toProfileView = (config: IProfilesConfig = {}): ProfilesDerivedState => {
  const items = (config.items ?? []).filter(
    (item): item is IProfileItem => !!item,
  );
  const globalChainItems = items.filter(
    (item) => isChainType(item.type) && item.scope === "global",
  );

  return {
    currentProfile: items.find((item) => item.uid === config.current),
    profileItems: items.filter((item) => isProfileType(item.type)),
    globalChainItems,
  };
};

const pickProfilesState = (state: ProfilesState): ProfilesDerivedState => ({
  currentProfile: state.currentProfile,
  profileItems: state.profileItems,
  globalChainItems: state.globalChainItems,
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
  const state = get();
  const nextChainItemsByProfileUid = reorderChainCache(
    state.chainItemsByProfileUid,
    activeId,
    overId,
  );

  set({
    profileItems: reorderItems(state.profileItems, activeId, overId),
    globalChainItems: reorderItems(state.globalChainItems, activeId, overId),
    chainItemsByProfileUid: nextChainItemsByProfileUid,
  });
};

export const useProfilesStore = create<ProfilesStore>()(
  persist(
    (set, get) => ({
      currentProfile: undefined,
      profileItems: [],
      globalChainItems: [],
      chainItemsByProfileUid: {},
      chainLogs: {},
      activatingItemUids: [],

      setConfig: (config) => {
        commitConfig(set, get, config);
      },

      refreshConfig: async () => {
        const config = await getProfiles();
        return commitConfig(set, get, config);
      },

      patchConfig: async (value) => {
        const shouldRefreshLogs =
          (value.current != null &&
            value.current !== get().currentProfile?.uid) ||
          value.chain != null;
        await patchProfilesConfig(value);
        await get().refreshConfig();
        if (shouldRefreshLogs) {
          await get().refreshChainLogs();
        }
      },

      patchCurrentProfile: async (value) => {
        const current = get().currentProfile?.uid;
        if (!current) return;
        await get().patchProfile(current, value);
      },

      patchProfile: async (uid, profile) => {
        const shouldRefreshLogs = shouldRefreshChainLogs(get(), uid, profile);
        await patchProfileCmd(uid, profile);
        await get().refreshConfig();
        if (shouldRefreshLogs) {
          await get().refreshChainLogs();
        }
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
        const shouldRefreshLogs = shouldRefreshChainLogs(get(), activeId);
        commitReorder(set, get, activeId, overId);

        try {
          await reorderProfileCmd(activeId, overId);
          await get().refreshConfig();
          if (shouldRefreshLogs) {
            await get().refreshChainLogs();
          }
        } catch (error) {
          set(previousState);
          throw error;
        }
      },

      updateProfile: async (uid, option) => {
        const shouldRefreshLogs = shouldRefreshChainLogs(get(), uid);
        await updateProfileCmd(uid, option);
        await get().refreshConfig();
        if (shouldRefreshLogs) {
          await get().refreshChainLogs();
        }
      },

      deleteProfile: async (uid) => {
        const shouldRefreshLogs = shouldRefreshChainLogs(get(), uid);
        await deleteProfileCmd(uid);
        await get().refreshConfig();
        if (shouldRefreshLogs) {
          await get().refreshChainLogs();
        }
      },

      enhanceProfiles: async () => {
        await enhanceProfilesCmd();
        await get().refreshConfig();
        await get().refreshChainLogs();
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

      refreshChainLogs: async () => {
        const chainLogs = await getRuntimeLogs();
        if (!isEqual(get().chainLogs, chainLogs)) {
          set({ chainLogs });
        }
        return chainLogs;
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
        currentProfile: state.currentProfile,
        profileItems: state.profileItems,
        globalChainItems: state.globalChainItems,
        chainItemsByProfileUid: state.chainItemsByProfileUid,
      }),
    },
  ),
);
