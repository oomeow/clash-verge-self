import { isEqual } from "lodash-es";
import { mutate as mutateSWR } from "swr";
import { selectNodeForGroup } from "tauri-plugin-mihomo-api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { calcuProxies } from "@/services/api";
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

type ProfilesActions = {
  setConfig: (config: IProfilesConfig) => void;
  refreshConfig: () => Promise<IProfilesConfig>;
  patchConfig: (value: Partial<IProfilesConfig>) => Promise<void>;
  patchCurrentProfile: (value: Partial<IProfileItem>) => Promise<void>;
  patchProfile: (
    uid: string,
    profile: Partial<IProfileItem>,
    refreshConfig?: boolean,
  ) => Promise<void>;
  createProfile: (
    item: Partial<IProfileItem>,
    fileData?: string | null,
  ) => Promise<void>;
  importProfile: (url: string) => Promise<IProfilesConfig>;
  reorderProfile: (
    activeId: string,
    overId: string,
    refreshConfig?: boolean,
  ) => Promise<void>;
  updateProfile: (
    uid: string,
    option?: IProfileOption,
    refreshConfig?: boolean,
  ) => Promise<void>;
  deleteProfile: (uid: string, refreshConfig?: boolean) => Promise<void>;
  enhanceProfiles: (refreshConfig?: boolean) => Promise<void>;
  setProfileChains: (profileUid: string | null, chains: IProfileItem[]) => void;
  fetchProfileChains: (profileUid: string | null) => Promise<IProfileItem[]>;
  setActivatingItemUids: (uids: string[]) => void;
  clearActivatingItemUids: (expectedUids?: string[]) => void;
  applySelectedProxies: () => Promise<void>;
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

      patchProfile: async (uid, profile, refreshConfig = true) => {
        await patchProfileCmd(uid, profile);
        if (refreshConfig) {
          await get().refreshConfig();
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

      reorderProfile: async (activeId, overId, refreshConfig = true) => {
        await reorderProfileCmd(activeId, overId);
        if (refreshConfig) {
          await get().refreshConfig();
        }
      },

      updateProfile: async (uid, option, refreshConfig = true) => {
        await updateProfileCmd(uid, option);
        if (refreshConfig) {
          await get().refreshConfig();
        }
      },

      deleteProfile: async (uid, refreshConfig = true) => {
        await deleteProfileCmd(uid);
        if (refreshConfig) {
          await get().refreshConfig();
        }
      },

      enhanceProfiles: async (refreshConfig = true) => {
        await enhanceProfilesCmd();
        if (refreshConfig) {
          await get().refreshConfig();
        }
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

      applySelectedProxies: async () => {
        const proxiesData = await calcuProxies();
        const profileData = await get().refreshConfig();

        if (!profileData || !proxiesData) return;

        const current = profileData.items?.find(
          (item) => item && item.uid === profileData.current,
        );

        if (!current || !profileData.current) return;

        const { selected = [] } = current;
        const selectedMap = Object.fromEntries(
          selected.map((each) => [each.name!, each.now!]),
        );

        let hasChange = false;
        const newSelected: typeof selected = [];
        const { global, groups } = proxiesData;

        for (const item of [global, ...groups]) {
          const { type, name, now } = item;
          if (!now || type !== "Selector") continue;
          if (selectedMap[name] != null && selectedMap[name] !== now) {
            hasChange = true;
            await selectNodeForGroup(name, selectedMap[name]);
          }
          newSelected.push({ name, now: selectedMap[name] });
        }

        if (hasChange) {
          await patchProfileCmd(profileData.current, { selected: newSelected });
          await get().refreshConfig();
          mutateSWR("getProxies", calcuProxies());
        }
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
