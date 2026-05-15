import CloseRounded from "@mui/icons-material/CloseRounded";
import CropSquareRounded from "@mui/icons-material/CropSquareRounded";
import FilterNoneRounded from "@mui/icons-material/FilterNoneRounded";
import HorizontalRuleRounded from "@mui/icons-material/HorizontalRuleRounded";
import PushPinOutlined from "@mui/icons-material/PushPinOutlined";
import PushPinRounded from "@mui/icons-material/PushPinRounded";
import { Button, ButtonGroup } from "@mui/material";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { memo, useState } from "react";

const appWindow = getCurrentWebviewWindow();

interface Props {
  maximized: boolean;
  onClose: () => void;
}

const BTN_SX = {
  minWidth: 40,
  svg: { transform: "scale(0.9)" },
  transition: "background-color 0.15s",
};

export const LayoutControl = memo(function LayoutControl({
  maximized,
  onClose,
}: Props) {
  const [isPined, setIsPined] = useState(false);
  const [isHoverLocked, setIsHoverLocked] = useState(false);

  return (
    <ButtonGroup
      variant="text"
      onMouseEnter={() => setIsHoverLocked(false)}
      sx={{
        zIndex: 1000,
        height: "100%",
        ".MuiButtonGroup-grouped": {
          borderRadius: "0px",
          borderRight: "0px",
        },
      }}>
      <Button
        size="small"
        sx={{
          ...BTN_SX,
          color: isPined ? "primary.main" : undefined,
          "&:hover:not(:active)": {
            bgcolor: isHoverLocked ? undefined : "action.selected",
          },
        }}
        onClick={() => {
          setIsHoverLocked(true);
          appWindow.setAlwaysOnTop(!isPined);
          setIsPined((isPined) => !isPined);
        }}>
        {isPined ? (
          <PushPinRounded fontSize="small" />
        ) : (
          <PushPinOutlined fontSize="small" />
        )}
      </Button>

      <Button
        size="small"
        sx={{
          ...BTN_SX,
          "&:hover:not(:active)": {
            bgcolor: isHoverLocked ? undefined : "action.selected",
          },
        }}
        onClick={() => {
          setIsHoverLocked(true);
          appWindow.minimize();
        }}>
        <HorizontalRuleRounded fontSize="small" />
      </Button>

      <Button
        size="small"
        sx={{
          ...BTN_SX,
          "&:hover:not(:active)": {
            bgcolor: isHoverLocked ? undefined : "action.selected",
          },
        }}
        onClick={() => {
          setIsHoverLocked(true);
          appWindow.toggleMaximize();
        }}>
        {maximized ? (
          <FilterNoneRounded
            fontSize="small"
            style={{
              transform: "rotate(180deg) scale(0.7)",
            }}
          />
        ) : (
          <CropSquareRounded fontSize="small" />
        )}
      </Button>

      <Button
        size="small"
        aria-label="关闭"
        sx={{
          minWidth: 40,
          svg: { transform: "scale(1.05)" },
          transition: "background-color 0.15s",
          "&:hover:not(:active)": {
            bgcolor: isHoverLocked ? undefined : "#ff000090",
            color: isHoverLocked ? undefined : "#fff",
          },
        }}
        onClick={() => {
          setIsHoverLocked(true);
          onClose();
        }}>
        <CloseRounded fontSize="small" />
      </Button>
    </ButtonGroup>
  );
});
