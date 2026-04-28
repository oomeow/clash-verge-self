import { Button, styled, Typography } from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { BaseDialog, DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useVergeStore } from "@/stores";
import {
  formatHotkeyKeys,
  normalizeKeys,
  parseHotkeyText,
  serializeHotkey,
  sortKeys,
} from "@/utils/parse-hotkey";

import { HotkeyInput } from "./hotkey-input";

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

const parseHotkeyMap = (hotkeys?: string[]) => {
  const map: HotkeyMap = {};

  hotkeys?.forEach((text) => {
    const parsed = parseHotkeyText(text);
    if (parsed) {
      map[parsed.func] = parsed.keys;
    }
  });

  return map;
};

const serializeHotkeyMap = (map: HotkeyMap) =>
  Object.entries(map)
    .map(([func, keys]) => serializeHotkey(func, keys ?? []))
    .filter(Boolean);

const isSameHotkeyTexts = (left: string[] = [], right: string[] = []) => {
  const leftHotkeys = serializeHotkeyMap(parseHotkeyMap(left)).sort();
  const rightHotkeys = serializeHotkeyMap(parseHotkeyMap(right)).sort();

  return (
    leftHotkeys.length === rightHotkeys.length &&
    leftHotkeys.every((hotkey, index) => hotkey === rightHotkeys[index])
  );
};

const isSameKeys = (left: string[] = [], right: string[] = []) =>
  normalizeKeys(left) === normalizeKeys(right);

const copyHotkeyMap = (map: HotkeyMap) =>
  Object.fromEntries(
    Object.entries(map).map(([func, keys]) => [func, [...keys]]),
  );

const updateHotkeyMap = (map: HotkeyMap, func: string, keys: string[]) => {
  const next = { ...map };

  if (keys.length) {
    next[func] = sortKeys(keys);
  } else {
    delete next[func];
  }

  return next;
};

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
  const vergeAppHotkeys = useVergeStore(
    useShallow((s) => s.verge.app_hotkeys ?? []),
  );
  const vergeHotkeys = useVergeStore(useShallow((s) => s.verge.hotkeys ?? []));
  const patchVerge = useVergeStore((s) => s.patchVerge);

  const [globalHotkeyMap, setGlobalHotkeyMap] = useState<HotkeyMap>({});
  const [appHotkeyMap, setAppHotkeyMap] = useState<HotkeyMap>({});
  const [saving, setSaving] = useState(false);
  const initialHotkeysRef = useRef<HotkeySnapshot>({
    global: [],
    app: [],
    globalMap: {},
    appMap: {},
  });

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

  const openHotkeySettings = async () => {
    const snapshot = {
      global: vergeHotkeys,
      app: vergeAppHotkeys,
      globalMap: parseHotkeyMap(vergeHotkeys),
      appMap: parseHotkeyMap(vergeAppHotkeys),
    };

    initialHotkeysRef.current = snapshot;
    setGlobalHotkeyMap(snapshot.globalMap);
    setAppHotkeyMap(snapshot.appMap);

    try {
      await patchVerge({ hotkeys: [], app_hotkeys: [] });
    } catch (err: any) {
      notice("error", err.message || err.toString());
      return;
    }
    setOpen(true);
  };

  const updateHotkey = (scope: HotkeyScope, func: string, keys: string[]) => {
    const next =
      scope === "global"
        ? {
            global: updateHotkeyMap(globalHotkeyMap, func, keys),
            app: appHotkeyMap,
          }
        : {
            global: globalHotkeyMap,
            app: updateHotkeyMap(appHotkeyMap, func, keys),
          };

    if (!validateHotkeys(next.global, next.app)) {
      setGlobalHotkeyMap(copyHotkeyMap(globalHotkeyMap));
      setAppHotkeyMap(copyHotkeyMap(appHotkeyMap));
      return;
    }

    setGlobalHotkeyMap(next.global);
    setAppHotkeyMap(next.app);
  };

  const restoreHotkeys = () => {
    const initial = initialHotkeysRef.current;
    setGlobalHotkeyMap(initial.globalMap);
    setAppHotkeyMap(initial.appMap);
  };

  const initial = initialHotkeysRef.current;
  const globalHotkeys = serializeHotkeyMap(globalHotkeyMap);
  const appHotkeys = serializeHotkeyMap(appHotkeyMap);
  const hasHotkeyChanges =
    !isSameHotkeyTexts(initial.global, globalHotkeys) ||
    !isSameHotkeyTexts(initial.app, appHotkeys);
  const hasHotkeys = !!globalHotkeys.length || !!appHotkeys.length;
  const restoreHotkeyItems = getRestoreItems(
    HOTKEY_FUNC,
    initial,
    globalHotkeyMap,
    appHotkeyMap,
  );

  const clearHotkeys = () => {
    setGlobalHotkeyMap({});
    setAppHotkeyMap({});
  };

  const saveHotkeys = useLockFn(async () => {
    try {
      setSaving(true);
      await patchVerge({
        hotkeys: serializeHotkeyMap(globalHotkeyMap),
        app_hotkeys: serializeHotkeyMap(appHotkeyMap),
      });
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      setSaving(false);
    }
  });

  const cancelHotkeySettings = useLockFn(async () => {
    const initial = initialHotkeysRef.current;
    setGlobalHotkeyMap(initial.globalMap);
    setAppHotkeyMap(initial.appMap);

    try {
      setSaving(true);
      await patchVerge({
        hotkeys: initial.global,
        app_hotkeys: initial.app,
      });
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      setSaving(false);
    }
  });

  useImperativeHandle(ref, () => ({
    open: () => {
      void openHotkeySettings();
    },
    close: () => {
      void cancelHotkeySettings();
    },
  }));

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.hotkeys.title")}
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      loading={saving}
      onClose={cancelHotkeySettings}
      onCancel={cancelHotkeySettings}
      onOk={saveHotkeys}
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
                  onClick={() =>
                    updateHotkey(item.scope, item.func, item.keys)
                  }>
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
              <Button variant="contained" size="small" onClick={restoreHotkeys}>
                {t("pages.settings.verge.hotkeys.restore")}
              </Button>
            )}
            {hasHotkeys && (
              <Button
                variant="contained"
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
