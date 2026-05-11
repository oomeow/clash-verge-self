import Block from "@mui/icons-material/Block";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import FileOpen from "@mui/icons-material/FileOpen";
import Terminal from "@mui/icons-material/Terminal";
import {
  alpha,
  Badge,
  BadgeProps,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  styled,
  SxProps,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Marquee } from "@/components/base";
import { LogViewer } from "@/components/profile/log-viewer";
import { ProfileEditorViewer } from "@/components/profile/profile-editor-viewer";
import { viewProfile } from "@/services/cmds";
import { useThemeModeStore } from "@/stores";
import { cn } from "@/utils";

import { useNotice } from "../base/notifies";
import { ConfirmViewer } from "./confirm-viewer";
import { ProfileDiv } from "./profile-box";

const enhanceTypeLabel: Record<"merge" | "script", string> = {
  merge: "Merge",
  script: "JS",
};

export interface LogMessage {
  method: string;
  data: string[];
  exception?: string | null;
}

interface Props {
  sx?: SxProps;
  selected: boolean;
  isDragging?: boolean;
  itemData: IProfileItem;
  logs?: LogMessage[];
  reactivating: boolean;
  onToggleEnable: (uid: string, enable: boolean) => void;
  onDelete?: (item: IProfileItem) => Promise<void>;
  onActivatedSave: () => void;
}

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  "& .MuiBadge-badge": {
    right: 1,
    top: 3,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: "0 4px",
  },
}));

// profile enhanced item
export const ProfileMore = memo(function ProfileMore(props: Props) {
  const {
    sx,
    selected,
    isDragging,
    itemData,
    logs = [],
    reactivating,
    onToggleEnable,
    onDelete,
    onActivatedSave,
  } = props;

  const { uid, type } = itemData;
  const { t } = useTranslation();
  const { notice } = useNotice();
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const [anchorEl, setAnchorEl] = useState<any>(null);
  if (anchorEl && isDragging) {
    setAnchorEl(null);
  }
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [fileOpen, setFileOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const onEditFile = () => {
    setAnchorEl(null);
    setFileOpen(true);
  };

  const onOpenFile = useLockFn(async () => {
    setAnchorEl(null);
    try {
      await viewProfile(uid);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  });

  const fnWrapper = (fn: () => void) => () => {
    setAnchorEl(null);
    return fn();
  };
  const hasError = !!logs.find((e) => e.exception);
  const isScript = type === "script";
  const typeLabel = enhanceTypeLabel[isScript ? "script" : "merge"];
  const showConsole = isScript && selected;
  const profileName = itemData.name || typeLabel;
  const description = itemData.desc || "-";

  const menus = [
    {
      label: "common.actions.enable",
      icon: <CheckCircle fontSize="small" />,
      handler: fnWrapper(async () => {
        setToggling(true);
        onToggleEnable(uid, true);
        setToggling(false);
      }),
    },
    {
      label: "common.actions.edit",
      icon: <Edit fontSize="small" />,
      handler: onEditFile,
    },
    {
      label: "pages.profiles.actions.openFile",
      icon: <FileOpen fontSize="small" />,
      handler: onOpenFile,
    },
    {
      label: "common.actions.delete",
      icon: <Delete fontSize="small" color="error" />,
      handler: () => {
        setAnchorEl(null);
        setConfirmOpen(true);
      },
    },
  ];

  if (selected) {
    menus.splice(0, 1, {
      label: "common.actions.disable",
      icon: <Block fontSize="small" />,
      handler: fnWrapper(async () => {
        setToggling(true);
        onToggleEnable(uid, false);
        setToggling(false);
      }),
    });
  }

  const boxStyle = {
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    lineHeight: 1,
  };

  return (
    <Box
      sx={{
        width: "100%",
        bgcolor: themeMode === "light" ? "#FFFFFF" : "#282A36",
        borderRadius: "8px",
        boxShadow:
          themeMode === "light"
            ? "0 1px 4px rgba(15, 23, 42, 0.08)"
            : "0 1px 4px rgba(0, 0, 0, 0.24)",
        ...sx,
      }}>
      <ProfileDiv
        aria-label={isDragging ? "dragging" : "script"}
        aria-selected={selected || itemData.enable}
        onDoubleClick={() => onEditFile()}
        onContextMenu={(event) => {
          const { clientX, clientY } = event;
          setPosition({ top: clientY, left: clientX });
          setAnchorEl(event.currentTarget);
          event.preventDefault();
        }}>
        {(reactivating || toggling) && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backdropFilter: "blur(2px)",
              borderRadius: "8px",
            }}>
            <CircularProgress size={20} />
          </Box>
        )}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            height: 30,
            mb: 0.5,
          }}>
          <Chip
            size="small"
            label={typeLabel}
            sx={(theme) => ({
              height: 20,
              borderRadius: "5px",
              fontSize: 11,
              fontWeight: 700,
              color: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              "& .MuiChip-label": { px: 0.75 },
            })}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Marquee pauseOnHover>
              <Typography
                title={profileName}
                variant="h6"
                component="h2"
                noWrap
                sx={{
                  fontSize: "17px",
                  fontWeight: 650,
                  lineHeight: "24px",
                }}>
                {profileName}
              </Typography>
            </Marquee>
          </Box>
          <Box sx={{ flex: "0 0 auto", width: 30, height: 30 }}>
            {showConsole ? (
              <IconButton
                size="small"
                edge="end"
                color={hasError ? "error" : "primary"}
                title={t("pages.profiles.runtime.scriptConsole")}
                sx={(theme) => ({
                  width: 30,
                  height: 30,
                  mr: -0.25,
                  borderRadius: "7px",
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
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  setLogOpen(true);
                }}>
                {hasError ? (
                  <Badge color="error" variant="dot">
                    <Terminal fontSize="small" />
                  </Badge>
                ) : (
                  <StyledBadge badgeContent={logs.length} color="primary">
                    <Terminal fontSize="small" />
                  </StyledBadge>
                )}
              </IconButton>
            ) : null}
          </Box>
        </Box>

        <Box sx={{ ...boxStyle, gap: 1 }}>
          <Typography
            noWrap
            title={description}
            sx={{
              minWidth: 0,
              flex: 1,
              fontSize: 13,
              opacity: itemData.desc ? 1 : 0.72,
            }}>
            {description}
          </Typography>
        </Box>
      </ProfileDiv>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorPosition={position}
        anchorReference="anchorPosition"
        transitionDuration={225}
        slotProps={{ list: { sx: { py: 0.5 } } }}
        onContextMenu={(e) => {
          setAnchorEl(null);
          e.preventDefault();
        }}>
        {menus
          .filter((item: any) => item.show !== false)
          .map((item) => (
            <MenuItem
              key={item.label}
              onClick={() => item.handler()}
              sx={{ minWidth: 120 }}
              dense>
              <ListItemIcon className="text-primary-main!">
                {item.icon}
              </ListItemIcon>
              <ListItemText
                className={cn("text-primary-main", {
                  "text-error-main": item.label === "common.actions.delete",
                })}>
                {t(item.label)}
              </ListItemText>
            </MenuItem>
          ))}
      </Menu>
      <ProfileEditorViewer
        open={fileOpen}
        profileItem={itemData}
        type={type === "merge" ? "merge" : "script"}
        onChange={() => {
          if (selected) {
            onActivatedSave();
          }
        }}
        onClose={() => setFileOpen(false)}
      />
      <ConfirmViewer
        title={t("pages.profiles.dialog.confirmDeletion")}
        message={t("pages.profiles.dialog.confirmDeletionMessage")}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          setToggling(true);
          await onDelete?.(itemData);
          setToggling(false);
        }}
      />
      {selected && (
        <LogViewer
          open={logOpen}
          logInfo={logs}
          onClose={() => setLogOpen(false)}
        />
      )}
    </Box>
  );
});
