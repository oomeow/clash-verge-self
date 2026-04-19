import { dispatchHotkeyAction } from "@/services/cmds";
import { parseHotkey } from "@/utils/parse-hotkey";
import { useEffect, useMemo, useRef } from "react";

const MODIFIER_KEYS = new Set(["CMD", "CTRL", "OPTION", "SHIFT"]);
const HOTKEY_TOKEN_ORDER = ["CMD", "CTRL", "OPTION", "SHIFT"];

const parseHotkeyText = (text: string) => {
  const [func, key] = text.split(",").map((item) => item.trim());
  if (!func || !key) return null;

  const keys = key
    .split("+")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item === "PLUS" ? "+" : item));

  if (!keys.length) return null;

  return { func, id: normalizeKeys(keys) };
};

export const normalizeKeyList = (keys: string[]) => {
  const keySet = new Set(keys.map((key) => key.trim()).filter(Boolean));
  const modifiers = HOTKEY_TOKEN_ORDER.filter((key) => keySet.delete(key));
  const others = [...keySet].sort();

  return [...modifiers, ...others];
};

export const normalizeKeys = (keys: string[]) =>
  normalizeKeyList(keys).join("+");

const getEventHotkeyId = (event: KeyboardEvent) => {
  const keys = [];
  if (event.metaKey) keys.push("CMD");
  if (event.ctrlKey) keys.push("CTRL");
  if (event.altKey) keys.push("OPTION");
  if (event.shiftKey) keys.push("SHIFT");

  const key = parseHotkey(event.code);
  if (key !== "UNIDENTIFIED" && !MODIFIER_KEYS.has(key)) {
    keys.push(key);
  }

  return keys.length ? normalizeKeys(keys) : "";
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

export const useAppHotkeys = (
  hotkeys?: string[],
  reservedHotkeys?: string[],
) => {
  const actionMap = useMemo(() => {
    const map = new Map<string, string>();
    const reservedIds = new Set(
      reservedHotkeys
        ?.map((hotkey) => parseHotkeyText(hotkey)?.id)
        .filter(Boolean),
    );

    hotkeys?.forEach((hotkey) => {
      const parsed = parseHotkeyText(hotkey);
      if (parsed && !reservedIds.has(parsed.id)) {
        map.set(parsed.id, parsed.func);
      }
    });

    return map;
  }, [hotkeys, reservedHotkeys]);

  const actionMapRef = useRef(actionMap);
  actionMapRef.current = actionMap;

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) return;

      const func = actionMapRef.current.get(getEventHotkeyId(event));
      if (!func) return;

      event.preventDefault();
      event.stopPropagation();

      await dispatchHotkeyAction(func).catch((err) => {
        console.error(err);
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
