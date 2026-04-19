import { useNotice } from "@/components/base/notifies";
import { useVerge } from "@/hooks/use-verge";
import { normalizeKeyList, normalizeKeys } from "@/hooks/use-app-hotkeys";
import { useLockFn } from "ahooks";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export type HotkeyScope = "global" | "app";
export type HotkeyMap = Record<string, string[]>;
export type RestoreHotkeyItem = {
  id: string;
  scope: HotkeyScope;
  func: string;
  keys: string[];
};

type HotkeySnapshot = {
  global: string[];
  app: string[];
  globalMap: HotkeyMap;
  appMap: HotkeyMap;
};

const parseHotkeyMap = (hotkeys?: string[]) => {
  const map: HotkeyMap = {};

  hotkeys?.forEach((text) => {
    const [func, key] = text.split(",").map((e) => e.trim());
    if (!func || !key) return;

    map[func] = normalizeKeyList(
      key
        .split("+")
        .map((e) => e.trim())
        .map((k) => (k === "PLUS" ? "+" : k)),
    );
  });

  return map;
};

const serializeHotkeyMap = (map: HotkeyMap) =>
  Object.entries(map)
    .map(([func, keys]) => {
      const key = normalizeKeyList(keys ?? [])
        .map((k) => (k === "+" ? "PLUS" : k))
        .join("+");

      return func && key ? `${func},${key}` : "";
    })
    .filter(Boolean);

const normalizeHotkeyTexts = (hotkeys: string[] | undefined) =>
  serializeHotkeyMap(parseHotkeyMap(hotkeys)).sort();

const isSameHotkeys = (
  left: string[] | undefined,
  right: string[] | undefined,
) => {
  const leftHotkeys = normalizeHotkeyTexts(left);
  const rightHotkeys = normalizeHotkeyTexts(right);

  return (
    leftHotkeys.length === rightHotkeys.length &&
    leftHotkeys.every((hotkey, index) => hotkey === rightHotkeys[index])
  );
};

const isSameKeys = (left: string[] = [], right: string[] = []) =>
  left.length === right.length && normalizeKeys(left) === normalizeKeys(right);

const cloneHotkeyMap = (map: HotkeyMap) =>
  Object.fromEntries(
    Object.entries(map).map(([func, keys]) => [func, [...keys]]),
  );

const updateHotkeyMap = (map: HotkeyMap, func: string, keys: string[]) => {
  const next = cloneHotkeyMap(map);

  if (keys.length) {
    next[func] = normalizeKeyList(keys);
  } else {
    delete next[func];
  }

  return next;
};

const createHotkeySnapshot = (
  global: string[] = [],
  app: string[] = [],
): HotkeySnapshot => ({
  global,
  app,
  globalMap: parseHotkeyMap(global),
  appMap: parseHotkeyMap(app),
});

const getRestoreItems = (
  funcs: string[],
  initial: HotkeySnapshot,
  global: HotkeyMap,
  app: HotkeyMap,
) =>
  funcs.flatMap((func) => {
    const items: RestoreHotkeyItem[] = [];
    const initialGlobalKeys = initial.globalMap[func] ?? [];
    const initialAppKeys = initial.appMap[func] ?? [];

    if (
      initialGlobalKeys.length &&
      !isSameKeys(initialGlobalKeys, global[func])
    ) {
      items.push({
        id: `global-${func}`,
        scope: "global",
        func,
        keys: initialGlobalKeys,
      });
    }
    if (initialAppKeys.length && !isSameKeys(initialAppKeys, app[func])) {
      items.push({
        id: `app-${func}`,
        scope: "app",
        func,
        keys: initialAppKeys,
      });
    }

    return items;
  });

export const useHotkeySettings = (funcs: string[]) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const { verge, patchVerge } = useVerge();

  const [globalHotkeyMap, setGlobalHotkeyMap] = useState<HotkeyMap>({});
  const [appHotkeyMap, setAppHotkeyMap] = useState<HotkeyMap>({});
  const globalHotkeyMapRef = useRef<HotkeyMap>({});
  const appHotkeyMapRef = useRef<HotkeyMap>({});
  const initialHotkeysRef = useRef<HotkeySnapshot>(
    createHotkeySnapshot([], []),
  );
  const activeHotkeysRef = useRef({
    global: [] as string[],
    app: [] as string[],
  });
  const syncHotkeysPromiseRef = useRef(Promise.resolve());

  const setHotkeyMaps = (global: HotkeyMap, app: HotkeyMap) => {
    globalHotkeyMapRef.current = global;
    appHotkeyMapRef.current = app;
    setGlobalHotkeyMap(global);
    setAppHotkeyMap(app);
  };

  const patchChangedHotkeys = async (
    hotkeys: string[],
    appHotkeys: string[],
  ) => {
    const patch: Partial<IVergeConfig> = {};
    const active = activeHotkeysRef.current;

    if (!isSameHotkeys(active.global, hotkeys)) {
      patch.hotkeys = hotkeys;
    }
    if (!isSameHotkeys(active.app, appHotkeys)) {
      patch.app_hotkeys = appHotkeys;
    }

    if (patch.hotkeys || patch.app_hotkeys) {
      await patchVerge(patch);
    }

    activeHotkeysRef.current = { global: hotkeys, app: appHotkeys };
  };

  const enqueuePatchHotkeys = (hotkeys: string[], appHotkeys: string[]) => {
    const task = syncHotkeysPromiseRef.current.then(async () => {
      try {
        await patchChangedHotkeys(hotkeys, appHotkeys);
      } catch (err: any) {
        notice("error", err.message || err.toString());
      }
    });

    syncHotkeysPromiseRef.current = task;
    return task;
  };

  const validateHotkeys = (global: HotkeyMap, app: HotkeyMap) => {
    const used = new Set<string>();

    for (const map of [global, app]) {
      for (const keys of Object.values(map)) {
        if (!keys?.length) continue;

        const id = normalizeKeys(keys);
        if (used.has(id)) {
          notice("error", t("pages.settings.verge.hotkeys.conflict"));
          return false;
        }

        used.add(id);
      }
    }

    return true;
  };

  const openHotkeySettings = () => {
    const global = verge?.hotkeys ?? [];
    const app = verge?.app_hotkeys ?? [];
    const snapshot = createHotkeySnapshot(global, app);

    initialHotkeysRef.current = snapshot;
    activeHotkeysRef.current = { global, app };
    setHotkeyMaps(snapshot.globalMap, snapshot.appMap);
  };

  const updateHotkey = (scope: HotkeyScope, func: string, keys: string[]) => {
    const currentGlobal = globalHotkeyMapRef.current;
    const currentApp = appHotkeyMapRef.current;
    const next =
      scope === "global"
        ? {
            global: updateHotkeyMap(currentGlobal, func, keys),
            app: cloneHotkeyMap(currentApp),
          }
        : {
            global: cloneHotkeyMap(currentGlobal),
            app: updateHotkeyMap(currentApp, func, keys),
          };

    if (!validateHotkeys(next.global, next.app)) {
      setHotkeyMaps(cloneHotkeyMap(currentGlobal), cloneHotkeyMap(currentApp));
      return;
    }

    setHotkeyMaps(next.global, next.app);
    void enqueuePatchHotkeys(
      serializeHotkeyMap(next.global),
      serializeHotkeyMap(next.app),
    );
  };

  const applyRestoreHotkey = (item: RestoreHotkeyItem) => {
    updateHotkey(item.scope, item.func, item.keys);
  };

  const restoreHotkeys = useLockFn(async () => {
    const initial = initialHotkeysRef.current;

    setHotkeyMaps(initial.globalMap, initial.appMap);
    await enqueuePatchHotkeys(initial.global, initial.app);
  });

  const initial = initialHotkeysRef.current;
  const globalHotkeys = serializeHotkeyMap(globalHotkeyMap);
  const appHotkeys = serializeHotkeyMap(appHotkeyMap);
  const hasHotkeyChanges =
    !isSameHotkeys(initial.global, globalHotkeys) ||
    !isSameHotkeys(initial.app, appHotkeys);
  const hasHotkeys = !!globalHotkeys.length || !!appHotkeys.length;

  const clearHotkeys = useLockFn(async () => {
    setHotkeyMaps({}, {});
    await enqueuePatchHotkeys([], []);
  });

  return {
    globalHotkeyMap,
    appHotkeyMap,
    hasHotkeys,
    hasHotkeyChanges,
    restoreHotkeyItems: getRestoreItems(
      funcs,
      initial,
      globalHotkeyMap,
      appHotkeyMap,
    ),
    openHotkeySettings,
    applyRestoreHotkey,
    clearHotkeys,
    restoreHotkeys,
    updateHotkey,
  };
};
