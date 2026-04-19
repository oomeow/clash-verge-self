import { BaseDialog, DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { normalizeKeyList, normalizeKeys } from "@/hooks/use-app-hotkeys";
import { useVergeStore } from "@/stores";
import { Button, styled, Typography } from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatHotkeyKey, HotkeyInput } from "./hotkey-input";

type HotkeyScope = "global" | "app";
type HotkeyMap = Record<string, string[]>;
type RestoreHotkeyItem = {
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

const ItemWrapper = styled("div")`
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 204px 204px;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const HeaderWrapper = styled(ItemWrapper)`
  margin-bottom: 12px;
`;

const ActionWrapper = styled("div")`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const PreviousHotkeyActions = styled("div")`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  flex: 1;
  min-width: 0;
`;

const ActionButtons = styled("div")`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PreviousHotkeyChip = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  minHeight: 22,
  maxWidth: "100%",
  padding: "2px 4px 2px 8px",
  borderRadius: 11,
  color: theme.palette.primary.contrastText,
  backgroundColor: theme.palette.primary.main,
  fontSize: 11,
  lineHeight: 1.2,
  cursor: "pointer",
  transition: theme.transitions.create(["filter"], {
    duration: theme.transitions.duration.shortest,
  }),
  "&:hover": {
    filter: "brightness(1.08)",
  },
}));

const PreviousHotkeyKey = styled("span")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 18,
  padding: "1px 5px",
  borderRadius: 9,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  color: theme.palette.primary.main,
  backgroundColor: theme.palette.primary.contrastText,
}));

const PreviousHotkeyScope = styled("span")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 18,
  padding: "1px 5px",
  borderRadius: 9,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  color: theme.palette.common.white,
  '&[data-scope="global"]': {
    backgroundColor: theme.palette.warning.main,
  },
  '&[data-scope="app"]': {
    backgroundColor: theme.palette.success.main,
  },
}));

const HOTKEY_FUNC = [
  "open_or_close_dashboard",
  "clash_mode_rule",
  "clash_mode_global",
  "clash_mode_direct",
  "toggle_system_proxy",
  "toggle_tun_mode",
  "exit_app",
];

const HOTKEY_LABEL_KEY: Record<(typeof HOTKEY_FUNC)[number], string> = {
  open_or_close_dashboard:
    "pages.settings.verge.hotkeys.actions.openOrCloseDashboard",
  clash_mode_rule: "pages.settings.verge.hotkeys.actions.ruleMode",
  clash_mode_global: "pages.settings.verge.hotkeys.actions.globalMode",
  clash_mode_direct: "pages.settings.verge.hotkeys.actions.directMode",
  toggle_system_proxy: "pages.settings.verge.hotkeys.actions.toggleSystemProxy",
  toggle_tun_mode: "pages.settings.verge.hotkeys.actions.toggleTunMode",
  exit_app: "pages.settings.verge.hotkeys.actions.exitApp",
};

const formatHotkeyKeys = (keys: string[]) =>
  normalizeKeyList(keys).map(formatHotkeyKey).join(" + ");

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

export const HotkeyViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const [open, setOpen] = useState(false);
  const verge = useVergeStore((s) => s.verge)!;
  const patchVerge = useVergeStore((s) => s.patchVerge);

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
  const restoreHotkeyItems = getRestoreItems(
    HOTKEY_FUNC,
    initial,
    globalHotkeyMap,
    appHotkeyMap,
  );

  const clearHotkeys = useLockFn(async () => {
    setHotkeyMaps({}, {});
    await enqueuePatchHotkeys([], []);
  });

  useImperativeHandle(ref, () => ({
    open: () => {
      openHotkeySettings();
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.hotkeys.title")}
      hideFooter
      onClose={() => setOpen(false)}
      contentStyle={{ maxWidth: 640 }}>
      {(hasHotkeyChanges || hasHotkeys) && (
        <ActionWrapper>
          {hasHotkeyChanges ? (
            <PreviousHotkeyActions>
              {restoreHotkeyItems.map((item) => (
                <PreviousHotkeyChip
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => applyRestoreHotkey(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      applyRestoreHotkey(item);
                    }
                  }}>
                  <PreviousHotkeyScope data-scope={item.scope}>
                    {t(`pages.settings.verge.hotkeys.${item.scope}`)}
                  </PreviousHotkeyScope>
                  <span>{t(HOTKEY_LABEL_KEY[item.func])}</span>
                  <PreviousHotkeyKey>
                    {formatHotkeyKeys(item.keys)}
                  </PreviousHotkeyKey>
                </PreviousHotkeyChip>
              ))}
            </PreviousHotkeyActions>
          ) : (
            <span />
          )}
          <ActionButtons>
            {hasHotkeyChanges && (
              <Button variant="outlined" size="small" onClick={restoreHotkeys}>
                {t("pages.settings.verge.hotkeys.restore")}
              </Button>
            )}
            {hasHotkeys && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={clearHotkeys}>
                {t("pages.settings.verge.hotkeys.clear")}
              </Button>
            )}
          </ActionButtons>
        </ActionWrapper>
      )}
      <HeaderWrapper>
        <span />
        <Typography variant="body2" color="text.secondary">
          {t("pages.settings.verge.hotkeys.global")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("pages.settings.verge.hotkeys.app")}
        </Typography>
      </HeaderWrapper>
      {HOTKEY_FUNC.map((func) => (
        <ItemWrapper key={func}>
          <Typography>{t(HOTKEY_LABEL_KEY[func])}</Typography>
          <HotkeyInput
            value={globalHotkeyMap[func] ?? []}
            onChange={(v) => updateHotkey("global", func, v)}
            onDelete={() => updateHotkey("global", func, [])}
          />
          <HotkeyInput
            value={appHotkeyMap[func] ?? []}
            onChange={(v) => updateHotkey("app", func, v)}
            onDelete={() => updateHotkey("app", func, [])}
          />
        </ItemWrapper>
      ))}
    </BaseDialog>
  );
});

export default HotkeyViewer;
