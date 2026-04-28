import { useEffect, useMemo, useRef } from "react";

import { dispatchHotkeyAction } from "@/services/cmds";
import { getHotkeyEventId, parseHotkeyText } from "@/utils/parse-hotkey";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

export const useAppHotkeys = (hotkeys?: string[]) => {
  const actionMap = useMemo(() => {
    const map = new Map<string, string>();

    hotkeys?.forEach((hotkey) => {
      const parsed = parseHotkeyText(hotkey);
      if (parsed) {
        map.set(parsed.id, parsed.func);
      }
    });

    return map;
  }, [hotkeys]);

  const actionMapRef = useRef(actionMap);
  actionMapRef.current = actionMap;

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) return;

      const func = actionMapRef.current.get(getHotkeyEventId(event));
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
