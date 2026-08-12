import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  SxProps,
} from "@mui/material";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { t } from "i18next";
import {
  CSSProperties,
  isValidElement,
  ReactNode,
  useEffect,
  useRef,
} from "react";

import { useVergeStore } from "@/stores";
import { cn } from "@/utils";
import getSystem from "@/utils/get-system";

const OS = getSystem();

type DialogMaxWidth = "xs" | "sm" | "md" | "lg" | "xl" | false;

interface BaseDialogProps {
  title: ReactNode;
  open: boolean;
  full?: boolean;
  fullWidth?: boolean;
  maxWidth?: DialogMaxWidth;
  okBtn?: ReactNode;
  okDisabled?: boolean;
  cancelBtn?: ReactNode;
  hideOkBtn?: boolean;
  hideCancelBtn?: boolean;
  hideCloseBtn?: boolean;
  hideFooter?: boolean;
  contentStyle?: CSSProperties;
  contentSx?: SxProps;
  children?: ReactNode;
  loading?: boolean;
  onOk?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export interface DialogRef {
  open: () => void;
  close: () => void;
}

export const BaseDialog = (props: BaseDialogProps) => {
  const {
    title,
    open,
    full = false,
    fullWidth = false,
    maxWidth = "xs",
    okBtn = t("common.actions.confirm"),
    okDisabled = false,
    cancelBtn = t("common.actions.cancel"),
    hideOkBtn = false,
    hideCancelBtn = false,
    hideCloseBtn = true,
    hideFooter = false,
    contentStyle,
    contentSx,
    children,
    loading,
    onOk,
    onCancel,
    onClose,
  } = props;
  const enableSystemTitleBar = useVergeStore(
    (s) => s.verge.enable_system_title_bar ?? false,
  );
  const titlebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!titlebarRef.current || !full) return;
    titlebarRef.current?.addEventListener("mousedown", (e) => {
      if (e.buttons === 1) {
        const appWindow = getCurrentWindow();
        if (e.detail === 2) {
          appWindow.toggleMaximize();
        } else {
          appWindow.startDragging();
        }
      }
    });
  }, [full]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={full}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      slotProps={{
        backdrop: {
          className: cn({ "bg-black/50": !full }),
        },
        paper: {
          className: cn(
            "m-0 rounded-xl",
            full && "h-full max-h-full w-full max-w-full",
          ),
          style: {
            backgroundImage: "var(--mui-overlays-24)",
            ...contentStyle,
          },
        },
      }}
      className={cn({
        "rounded-md border-2 border-solid border-(--divider-color)":
          OS === "linux" && !enableSystemTitleBar,
      })}>
      <DialogTitle
        ref={titlebarRef}
        className={cn("px-6 py-4 text-xl font-bold", {
          "pt-6": full && OS === "macos",
        })}
        sx={{ cursor: full ? "default" : undefined }}>
        {!hideCloseBtn ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">{title}</div>
            <IconButton
              size="small"
              color="inherit"
              onClick={onClose}
              className="ml-2 shrink-0">
              <CloseRounded fontSize="small" />
            </IconButton>
          </div>
        ) : (
          title
        )}
      </DialogTitle>
      <DialogContent className="px-6" sx={contentSx}>
        {children}
      </DialogContent>
      {!hideFooter && (!hideCancelBtn || !hideOkBtn) && (
        <DialogActions className="my-2 justify-end px-6">
          <Stack direction="row" spacing={1}>
            {!hideCancelBtn &&
              (isValidElement(cancelBtn) ? (
                cancelBtn
              ) : (
                <Button variant="outlined" onClick={onCancel}>
                  {cancelBtn}
                </Button>
              ))}
            {!hideOkBtn &&
              (isValidElement(okBtn) ? (
                okBtn
              ) : (
                <Button
                  disabled={okDisabled}
                  loading={loading}
                  variant="contained"
                  onClick={onOk}>
                  {okBtn}
                </Button>
              ))}
          </Stack>
        </DialogActions>
      )}
    </Dialog>
  );
};
