import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import DownloadDoneIcon from "@mui/icons-material/DownloadDone";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useLockFn } from "ahooks";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { BaseDialog, type DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { ConfirmViewer } from "@/components/profile/confirm-viewer";
import { useMihomoCoresInfo } from "@/hooks/use-mihomo-cores-info";
import {
  cancelMihomoDownload,
  deleteMihomoDownload,
  deleteMihomoIndexCache,
  installMihomoDownload,
  installMihomoVersion,
  type MihomoAsset,
  type MihomoVersion,
} from "@/services/cmds";
import { useMihomoDownloadsSWR, useMihomoVersionsSWR } from "@/services/swr";
import { useVergeStore } from "@/stores";

type ChannelFilter = "all" | "stable" | "alpha" | "nightly";

// mihomo 没有 nightly 版本，仅保留 all/stable/alpha 频道。
const CHANNELS: ChannelFilter[] = ["all", "stable", "alpha"];

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const slotOf = (version: MihomoVersion) =>
  version.channel === "alpha" || version.channel === "nightly"
    ? "self-mihomo-alpha"
    : "self-mihomo";

// 槽位对应的频道标签（self-mihomo → stable，self-mihomo-alpha → alpha）
const slotChannel = (slot: string) =>
  slot === "self-mihomo-alpha" ? "alpha" : "stable";

const baseNameOf = (name: string) =>
  name.replace(/\.(tar\.gz|gz|zip|zst)$/i, "");

const assetBaseName = (asset: MihomoAsset) => baseNameOf(asset.name);

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// 更新时间显示到时分秒（如 2026/8/8 16:35:50）。
const formatTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : "";

const ellipsis = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

// 独立子组件：下载进度事件监听与 progress state 都收敛在这里，
// 高频进度事件只触发本组件（极小 DOM 子树）重渲染，避免整个弹窗列表卡顿。
const DownloadProgress = ({ installing }: { installing: boolean }) => {
  const [progress, setProgress] = useState<{
    tag: string;
    downloaded: number;
    total: number;
  } | null>(null);
  const { t } = useTranslation();
  const { notice } = useNotice();

  useEffect(() => {
    if (!installing) return;
    // 新一次下载开始，清掉上一次的进度残留。
    setProgress(null);
    let unlisten: UnlistenFn | undefined;
    listen<{ tag: string; downloaded: number; total: number }>(
      "mihomo-download-progress",
      (event) => {
        setProgress({
          tag: event.payload.tag,
          downloaded: event.payload.downloaded,
          total: event.payload.total,
        });
      },
    ).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, [installing]);

  if (!installing || !progress) return null;

  const progressPercent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : 0;

  const onCancelDownload = async () => {
    if (!progress) return;
    try {
      await cancelMihomoDownload(progress.tag);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  };

  return (
    <Box sx={{ mb: 1, overflow: "hidden" }}>
      <Tooltip title={progress.tag} arrow>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontFamily: MONO,
            fontSize: 11,
            ...ellipsis,
            minWidth: 0,
          }}>
          {baseNameOf(progress.tag)}
        </Typography>
      </Tooltip>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 0.5,
        }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {progress.total > 0
            ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`
            : formatBytes(progress.downloaded)}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {progressPercent}%
          </Typography>
          <Tooltip title={t("common.actions.cancel")}>
            <IconButton size="small" onClick={onCancelDownload}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <LinearProgress variant="determinate" value={progressPercent} />
    </Box>
  );
};

export const MihomoVersionManager = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const patchVerge = useVergeStore((s) => s.patchVerge);
  const clashCore = useVergeStore((s) => s.verge.clash_core ?? "self-mihomo");
  const channelLabel = (slot: string) =>
    t(`pages.settings.clash.versionManager.channel.${slotChannel(slot)}`);

  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [onlyDownloaded, setOnlyDownloaded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<MihomoVersion | null>(
    null,
  );
  const [selectedAsset, setSelectedAsset] = useState<MihomoAsset | null>(null);
  const [installing, setInstalling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    asset: MihomoAsset;
    version: MihomoVersion;
  } | null>(null);

  const {
    data: versions,
    isLoading,
    mutate: mutateVersions,
  } = useMihomoVersionsSWR();
  const { data: downloads, mutate: mutateDownloads } = useMihomoDownloadsSWR();
  const { mihomoCoresInfo, muteMihomoCoresInfo } = useMihomoCoresInfo();

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      // 打开时重新拉取，确保数据是最新的；首次请求未完成时显示加载态。
      mutateVersions();
    },
    close: () => setOpen(false),
  }));

  const downloadedSet = useMemo(() => new Set(downloads ?? []), [downloads]);

  const installedBySlot = useMemo(() => {
    const map: Record<string, string> = {};
    (mihomoCoresInfo ?? []).forEach((info) => {
      if (info.version) map[info.core] = info.version;
    });
    return map;
  }, [mihomoCoresInfo]);

  const activeVersion = installedBySlot[clashCore];

  // alpha 已装版本只报短哈希（如 alpha-3h3248），与列表 tag 对不上时提示可能落后。
  const activeMismatch =
    clashCore === "self-mihomo-alpha" &&
    !!activeVersion &&
    !(versions ?? []).some(
      (v) =>
        v.channel === "alpha" &&
        (v.tag === activeVersion || v.semver === activeVersion),
    );

  const isCurrent = (version: MihomoVersion) => {
    // 仅当前激活槽位（clashCore）中的版本才标记为「当前版本」。
    if (slotOf(version) !== clashCore) return false;
    const installed = installedBySlot[clashCore];
    // 稳定版：已装版本号需与 tag/semver 精确一致（substring 会误匹配 v1.19.2 ↔ v1.19.29）。
    if (
      installed &&
      (installed === version.tag || installed === version.semver)
    )
      return true;
    // alpha 频道永远只有一个最新版本，且已装版本只报短哈希（如 alpha-3h3248），
    // 唯一可靠关键字是频道名 —— 用频道关键字判定为当前。
    return clashCore === "self-mihomo-alpha" && version.channel === "alpha";
  };

  const filtered = useMemo(() => {
    if (!versions) return [];
    const list = versions.filter(
      (v) =>
        v.channel !== "nightly" &&
        (channel === "all" || v.channel === channel) &&
        (!onlyDownloaded ||
          v.assets.some((a) => downloadedSet.has(assetBaseName(a)))),
    );
    // 预发布版本置顶；其余保持后端给定的新→旧顺序（Array#sort 稳定）。
    return list.sort((a, b) => {
      if (a.prerelease !== b.prerelease) return a.prerelease ? -1 : 1;
      return 0;
    });
  }, [versions, channel, onlyDownloaded, downloadedSet]);

  const onSelectVersion = (version: MihomoVersion) => {
    if (selectedVersion?.tag === version.tag) {
      setSelectedVersion(null);
      setSelectedAsset(null);
      return;
    }
    setSelectedVersion(version);
    setSelectedAsset(version.assets[0] ?? null);
  };

  const selectedDownloaded =
    !!selectedAsset && downloadedSet.has(assetBaseName(selectedAsset));

  const onInstall = useLockFn(async () => {
    if (!selectedVersion || !selectedAsset) return;
    try {
      setInstalling(true);
      // 已下载则直接从下载目录安装，跳过索引获取与下载。
      if (selectedDownloaded) {
        await installMihomoDownload(
          selectedAsset.name,
          slotOf(selectedVersion),
        );
      } else {
        await installMihomoVersion(selectedVersion.tag, selectedAsset.name);
      }
      const slot = slotOf(selectedVersion);
      patchVerge({ clash_core: slot });
      await Promise.all([
        mutateDownloads(),
        muteMihomoCoresInfo(),
        mutateVersions(),
      ]);
      notice(
        "success",
        t("messages.clash.core.versionInstalled", { tag: selectedVersion.tag }),
        1500,
      );
    } catch (err: any) {
      const msg = err.message || err.toString();
      if (msg.toLowerCase().includes("cancelled")) {
        notice(
          "info",
          t("pages.settings.clash.versionManager.downloadCancelled"),
          1000,
        );
      } else {
        notice("error", msg);
      }
    } finally {
      setInstalling(false);
    }
  });

  const onDelete = useLockFn(async (asset: MihomoAsset) => {
    try {
      await deleteMihomoDownload(asset.name);
      await mutateDownloads();
      notice("success", t("messages.clash.core.versionDeleted"), 1000);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      setDeleteTarget(null);
    }
  });

  const installLabel = installing
    ? t("pages.settings.clash.versionManager.installing")
    : selectedDownloaded
      ? t("common.actions.use")
      : t("pages.settings.clash.versionManager.downloadAndInstall");

  const targetSlot = selectedVersion ? slotOf(selectedVersion) : "";
  const replacesCurrent = targetSlot === clashCore;

  const renderVersion = (version: MihomoVersion) => {
    const current = isCurrent(version);
    const expanded = selectedVersion?.tag === version.tag;
    return (
      <Box key={version.tag}>
        <ListItemButton
          selected={expanded}
          sx={{ borderRadius: 1 }}
          onClick={() => onSelectVersion(version)}>
          <ListItemText
            primary={
              <Box
                component="span"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  minWidth: 0,
                }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, ...ellipsis }}>
                  {version.tag}
                </Typography>
                {current && (
                  <Chip
                    size="small"
                    color="primary"
                    label={t(
                      "pages.settings.clash.versionManager.currentVersion",
                    )}
                    sx={{ height: 18, fontSize: 10, flexShrink: 0 }}
                  />
                )}
                {version.prerelease && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t("pages.settings.clash.versionManager.prerelease")}
                    sx={{ height: 18, fontSize: 10, flexShrink: 0 }}
                  />
                )}
              </Box>
            }
            secondary={
              <Box
                component="span"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  color: "text.secondary",
                }}>
                <Typography variant="caption">
                  {version.published_at
                    ? new Date(version.published_at).toLocaleDateString()
                    : t("pages.settings.clash.versionManager.unknownDate")}
                </Typography>
                {version.updated_at &&
                  version.updated_at !== version.published_at && (
                    <>
                      <Typography variant="caption" sx={{ opacity: 0.5 }}>
                        ·
                      </Typography>
                      <Typography variant="caption">
                        {t("pages.settings.clash.versionManager.updatedDate")}{" "}
                        {formatTime(version.updated_at)}
                      </Typography>
                    </>
                  )}
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {version.assets.length}{" "}
                  {t("pages.settings.clash.versionManager.variants")}
                </Typography>
              </Box>
            }
          />
          <ListItemSecondaryAction>
            {expanded ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </ListItemSecondaryAction>
        </ListItemButton>

        <Collapse in={expanded} unmountOnExit timeout={200}>
          <List component="div" disablePadding sx={{ pl: 2.5 }}>
            {version.assets.map((asset) => {
              const active = selectedAsset?.name === asset.name;
              const downloaded = downloadedSet.has(assetBaseName(asset));
              return (
                <ListItemButton
                  key={asset.name}
                  selected={active}
                  sx={{ borderRadius: 1, py: 0.75, my: 0.5 }}
                  onClick={() => setSelectedAsset(asset)}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      alignSelf: "center",
                      mr: 0.5,
                      color: "text.secondary",
                    }}>
                    {active ? (
                      <RadioButtonCheckedIcon
                        color="primary"
                        fontSize="small"
                      />
                    ) : (
                      <RadioButtonUncheckedIcon fontSize="small" />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, pl: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: MONO,
                        fontSize: 13,
                        ...ellipsis,
                        minWidth: 0,
                      }}>
                      {asset.name}
                    </Typography>
                    {(asset.size || asset.updated_at) && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          minWidth: 0,
                          color: "text.secondary",
                          opacity: 0.75,
                        }}>
                        {asset.size && (
                          <Typography variant="caption">
                            {formatBytes(asset.size)}
                          </Typography>
                        )}
                        {asset.size && asset.updated_at && (
                          <Typography variant="caption" sx={{ opacity: 0.5 }}>
                            ·
                          </Typography>
                        )}
                        {asset.updated_at && (
                          <Typography variant="caption" sx={{ ...ellipsis }}>
                            {t(
                              "pages.settings.clash.versionManager.updatedDate",
                            )}{" "}
                            {formatTime(asset.updated_at)}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                  <ListItemSecondaryAction>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {downloaded && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(
                            "pages.settings.clash.versionManager.downloaded",
                          )}
                          sx={{ height: 18, fontSize: 10 }}
                        />
                      )}
                      {downloaded && (
                        <Tooltip
                          title={
                            current
                              ? t(
                                  "pages.settings.clash.versionManager.cannotDeleteCurrent",
                                )
                              : t("common.actions.delete")
                          }
                          arrow>
                          <span>
                            <IconButton
                              size="small"
                              disabled={current}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteTarget({ asset, version });
                              }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </ListItemSecondaryAction>
                </ListItemButton>
              );
            })}
          </List>
        </Collapse>
      </Box>
    );
  };

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.clash.versionManager.title")}
      hideOkBtn
      hideCancelBtn
      maxWidth="sm"
      fullWidth
      contentStyle={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
      contentSx={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
      onClose={() => setOpen(false)}>
      <Alert
        severity="info"
        sx={{ mb: 1.5, py: 0, alignItems: "center", flexShrink: 0 }}>
        {t("pages.settings.clash.versionManager.activeCore", {
          slot: channelLabel(clashCore),
          version: activeVersion || "-",
        })}
      </Alert>

      {activeMismatch && (
        <Alert
          severity="warning"
          sx={{ mb: 1.5, py: 0, alignItems: "center", flexShrink: 0 }}>
          {t("pages.settings.clash.versionManager.behindLatest", {
            version: activeVersion,
          })}
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
          flexShrink: 0,
        }}>
        <Tabs
          value={channel}
          onChange={(_, value: ChannelFilter) => setChannel(value)}>
          {CHANNELS.map((c) => (
            <Tab
              key={c}
              label={t(`pages.settings.clash.versionManager.channel.${c}`)}
              value={c}
            />
          ))}
        </Tabs>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={onlyDownloaded}
                onChange={(e) => setOnlyDownloaded(e.target.checked)}
              />
            }
            label={t("pages.settings.clash.versionManager.onlyDownloaded")}
            sx={{ mr: 0 }}
          />
          <Tooltip title={t("common.actions.refresh")}>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={async () => {
                // 先清 index cache 再请求，确保拿到最新版本列表；
                // 清缓存失败不阻塞刷新（后端幂等，通常不会失败）
                try {
                  await deleteMihomoIndexCache();
                } catch {
                  // ignore
                }
                mutateVersions();
                mutateDownloads();
              }}>
              {t("common.actions.refresh")}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 6,
              height: "100%",
            }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 6,
              height: "100%",
              color: "text.secondary",
            }}>
            <Typography variant="body2">
              {t("pages.settings.clash.versionManager.empty")}
            </Typography>
          </Box>
        ) : (
          <List component="nav" sx={{ py: 0.5 }}>
            {filtered.map((version) => renderVersion(version))}
          </List>
        )}
      </Box>

      <Divider sx={{ my: 1.5, flexShrink: 0 }} />

      {selectedVersion && (
        <Alert
          severity={replacesCurrent ? "warning" : "info"}
          sx={{
            mb: 1.5,
            py: 0,
            alignItems: "center",
            flexShrink: 0,
          }}>
          {replacesCurrent
            ? t("pages.settings.clash.versionManager.replacesCurrent", {
                slot: channelLabel(targetSlot),
              })
            : t("pages.settings.clash.versionManager.switchSlot", {
                slot: channelLabel(targetSlot),
                current: channelLabel(clashCore),
              })}
        </Alert>
      )}

      <Box sx={{ flexShrink: 0 }}>
        <DownloadProgress installing={installing} />
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
          }}>
          <Typography
            variant="body2"
            sx={{
              ...ellipsis,
              minWidth: 0,
              opacity: selectedAsset ? 1 : 0.6,
            }}>
            {selectedVersion && selectedAsset
              ? t("pages.settings.clash.versionManager.selected", {
                  tag: selectedVersion.tag,
                  variant: selectedAsset.name,
                })
              : t("pages.settings.clash.versionManager.selectHint")}
          </Typography>
          <Button
            variant="contained"
            startIcon={
              selectedDownloaded ? <DownloadDoneIcon /> : <DownloadIcon />
            }
            disabled={!selectedAsset || installing}
            loading={installing}
            sx={{ flexShrink: 0 }}
            onClick={onInstall}>
            {installLabel}
          </Button>
        </Box>
      </Box>

      <ConfirmViewer
        open={!!deleteTarget}
        title={t("pages.settings.clash.versionManager.deleteConfirmTitle")}
        message={
          deleteTarget
            ? t("pages.settings.clash.versionManager.deleteConfirmMessage", {
                name: deleteTarget.asset.name,
              })
            : ""
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () =>
          deleteTarget && (await onDelete(deleteTarget.asset))
        }
      />
    </BaseDialog>
  );
});

export default MihomoVersionManager;
