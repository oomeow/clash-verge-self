import CheckCircle from "@mui/icons-material/CheckCircle";
import CloudSync from "@mui/icons-material/CloudSync";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import FileOpen from "@mui/icons-material/FileOpen";
import Home from "@mui/icons-material/Home";
import Refresh from "@mui/icons-material/Refresh";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import {
  alpha,
  Box,
  CircularProgress,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  SxProps,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Marquee } from "@/components/base";
import { ProfileEditorViewer } from "@/components/profile/profile-editor-viewer";
import { ProfileTypeChip } from "@/components/profile/profile-type-chip";
import { openWebUrl, viewProfile } from "@/services/cmds";
import { useLoadingCacheStore, useProfilesStore } from "@/stores";
import { cn, getErrorMessage } from "@/utils";
import parseTraffic from "@/utils/parse-traffic";

import { useNotice } from "../base/notifies";
import { ConfirmViewer } from "./confirm-viewer";
import { ProfileDiv } from "./profile-box";

const formatTraffic = (value: number) => parseTraffic(value).join(" ");

interface Props {
  sx?: SxProps;
  selected: boolean;
  isDragging?: boolean;
  activating: boolean;
  itemData: IProfileItem;
  onSelect: (uid: string) => void;
  onDelete: (uid: string) => void;
  onActivatedSave: () => void;
  selectMode?: boolean;
  multiSelected?: boolean;
}

export const ProfileItem = memo(function ProfileItem(props: Props) {
  const {
    sx,
    selected,
    isDragging,
    activating,
    itemData,
    onSelect,
    onDelete,
    onActivatedSave,
    selectMode,
    multiSelected,
  } = props;

  const { t } = useTranslation();
  const { notice } = useNotice();
  const updateProfile = useProfilesStore((s) => s.updateProfile);
  const [anchorEl, setAnchorEl] = useState<any>(null);
  if (anchorEl && isDragging) {
    setAnchorEl(null);
  }
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const loadingCache = useLoadingCacheStore((s) => s.loadingCache);
  const setLoading = useLoadingCacheStore((s) => s.setLoading);

  const { uid, name = "Profile", extra, updated = 0 } = itemData;
  // remote file mode
  const hasUrl = !!itemData.url;
  const hasExtra = !!extra; // only subscription url has extra info
  const hasHome = !!itemData.home; // only subscription url has home page
  const { upload = 0, download = 0, total = 0 } = extra ?? {};
  const from = parseUrl(itemData.url);
  const description = itemData.desc;
  const expire = parseExpire(extra?.expire);
  const progress = Math.min(
    Math.round(((download + upload) * 100) / (total + 0.1)),
    100,
  );
  const hasUsage = hasExtra && total > 0;
  const descriptionText = description || "-";
  const fromText = hasUrl ? from : "-";
  const updatedText =
    hasUrl && updated > 0 ? dayjs(updated * 1000).fromNow() : "-";
  const totalText = hasUsage
    ? `${formatTraffic(upload + download)} / ${formatTraffic(total)}`
    : "-";
  const expireText = hasExtra ? expire : parseExpire(updated);

  const loading = loadingCache[uid] || false;

  // interval update fromNow field
  const [, setRefresh] = useState({});
  useEffect(() => {
    if (!hasUrl) return;
    let timer: any = null;
    const handler = () => {
      const now = Date.now();
      const lastUpdate = updated * 1000;
      // 大于一天的不管
      if (now - lastUpdate >= 24 * 36e5) return;
      const wait = now - lastUpdate >= 36e5 ? 30e5 : 5e4;
      timer = setTimeout(() => {
        setRefresh({});
        handler();
      }, wait);
    };
    handler();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hasUrl, updated]);

  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onOpenHome = () => {
    setAnchorEl(null);
    openWebUrl(itemData.home ?? "");
  };

  const onEdit = () => {
    setAnchorEl(null);
    setOpen(true);
  };

  const onForceSelect = async () => {
    setAnchorEl(null);
    onSelect(uid);
  };

  const onOpenFile = useLockFn(async () => {
    setAnchorEl(null);
    try {
      await viewProfile(uid);
    } catch (err: unknown) {
      notice("error", getErrorMessage(err));
    }
  });

  /// 0 不使用任何代理
  /// 1 使用订阅好的代理
  /// 2 至少使用一个代理，根据订阅，如果没订阅，默认使用系统代理
  const onUpdate = useLockFn(async (type: 0 | 1 | 2) => {
    setAnchorEl(null);
    setLoading(uid, true);

    const option: Partial<IProfileOption> = {};

    if (type === 0) {
      option.with_proxy = false;
      option.self_proxy = false;
    } else if (type === 1) {
      // nothing
    } else if (type === 2) {
      if (itemData.option?.self_proxy) {
        option.with_proxy = false;
        option.self_proxy = true;
      } else {
        option.with_proxy = true;
        option.self_proxy = false;
      }
    }

    try {
      await updateProfile(uid, option);
    } catch (err: unknown) {
      const errmsg = getErrorMessage(err);
      notice(
        "error",
        errmsg.replace(/error sending request for url (\S+?): /, ""),
      );
    } finally {
      useLoadingCacheStore.getState().setLoading(uid, false);
    }
  });

  const menus = [
    {
      label: "common.actions.select",
      icon: <CheckCircle fontSize="small" />,
      handler: onForceSelect,
    },
    {
      label: "common.actions.edit",
      icon: <Edit fontSize="small" />,
      handler: onEdit,
    },
    {
      label: "pages.profiles.actions.openFile",
      icon: <FileOpen fontSize="small" />,
      handler: onOpenFile,
    },
  ];

  if (hasUrl) {
    menus.push({
      label: "common.actions.update",
      icon: <Refresh fontSize="small" />,
      handler: () => onUpdate(0),
    });
    menus.push({
      label: "pages.profiles.actions.updateProxy",
      icon: <CloudSync fontSize="small" />,
      handler: () => onUpdate(2),
    });
    if (hasHome) {
      menus.splice(1, 0, {
        label: "pages.profiles.actions.home",
        icon: <Home fontSize="small" />,
        handler: onOpenHome,
      });
    }
  }
  menus.push({
    label: "common.actions.delete",
    icon: <Delete fontSize="small" color="error" />,
    handler: () => {
      setAnchorEl(null);
      setConfirmOpen(true);
    },
  });

  const boxStyle = {
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const infoLabelStyle = {
    flex: "0 0 auto",
    maxWidth: 54,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: "18px",
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as const;

  return (
    <Box
      className={cn(selectMode ? "animate-shake" : undefined)}
      sx={(theme) => {
        const isLight = theme.palette.mode === "light";
        return {
          width: "100%",
          bgcolor: theme.palette.background.default,
          borderRadius: "12px",
          boxShadow: isLight
            ? "0 1px 3px rgba(0,0,0,0.08)"
            : "0 1px 4px rgba(0,0,0,0.24)",
          ...(selectMode && {
            filter: "saturate(0.75)",
            opacity: 0.85,
          }),
          ...(multiSelected && {
            filter: "saturate(1)",
            opacity: 1,
            boxShadow: `0 0 0 2px ${theme.palette.primary.main}, 0 2px 6px ${alpha(theme.palette.primary.main, 0.2)}`,
          }),
          ...{ sx },
        };
      }}>
      <ProfileDiv
        aria-label={isDragging ? "dragging" : "profile"}
        aria-selected={selected}
        onClick={() => onSelect(uid)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (selectMode) return;
          const { clientX, clientY } = event;
          setPosition({ top: clientY, left: clientX });
          setAnchorEl(event.currentTarget);
        }}>
        {activating && (
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
              borderRadius: "12px",
              backdropFilter: "blur(2px)",
            }}>
            <CircularProgress size={20} />
          </Box>
        )}
        {multiSelected && (
          <CheckCircle
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 10,
              fontSize: 22,
              color: "primary.main",
            }}
          />
        )}
        <Box sx={{ position: "relative", mb: 0.75 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              pr: hasUrl ? 4 : 0,
            }}>
            <ProfileTypeChip type={itemData.type} />
            <Marquee pauseOnHover>
              <Typography
                sx={{
                  fontSize: "17px",
                  fontWeight: 650,
                  lineHeight: "24px",
                }}
                variant="h6"
                component="h2"
                noWrap
                title={name}>
                {name}
              </Typography>
            </Marquee>
          </Box>

          {/* only if has url can it be updated */}
          {hasUrl && (
            <IconButton
              title={t("common.actions.refresh")}
              sx={{
                position: "absolute",
                p: "3px",
                top: -1,
                right: -5,
              }}
              size="small"
              color="inherit"
              disabled={loading || selectMode}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(1);
              }}>
              <RefreshRounded
                color="inherit"
                className={cn({
                  "animate-spin": loading,
                })}
              />
            </IconButton>
          )}
        </Box>
        {/* the second line shows description */}
        <Box sx={{ ...boxStyle, gap: 0.5 }}>
          <Typography
            component="span"
            sx={(theme) => ({
              ...infoLabelStyle,
              color: theme.palette.primary.main,
            })}>
            {t("common.fields.description")}:
          </Typography>
          <Typography
            noWrap
            title={descriptionText}
            sx={{
              minWidth: 0,
              flex: 1,
              fontSize: 11,
              fontWeight: description ? 600 : 400,
              textAlign: "left",
              color: "text.primary",
            }}>
            {descriptionText}
          </Typography>
        </Box>
        {/* the third line shows source and update time */}
        <Box sx={{ ...boxStyle, gap: 0.5 }}>
          <Typography
            component="span"
            sx={(theme) => ({
              ...infoLabelStyle,
              color: theme.palette.text.secondary,
            })}>
            {t("common.fields.from")}:
          </Typography>
          <Typography
            noWrap
            title={fromText}
            sx={{
              minWidth: 0,
              flex: 1,
              fontSize: 11,
              fontWeight: hasUrl ? 600 : 400,
              textAlign: "left",
              color: "text.secondary",
            }}>
            {fromText}
          </Typography>
          <Typography
            title={`${t("common.fields.updatedTime")}: ${parseExpire(updated)}`}
            sx={{
              flex: "0 0 auto",
              maxWidth: "45%",
              fontSize: 12,
              textAlign: "right",
            }}
            noWrap>
            {updatedText}
          </Typography>
        </Box>
        {/* the fourth line shows extra info or last updated time */}
        <Box sx={{ ...boxStyle, gap: 1, fontSize: 13 }}>
          <Typography
            component="span"
            noWrap
            title={t("common.fields.usedTotal")}
            sx={{ minWidth: 0, fontSize: "inherit", fontWeight: 600 }}>
            {totalText}
          </Typography>
          <Typography
            component="span"
            noWrap
            title={
              hasExtra
                ? t("common.fields.expireTime")
                : t("common.fields.updatedTime")
            }
            sx={{ flex: "0 0 auto", fontSize: "inherit" }}>
            {expireText}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={hasExtra ? progress : 0}
          sx={{
            height: 5,
            mt: 0.25,
            borderRadius: 999,
            bgcolor: "action.hover",
            opacity: hasExtra ? 1 : 0,
            "& .MuiLinearProgress-bar": { borderRadius: 999 },
          }}
        />
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
          e.preventDefault();
          setAnchorEl(null);
        }}>
        {menus.map((item) => (
          <MenuItem
            key={item.label}
            onClick={item.handler}
            sx={{ minWidth: 120 }}
            dense>
            <ListItemIcon className="text-primary!">{item.icon}</ListItemIcon>
            <ListItemText
              className={cn("text-primary", {
                "text-error": item.label === "common.actions.delete",
              })}>
              {t(item.label)}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
      <ProfileEditorViewer
        open={open}
        profileItem={itemData}
        type="clash"
        onChange={() => {
          if (selected) {
            onActivatedSave();
          }
        }}
        onClose={() => setOpen(false)}
      />
      <ConfirmViewer
        title={t("pages.profiles.dialog.confirmDeletion")}
        message={t("pages.profiles.dialog.confirmDeletionMessage")}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setAnchorEl(null);
          setConfirmOpen(false);
          onDelete(uid);
        }}
      />
    </Box>
  );
});

function parseUrl(url?: string) {
  if (!url) return "";
  return new URL(url).hostname;
}

function parseExpire(expire?: number) {
  if (!expire) return "-";
  return dayjs(expire * 1000).format("YYYY-MM-DD");
}
