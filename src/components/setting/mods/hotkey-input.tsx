import { useNotice } from "@/components/base/notifies";
import { MODIFIER_KEYS, normalizeKeyList } from "@/hooks/use-app-hotkeys";
import { parseHotkey } from "@/utils/parse-hotkey";
import getSystem from "@/utils/get-system";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { alpha, Box, IconButton, styled } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const OS = getSystem();

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

export const formatHotkeyKey = (key: string) => HOTKEY_LABELS[key] ?? key;

const KeyWrapper = styled("div")(({ theme }) => ({
  position: "relative",
  width: 165,
  minHeight: 36,

  "> input": {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 1,
    opacity: 0,
  },
  "> input:focus + .list": {
    borderColor: alpha(theme.palette.primary.main, 0.75),
  },
  ".list": {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    width: "100%",
    height: "100%",
    minHeight: 36,
    boxSizing: "border-box",
    padding: "3px 4px",
    border: "1px solid",
    borderRadius: 4,
    borderColor: alpha(theme.palette.text.secondary, 0.15),
    "&:last-child": {
      marginRight: 0,
    },
  },
  ".item": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.text.primary,
    height: "24px",
    minWidth: "24px",
    fontSize: "14px",
    lineHeight: 1,
    borderRadius: "2px",
    padding: "2px 6px",
    backgroundColor: "var(--background-color-alpha)",
    fontFamily:
      OS === "macos"
        ? "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        : "system-ui, sans-serif",
  },
}));

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  onDelete?: () => void;
}

export const HotkeyInput = (props: Props) => {
  const { value, onChange, onDelete } = props;
  const { t } = useTranslation();
  const { notice } = useNotice();

  const changeRef = useRef<string[]>([]);
  const [keys, setKeys] = useState(value);

  useEffect(() => {
    changeRef.current = [];
    setKeys(normalizeKeyList(value));
  }, [value]);

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <KeyWrapper>
        <input
          onKeyUp={() => {
            const ret = changeRef.current.slice();
            if (ret.length) {
              if (ret.every((key) => MODIFIER_KEYS.has(key))) {
                notice("error", t("pages.settings.verge.hotkeys.invalid"));
                changeRef.current = [];
                setKeys(normalizeKeyList(value));
                return;
              }

              onChange(ret);
              changeRef.current = [];
            }
          }}
          onKeyDown={(e) => {
            e.preventDefault();
            e.stopPropagation();

            const evt = e.nativeEvent;
            const key = parseHotkey(evt.code);
            if (key === "UNIDENTIFIED") return;

            const isModifier = MODIFIER_KEYS.has(key);
            const hasNonModifier = changeRef.current.some(
              (k) => !MODIFIER_KEYS.has(k),
            );

            if (!isModifier && hasNonModifier) return;

            changeRef.current = normalizeKeyList([...changeRef.current, key]);
            setKeys(changeRef.current);
          }}
        />

        <div className="list">
          {keys.map((key) => (
            <div key={key} className="item">
              {formatHotkeyKey(key)}
            </div>
          ))}
        </div>
      </KeyWrapper>

      <IconButton
        size="small"
        title="Delete"
        color="inherit"
        onClick={() => {
          changeRef.current = [];
          setKeys([]);
          onDelete?.();
          if (!onDelete) {
            onChange([]);
          }
        }}>
        <DeleteRounded fontSize="inherit" />
      </IconButton>
    </Box>
  );
};
