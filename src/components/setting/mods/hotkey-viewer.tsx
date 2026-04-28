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
type HotkeyAction = {
  func: string;
  label: string;
  scopes: HotkeyScope[];
};
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

const HOTKEY_CELL_WIDTH = 204;

const ItemWrapper = styled("div")`
  display: grid;
  grid-template-columns:
    minmax(140px, 1fr)
    ${HOTKEY_CELL_WIDTH}px ${HOTKEY_CELL_WIDTH}px;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const HeaderWrapper = styled(ItemWrapper)`
  margin-bottom: 12px;
`;

const DisabledHotkeyCell = styled("div")(({ theme }) => ({
  width: HOTKEY_CELL_WIDTH,
  minHeight: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  border: "1px dashed",
  borderColor: theme.palette.action.disabledBackground,
  borderRadius: 4,
  color: theme.palette.text.disabled,
  backgroundColor: theme.palette.action.hover,
  fontSize: 12,
  lineHeight: 1,
  letterSpacing: 0.2,
  userSelect: "none",
}));

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

const HOTKEY_ACTIONS: HotkeyAction[] = [
  {
    func: "open_or_close_dashboard",
    label: "pages.settings.verge.hotkeys.actions.openOrCloseDashboard",
    scopes: ["global"],
  },
  {
    func: "close_dashboard",
    label: "pages.settings.verge.hotkeys.actions.closeDashboard",
    scopes: ["app"],
  },
  {
    func: "clash_mode_rule",
    label: "pages.settings.verge.hotkeys.actions.ruleMode",
    scopes: ["global", "app"],
  },
  {
    func: "clash_mode_global",
    label: "pages.settings.verge.hotkeys.actions.globalMode",
    scopes: ["global", "app"],
  },
  {
    func: "clash_mode_direct",
    label: "pages.settings.verge.hotkeys.actions.directMode",
    scopes: ["global", "app"],
  },
  {
    func: "toggle_system_proxy",
    label: "pages.settings.verge.hotkeys.actions.toggleSystemProxy",
    scopes: ["global", "app"],
  },
  {
    func: "toggle_tun_mode",
    label: "pages.settings.verge.hotkeys.actions.toggleTunMode",
    scopes: ["global", "app"],
  },
  {
    func: "exit_app",
    label: "pages.settings.verge.hotkeys.actions.exitApp",
    scopes: ["app"],
  },
];

const HOTKEY_LABEL_KEY = Object.fromEntries(
  HOTKEY_ACTIONS.map((action) => [action.func, action.label]),
);

const isScopeAllowed = (func: string, scope: HotkeyScope) =>
  HOTKEY_ACTIONS.some(
    (action) => action.func === func && action.scopes.includes(scope),
  );

const parseHotkeyMap = (hotkeys: string[] | undefined, scope: HotkeyScope) => {
  const map: HotkeyMap = {};

  hotkeys?.forEach((text) => {
    const parsed = parseHotkeyText(text);
    if (parsed && isScopeAllowed(parsed.func, scope)) {
      map[parsed.func] = parsed.keys;
    }
  });

  return map;
};

const serializeHotkeyMap = (map: HotkeyMap) =>
  Object.entries(map)
    .map(([func, keys]) => serializeHotkey(func, keys ?? []))
    .filter(Boolean);

const isSameHotkeyTexts = (
  left: string[] = [],
  right: string[] = [],
  scope: HotkeyScope,
) => {
  const leftHotkeys = serializeHotkeyMap(parseHotkeyMap(left, scope)).sort();
  const rightHotkeys = serializeHotkeyMap(parseHotkeyMap(right, scope)).sort();

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
      globalMap: parseHotkeyMap(vergeHotkeys, "global"),
      appMap: parseHotkeyMap(vergeAppHotkeys, "app"),
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
    if (!isScopeAllowed(func, scope)) return;

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
  const isEmptyInitKeys = !initial.global.length && !initial.app.length;
  const hasHotkeyChanges =
    !isSameHotkeyTexts(initial.global, globalHotkeys, "global") ||
    !isSameHotkeyTexts(initial.app, appHotkeys, "app");
  const restoreHotkeyItems = getRestoreItems(
    HOTKEY_ACTIONS.map((action) => action.func),
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
      title={
        <div className="flex w-full items-center justify-between">
          <span>{t("pages.settings.verge.hotkeys.title")}</span>
          <ActionButtons>
            {hasHotkeyChanges && !isEmptyInitKeys && (
              <Button variant="contained" size="small" onClick={restoreHotkeys}>
                {t("pages.settings.verge.hotkeys.restore")}
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              color="error"
              onClick={clearHotkeys}>
              {t("pages.settings.verge.hotkeys.clear")}
            </Button>
          </ActionButtons>
        </div>
      }
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      loading={saving}
      onClose={cancelHotkeySettings}
      onCancel={cancelHotkeySettings}
      onOk={saveHotkeys}
      contentStyle={{ maxWidth: 640 }}>
      {hasHotkeyChanges && !isEmptyInitKeys && (
        <ActionWrapper>
          <PreviousHotkeyActions>
            {restoreHotkeyItems.map((item) => (
              <PreviousHotkeyChip
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => updateHotkey(item.scope, item.func, item.keys)}>
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
      {HOTKEY_ACTIONS.map(({ func, label, scopes }) => (
        <ItemWrapper key={func}>
          <Typography>{t(label)}</Typography>
          {scopes.includes("global") ? (
            <HotkeyInput
              value={globalHotkeyMap[func] ?? []}
              onChange={(v) => updateHotkey("global", func, v)}
              onDelete={() => updateHotkey("global", func, [])}
            />
          ) : (
            <DisabledHotkeyCell aria-hidden="true">
              {t("pages.settings.verge.hotkeys.notAvailable")}
            </DisabledHotkeyCell>
          )}
          {scopes.includes("app") ? (
            <HotkeyInput
              value={appHotkeyMap[func] ?? []}
              onChange={(v) => updateHotkey("app", func, v)}
              onDelete={() => updateHotkey("app", func, [])}
            />
          ) : (
            <DisabledHotkeyCell aria-hidden="true">
              {t("pages.settings.verge.hotkeys.notAvailable")}
            </DisabledHotkeyCell>
          )}
        </ItemWrapper>
      ))}
    </BaseDialog>
  );
});

export default HotkeyViewer;
