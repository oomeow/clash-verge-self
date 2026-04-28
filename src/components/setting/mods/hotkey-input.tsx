import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { alpha, Box, IconButton, styled } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotice } from "@/components/base/notifies";
import getSystem from "@/utils/get-system";
import {
  formatHotkeyKey,
  MODIFIER_KEYS,
  parseHotkey,
  sortKeys,
} from "@/utils/parse-hotkey";

const OS = getSystem();

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
    color: theme.palette.primary.contrastText,
    height: "24px",
    minWidth: "24px",
    fontSize: "14px",
    lineHeight: 1,
    borderRadius: "2px",
    padding: "2px 6px",
    backgroundColor: alpha(theme.palette.primary.main, 0.4),
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

  const modifierOnlyKeysRef = useRef<string[]>([]);
  const [keys, setKeys] = useState(value);

  useEffect(() => {
    modifierOnlyKeysRef.current = [];
    setKeys(sortKeys(value));
  }, [value]);

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <KeyWrapper>
        <input
          onKeyUp={() => {
            if (modifierOnlyKeysRef.current.length) {
              notice("error", t("pages.settings.verge.hotkeys.invalid"));
              modifierOnlyKeysRef.current = [];
              setKeys(sortKeys(value));
            }
          }}
          onKeyDown={(e) => {
            if (e.repeat) return;
            e.preventDefault();
            e.stopPropagation();

            const nextKeys = parseHotkey(e.nativeEvent);
            if (!nextKeys.length) return;

            setKeys(nextKeys);

            if (nextKeys.every((key) => MODIFIER_KEYS.includes(key))) {
              modifierOnlyKeysRef.current = nextKeys;
              return;
            }

            modifierOnlyKeysRef.current = [];
            onChange(nextKeys);
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
          modifierOnlyKeysRef.current = [];
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
