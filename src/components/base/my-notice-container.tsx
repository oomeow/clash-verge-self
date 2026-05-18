import Cancel from "@mui/icons-material/Cancel";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Close from "@mui/icons-material/Close";
import Info from "@mui/icons-material/Info";
import Warning from "@mui/icons-material/Warning";
import { ThemeProvider } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import { CustomContentProps, SnackbarContent, useSnackbar } from "notistack";
import { ForwardedRef, useCallback } from "react";

import { useThemeModeStore } from "@/stores";
import { cn } from "@/utils";

import { useCustomTheme } from "../layout/use-custom-theme";
import { CopyButton } from "./copy-button";

type MyNoticeContainerProps = CustomContentProps & {
  ref: ForwardedRef<HTMLDivElement>;
};

export const MyNoticeContainer = (props: MyNoticeContainerProps) => {
  const { ref, id, variant, message } = props;
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const { theme } = useCustomTheme();
  const { closeSnackbar } = useSnackbar();

  const handleDismiss = useCallback(() => {
    closeSnackbar(id);
  }, [id, closeSnackbar]);

  const icons = {
    default: CheckCircle,
    success: CheckCircle,
    info: Info,
    warning: Warning,
    error: Cancel,
  };
  const Icon = icons[variant];
  const defaultColor = themeMode === "dark" ? "#4B4B4B" : "#313131";
  const infoColor = theme.palette.info.main;
  const warningColor = theme.palette.warning.main;
  const successColor = theme.palette.success.main;
  const errorColor = theme.palette.error.main;

  let contentColor;
  switch (variant) {
    case "info":
      contentColor = infoColor;
      break;
    case "warning":
      contentColor = warningColor;
      break;
    case "success":
      contentColor = successColor;
      break;
    case "error":
      contentColor = errorColor;
      break;
    default:
      contentColor = defaultColor;
  }

  return (
    <ThemeProvider theme={theme}>
      <SnackbarContent
        ref={ref}
        className="max-w-125 overflow-hidden rounded-lg shadow-xl">
        <div
          style={{ backgroundColor: contentColor }}
          className={cn("flex w-full items-center p-3", {
            // "bg-[#313131] dark:bg-[#4B4B4B]": variant === "default",
            // "bg-[#43A047] dark:bg-[#16681B]": variant === "success",
            // "bg-[#2196F3] dark:bg-[#0B5E9E]": variant === "info",
            // "bg-[#FF9800] dark:bg-[#A66300]": variant === "warning",
            // "bg-[#D32F2F] dark:bg-[#890F0F]": variant === "error",
          })}>
          <div className="flex w-full items-center overflow-hidden">
            {variant !== "default" && <Icon className="fill-white!" />}
            <div className="mx-4 w-full overflow-hidden text-wrap wrap-break-word text-white">
              {message}
            </div>
            <div className="flex items-center">
              <CopyButton
                size="small"
                className="text-white!"
                content={message as string}
              />
              <IconButton size="small" onClick={handleDismiss}>
                <Close fontSize="small" className="fill-white!" />
              </IconButton>
            </div>
          </div>
        </div>
      </SnackbarContent>
    </ThemeProvider>
  );
};

MyNoticeContainer.displayName = "MyNoticeContainer";
