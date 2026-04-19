import { BaseDialog, DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { normalizeKeyList, normalizeKeys } from "@/hooks/use-app-hotkeys";
import { useVerge } from "@/hooks/use-verge";
import { styled, Typography } from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HotkeyInput } from "./hotkey-input";

type HotkeyScope = "global" | "app";
type HotkeyMap = Record<string, string[]>;

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
    const [func, key] = text.split(",").map((e) => e.trim());

    if (!func || !key) return;

    map[func] = key
      .split("+")
      .map((e) => e.trim())
      .map((k) => (k === "PLUS" ? "+" : k));
    map[func] = normalizeKeyList(map[func]);
  });

  return map;
};

const serializeHotkeyMap = (map: HotkeyMap) =>
  Object.entries(map)
    .map(([func, keys]) => {
      if (!func || !keys?.length) return "";

      const key = normalizeKeyList(keys)
        .map((k) => (k === "+" ? "PLUS" : k))
        .join("+");

      if (!key) return "";
      return `${func},${key}`;
    })
    .filter(Boolean);

const removeHotkeyFunc = (hotkeys: string[] | undefined, targetFunc: string) =>
  hotkeys?.filter((text) => {
    const [func] = text.split(",").map((e) => e.trim());
    return func !== targetFunc;
  }) ?? [];

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

export const HotkeyViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const [open, setOpen] = useState(false);

  const { verge, patchVerge } = useVerge();

  const [globalHotkeyMap, setGlobalHotkeyMap] = useState<HotkeyMap>({});
  const [appHotkeyMap, setAppHotkeyMap] = useState<HotkeyMap>({});
  const initialHotkeysRef = useRef<{
    global: string[];
    app: string[];
  }>({ global: [], app: [] });
  const activeGlobalHotkeysRef = useRef<string[]>([]);
  const activeAppHotkeysRef = useRef<string[]>([]);

  useImperativeHandle(ref, () => ({
    open: () => {
      const globalHotkeys = verge?.hotkeys ?? [];
      const appHotkeys = verge?.app_hotkeys ?? [];

      initialHotkeysRef.current = {
        global: globalHotkeys,
        app: appHotkeys,
      };
      activeGlobalHotkeysRef.current = globalHotkeys;
      activeAppHotkeysRef.current = appHotkeys;

      setOpen(true);
      setGlobalHotkeyMap(parseHotkeyMap(globalHotkeys));
      setAppHotkeyMap(parseHotkeyMap(appHotkeys));
    },
    close: () => onCancel(),
  }));

  const updateHotkey = (scope: HotkeyScope, func: string, keys: string[]) => {
    const id = keys.length ? normalizeKeys(keys) : "";
    const clearConflicts = (map: HotkeyMap) => {
      const next = { ...map };
      Object.entries(next).forEach(([currentFunc, currentKeys]) => {
        if (currentFunc !== func && normalizeKeys(currentKeys) === id) {
          delete next[currentFunc];
        }
      });
      return next;
    };
    const updateCurrent = (map: HotkeyMap) => {
      const next = id ? clearConflicts(map) : { ...map };
      if (keys.length) {
        next[func] = keys;
      } else {
        delete next[func];
      }
      return next;
    };
    const clearPeer = (map: HotkeyMap) => {
      const next = id ? clearConflicts(map) : { ...map };
      delete next[func];
      return next;
    };

    if (scope === "global") {
      setGlobalHotkeyMap(updateCurrent);
      setAppHotkeyMap(clearPeer);
    } else {
      setAppHotkeyMap(updateCurrent);
      setGlobalHotkeyMap(clearPeer);
    }
  };

  const deleteHotkey = async (scope: HotkeyScope, func: string) => {
    updateHotkey(scope, func, []);

    try {
      if (scope === "app") {
        const appHotkeys = removeHotkeyFunc(activeAppHotkeysRef.current, func);
        if (isSameHotkeys(activeAppHotkeysRef.current, appHotkeys)) {
          return;
        }

        activeAppHotkeysRef.current = appHotkeys;
        await patchVerge({
          app_hotkeys: appHotkeys,
        });
      } else {
        const hotkeys = removeHotkeyFunc(activeGlobalHotkeysRef.current, func);
        if (isSameHotkeys(activeGlobalHotkeysRef.current, hotkeys)) {
          return;
        }

        activeGlobalHotkeysRef.current = hotkeys;
        await patchVerge({
          hotkeys,
        });
      }
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  };

  const validateHotkeys = () => {
    const used = new Map<string, HotkeyScope>();

    for (const [scope, map] of [
      ["global", globalHotkeyMap],
      ["app", appHotkeyMap],
    ] as const) {
      for (const keys of Object.values(map)) {
        if (!keys?.length) continue;

        const id = normalizeKeys(keys);
        const peerScope = used.get(id);
        if (peerScope) {
          notice("error", t("pages.settings.verge.hotkeys.conflict"));
          return false;
        }

        used.set(id, scope);
      }
    }

    return true;
  };

  const onSave = useLockFn(async () => {
    if (!validateHotkeys()) return;

    try {
      const hotkeys = serializeHotkeyMap(globalHotkeyMap);
      const appHotkeys = serializeHotkeyMap(appHotkeyMap);
      const patch: Partial<IVergeConfig> = {};

      if (!isSameHotkeys(activeGlobalHotkeysRef.current, hotkeys)) {
        patch.hotkeys = hotkeys;
      }
      if (!isSameHotkeys(activeAppHotkeysRef.current, appHotkeys)) {
        patch.app_hotkeys = appHotkeys;
      }

      if (patch.hotkeys || patch.app_hotkeys) {
        await patchVerge(patch);
      }

      activeGlobalHotkeysRef.current = hotkeys;
      activeAppHotkeysRef.current = appHotkeys;
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  });

  const onCancel = useLockFn(async () => {
    const { global, app } = initialHotkeysRef.current;

    try {
      const patch: Partial<IVergeConfig> = {};

      if (!isSameHotkeys(activeGlobalHotkeysRef.current, global)) {
        patch.hotkeys = global;
      }
      if (!isSameHotkeys(activeAppHotkeysRef.current, app)) {
        patch.app_hotkeys = app;
      }

      if (patch.hotkeys || patch.app_hotkeys) {
        await patchVerge(patch);
      }

      activeGlobalHotkeysRef.current = global;
      activeAppHotkeysRef.current = app;
      setGlobalHotkeyMap(parseHotkeyMap(global));
      setAppHotkeyMap(parseHotkeyMap(app));
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  });

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.hotkeys.title")}
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      onClose={onCancel}
      onCancel={onCancel}
      onOk={onSave}
      contentStyle={{ maxWidth: 640 }}>
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
            onDelete={() => deleteHotkey("global", func)}
          />
          <HotkeyInput
            value={appHotkeyMap[func] ?? []}
            onChange={(v) => updateHotkey("app", func, v)}
            onDelete={() => deleteHotkey("app", func)}
          />
        </ItemWrapper>
      ))}
    </BaseDialog>
  );
});

export default HotkeyViewer;
