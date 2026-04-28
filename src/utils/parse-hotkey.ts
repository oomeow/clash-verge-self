import getSystem from "./get-system";

const OS = getSystem();

export const MODIFIER_KEYS = ["CTRL", "OPTION", "ALT", "SHIFT", "CMD"];

const CODE_MAP: Record<string, string> = {
  BACKQUOTE: "`",
  BACKSLASH: "\\",
  BRACKETLEFT: "[",
  BRACKETRIGHT: "]",
  COMMA: ",",
  EQUAL: "=",
  MINUS: "-",
  PERIOD: ".",
  QUOTE: "'",
  SEMICOLON: ";",
  SLASH: "/",
};

const HOTKEY_LABELS: Record<string, string> = {
  BACKSPACE: OS === "macos" ? "⌫" : "Backspace",
  CAPSLOCK: OS === "macos" ? "⇪" : "Caps Lock",
  CMD:
    OS === "macos"
      ? "⌘"
      : OS === "windows"
        ? "Win"
        : OS === "linux"
          ? "Super"
          : "Meta",
  CTRL: OS === "macos" ? "⌃" : "Ctrl",
  DELETE: OS === "macos" ? "⌦" : "Del",
  DOWN: OS === "macos" ? "↓" : "Down",
  ENTER: OS === "macos" ? "↵" : "Enter",
  ESCAPE: "Esc",
  LEFT: OS === "macos" ? "←" : "Left",
  OPTION: OS === "macos" ? "⌥" : "Alt",
  PAGEUP: "Page Up",
  PAGEDOWN: "Page Down",
  RIGHT: OS === "macos" ? "→" : "Right",
  SHIFT: OS === "macos" ? "⇧" : "Shift",
  SPACE: "Space",
  TAB: OS === "macos" ? "⇥" : "Tab",
  UP: OS === "macos" ? "↑" : "Up",
};

type HotkeyText = {
  func: string;
  keys: string[];
  id: string;
};

const normalizeModifierKey = (key: string) => {
  switch (key.toUpperCase()) {
    case "CONTROL":
    case "CTRL":
      return "CTRL";
    case "ALT":
    case "OPTION":
      return OS === "macos" ? "OPTION" : "ALT";
    case "META":
    case "CMD":
      return "CMD";
    case "SHIFT":
      return "SHIFT";
    default:
      return null;
  }
};

const normalizeHotkeyKey = (key: string) => {
  const value = key.trim();
  if (!value) return "";
  if (value === "PLUS") return "+";

  return normalizeModifierKey(value) ?? value.toUpperCase();
};

export const sortKeys = (keys: string[]) => {
  const keySet = new Set(
    keys.map(normalizeHotkeyKey).filter((key) => key && key !== "UNIDENTIFIED"),
  );
  const modifiers = MODIFIER_KEYS.filter((key) => keySet.delete(key));
  const others = [...keySet].sort();

  return [...modifiers, ...others];
};

export const normalizeKeys = (keys: string[]) => sortKeys(keys).join("+");

export const formatHotkeyKey = (key: string) => HOTKEY_LABELS[key] ?? key;

export const formatHotkeyKeys = (keys: string[]) =>
  sortKeys(keys).map(formatHotkeyKey).join(" + ");

export const parseHotkeyText = (text: string): HotkeyText | null => {
  const [func, key] = text.split(",").map((item) => item.trim());
  if (!func || !key) return null;

  const keys = sortKeys(key.split("+"));
  if (!keys.length) return null;

  return { func, keys, id: normalizeKeys(keys) };
};

export const serializeHotkey = (func: string, keys: string[]) => {
  const key = sortKeys(keys)
    .map((item) => (item === "+" ? "PLUS" : item))
    .join("+");

  return func && key ? `${func},${key}` : "";
};

const parseKeyCode = (code: string) => {
  let key = code.toUpperCase();
  const mappedCode = CODE_MAP[key];
  if (mappedCode) return mappedCode;

  if (key.startsWith("KEY")) {
    key = key.slice(3);
  } else if (key.startsWith("DIGIT")) {
    key = key.slice(5);
  } else if (key.startsWith("ARROW")) {
    key = key.slice(5);
  } else if (key.endsWith("LEFT")) {
    key = key.slice(0, -4);
  } else if (key.endsWith("RIGHT")) {
    key = key.slice(0, -5);
  }

  return key;
};

export const parseHotkey = (event: KeyboardEvent) => {
  const keys: string[] = [];

  if (event.metaKey) keys.push("CMD");
  if (event.ctrlKey) keys.push("CTRL");
  if (event.altKey) keys.push(OS === "macos" ? "OPTION" : "ALT");
  if (event.shiftKey) keys.push("SHIFT");

  const key = parseKeyCode(event.code);
  if (!MODIFIER_KEYS.includes(normalizeHotkeyKey(key))) {
    keys.push(key);
  }

  return sortKeys(keys);
};

export const getHotkeyEventId = (event: KeyboardEvent) => {
  return normalizeKeys(parseHotkey(event));
};
