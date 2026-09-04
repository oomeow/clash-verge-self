import CheckCircle from "@mui/icons-material/CheckCircle";
import CircleOutlined from "@mui/icons-material/CircleOutlined";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Terminal from "@mui/icons-material/Terminal";
import {
  alpha,
  Badge,
  type BadgeProps,
  Box,
  CircularProgress,
  IconButton,
  styled,
  Tooltip,
} from "@mui/material";
import { t } from "i18next";
import { useRef, useState } from "react";

import { LogViewer } from "@/components/profile/log-viewer";
import type { LogMessage } from "@/components/profile/profile-more";
import { ProfileTypeChip } from "@/components/profile/profile-type-chip";
import { useProfilesStore } from "@/stores";
import { cn } from "@/utils";

import { Marquee } from "../base";
import { useCustomTheme } from "../layout/use-custom-theme";
import { ProfileViewer, type ProfileViewerRef } from "./profile-viewer";

interface Props {
  item: IProfileItem;
  isDragging?: boolean;
  reactivating?: boolean;
  selected: boolean;
  logs?: LogMessage[];
  onToggleEnableCallback?: (enable: boolean) => Promise<void>;
  onClick?: () => Promise<void>;
  onInfoChangeCallback?: () => Promise<void>;
  onDeleteCallback?: () => Promise<void>;
}

export default function ProfileMoreMini(props: Props) {
  const {
    item,
    isDragging,
    reactivating,
    selected,
    logs,
    onToggleEnableCallback,
    onClick,
    onInfoChangeCallback,
    onDeleteCallback,
  } = props;
  const viewerRef = useRef<ProfileViewerRef>(null);
  const patchProfile = useProfilesStore((s) => s.patchProfile);
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const [toggleEnabling, setToggleEnabling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const { theme } = useCustomTheme();

  const isScriptMerge = item.type === "script";
  const hasError = isScriptMerge && !!logs?.find((item) => item.exception);
  const showConsole = isScriptMerge && item.enable;
  const unselectedbackgroundColor = theme.palette.background.paper;
  const selectedBackgroundColor =
    theme.palette.mode === "light"
      ? alpha(theme.palette.primary.main, 0.25)
      : alpha(theme.palette.primary.main, 0.35);
  const draggingBackgroundColor =
    theme.palette.mode === "light"
      ? alpha(theme.palette.primary.main, 0.45)
      : alpha(theme.palette.primary.main, 0.55);

  return (
    <>
      <div className="bg-background-default my-2 h-14 w-full rounded-lg">
        <div
          style={{
            backgroundColor: item.enable
              ? isDragging
                ? draggingBackgroundColor
                : selectedBackgroundColor
              : isDragging
                ? draggingBackgroundColor
                : unselectedbackgroundColor,
          }}
          className={cn(
            "relative flex h-full w-full cursor-pointer items-center gap-1 overflow-hidden rounded-lg border border-(--divider-color) px-2 py-1 shadow-sm",
            {
              "border-primary border-0 border-l-2! border-solid":
                item.enable && !hasError,
              "animate-pulse border border-red-500":
                item.enable && hasError && !selected,
              "border-primary animate-highlight border border-solid": selected,
            },
          )}
          onClick={onClick}>
          <div className="flex h-full w-8 shrink-0 items-center justify-center">
            <IconButton
              loading={toggleEnabling}
              aria-label="toggle-enable"
              size="small"
              sx={{ width: 30, height: 30 }}
              onClick={async (event) => {
                event.stopPropagation();
                try {
                  setToggleEnabling(true);
                  const nextEnable = !item.enable;
                  await patchProfile(item.uid, { ...item, enable: nextEnable });
                  await onToggleEnableCallback?.(nextEnable);
                } finally {
                  setToggleEnabling(false);
                }
              }}>
              {!toggleEnabling && item.enable ? (
                <CheckCircle fontSize="small" color="primary" />
              ) : (
                <CircleOutlined fontSize="small" />
              )}
            </IconButton>
          </div>

          <div className="box-border flex h-full min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden text-sm">
            <div className="flex min-w-0 items-center gap-1.5">
              <ProfileTypeChip
                type={item.type}
                variant="enhance"
                density="compact"
              />
              <Marquee pauseOnHover className="text-text-primary min-w-0">
                <span className="font-medium">{item.name}</span>
              </Marquee>
            </div>
            <Marquee
              pauseOnHover
              className="text-text-secondary min-w-0 text-xs">
              <span>{item.desc || "-"}</span>
            </Marquee>
          </div>

          <div className="flex h-full shrink-0 items-center gap-0.5">
            <div className="flex h-6.5 w-6.5 items-center justify-center">
              {showConsole ? (
                <Tooltip
                  title={t("pages.profiles.runtime.console")}
                  placement="top">
                  <IconButton
                    aria-label="terminal"
                    size="small"
                    color={hasError ? "error" : "primary"}
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: "8px",
                      bgcolor: alpha(
                        hasError
                          ? theme.palette.error.main
                          : theme.palette.primary.main,
                        theme.palette.mode === "light" ? 0.1 : 0.18,
                      ),
                      "&:hover": {
                        bgcolor: alpha(
                          hasError
                            ? theme.palette.error.main
                            : theme.palette.primary.main,
                          theme.palette.mode === "light" ? 0.16 : 0.26,
                        ),
                      },
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setLogOpen(true);
                    }}>
                    {hasError ? (
                      <Badge color="error" variant="dot">
                        <Terminal fontSize="small" />
                      </Badge>
                    ) : (
                      <StyledBadge badgeContent={logs?.length} color="primary">
                        <Terminal fontSize="small" />
                      </StyledBadge>
                    )}
                  </IconButton>
                </Tooltip>
              ) : null}
            </div>

            <Tooltip title={t("common.actions.edit")} placement="top">
              <IconButton
                size="small"
                color="primary"
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: "8px",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  viewerRef.current?.edit(item);
                }}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={t("common.actions.delete")} placement="top">
              <IconButton
                aria-label="delete"
                size="small"
                color="error"
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: "8px",
                  "&:hover": {
                    bgcolor: alpha(
                      theme.palette.error.main,
                      theme.palette.mode === "light" ? 0.1 : 0.18,
                    ),
                  },
                }}
                onClick={async (event) => {
                  event.stopPropagation();
                  try {
                    setDeleting(true);
                    await deleteProfile(item.uid);
                    await onDeleteCallback?.();
                  } finally {
                    setDeleting(false);
                  }
                }}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>

          {(deleting || reactivating) && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "8px",
                backdropFilter: "blur(2px)",
              }}>
              <CircularProgress size={20} />
            </Box>
          )}
        </div>
      </div>

      <ProfileViewer
        ref={viewerRef}
        onChange={async () => await onInfoChangeCallback?.()}
      />

      {isScriptMerge && (
        <LogViewer
          open={logOpen}
          logInfo={logs || []}
          onClose={() => setLogOpen(false)}
        />
      )}
    </>
  );
}

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  "& .MuiBadge-badge": {
    right: 2,
    top: 4,
    height: 14,
    minWidth: 14,
    border: `1px solid ${theme.palette.background.paper}`,
    padding: "0 3px",
    fontSize: 9,
    lineHeight: "14px",
  },
}));
