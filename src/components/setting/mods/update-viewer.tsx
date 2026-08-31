import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import RocketLaunchRounded from "@mui/icons-material/RocketLaunchRounded";
import { Button, LinearProgress } from "@mui/material";
import { relaunch } from "@tauri-apps/plugin-process";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import {
  type ComponentProps,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { BaseDialog, type DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { usePortable } from "@/hooks/use-portable";
import { useWindowSize } from "@/hooks/use-window-size";
import { useCheckUpdateSWR } from "@/services/swr";
import { useAppUpdatingStore, useThemeModeStore } from "@/stores";
import { getErrorMessage } from "@/utils";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// 静态 JSX 配置：提前到模块级，避免每次渲染重新创建对象
const markdownComponents = {
  a: ({ className, children, ...rest }: ComponentProps<"a">) =>
    className === "anchor" ? null : (
      <a {...rest} className={className} target="_blank">
        {children}
      </a>
    ),
} satisfies NonNullable<ComponentProps<typeof MarkdownPreview>["components"]>;

interface DownloadProgressHandle {
  report: (event: DownloadEvent) => void;
}

// 独立子组件：下载进度状态全部收敛在这里。Progress 事件高频触发时，
// 只有本组件的极小 DOM 子树重渲染，整个弹窗（含 MarkdownPreview）不受影响。
const DownloadProgress = forwardRef<
  DownloadProgressHandle,
  { active: boolean }
>(({ active }, ref) => {
  const { t } = useTranslation();
  const [downloaded, setDownloaded] = useState(0);
  const [buffer, setBuffer] = useState(0);
  // default 10M
  const [total, setTotal] = useState(10 * 1024 * 1024);

  useImperativeHandle(ref, () => ({
    report: (event: DownloadEvent) => {
      if (event.event === "Started") {
        setDownloaded(0);
        setBuffer(0);
        setTotal(event.data.contentLength || 100);
      } else if (event.event === "Progress") {
        const chunkLength = event.data.chunkLength;
        setBuffer(chunkLength);
        setDownloaded((prev) => prev + chunkLength);
      }
    },
  }));

  if (!active) return null;

  // `total` 为 100 是“未知总大小”的哨兵值，此时进度条转为不确定态
  const determinate = total > 100;
  const percent = determinate
    ? Math.min(100, Math.round((downloaded / total) * 100))
    : 0;

  return (
    <div className="border-primary/12 bg-background-default/60 flex flex-col gap-2 rounded-xl border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-secondary text-sm">
          {t(
            determinate
              ? "pages.settings.verge.updateViewer.downloading"
              : "pages.settings.verge.updateViewer.preparing",
          )}
        </span>
        {determinate && (
          <span className="text-text-primary text-sm font-semibold tabular-nums">
            {percent}%
          </span>
        )}
      </div>
      <LinearProgress
        variant={determinate ? "buffer" : "indeterminate"}
        value={determinate ? (downloaded / total) * 100 : undefined}
        valueBuffer={determinate ? buffer : undefined}
      />
      {determinate && (
        <div className="text-text-secondary text-xs tabular-nums">
          {formatBytes(downloaded)} / {formatBytes(total)}
        </div>
      )}
    </div>
  );
});

export const UpdateViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const [open, setOpen] = useState(false);
  const appUpdating = useAppUpdatingStore((s) => s.appUpdating);
  const setAppUpdating = useAppUpdatingStore((s) => s.setAppUpdating);
  const { size } = useWindowSize();
  const { portable } = usePortable();
  const progressRef = useRef<DownloadProgressHandle>(null);

  const { data: updateInfo } = useCheckUpdateSWR();

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const version = updateInfo?.version;
  const isPreview = version?.includes("-preview.") ?? false;
  const releaseDate = updateInfo?.date
    ? dayjs(updateInfo.date).format("YYYY/MM/DD")
    : "";

  const markdownContent =
    updateInfo?.body ?? t("pages.settings.verge.updateViewer.noNotes");

  const breakChangeFlag =
    updateInfo?.body?.toLowerCase().includes("break change") ?? false;

  // 下载进行中不允许关闭弹窗，避免用户在“已开始下载”的中间态失去进度反馈
  const close = () => {
    if (!appUpdating) setOpen(false);
  };

  const onUpdate = useLockFn(async () => {
    if (portable) {
      notice("error", t("messages.updater.portableError"));
      return;
    }
    if (!updateInfo?.body) return;
    if (breakChangeFlag) {
      notice("error", t("messages.updater.breakingChangeError"));
      return;
    }
    if (appUpdating) return;
    setAppUpdating(true);
    try {
      await updateInfo.downloadAndInstall((event) => {
        progressRef.current?.report(event);
      });
      await relaunch();
    } catch (err: unknown) {
      notice("error", getErrorMessage(err));
    } finally {
      setAppUpdating(false);
    }
  });

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.updateViewer.title")}
      fullWidth
      maxWidth="sm"
      okBtn={t("common.actions.update")}
      okDisabled={appUpdating}
      loading={appUpdating}
      cancelBtn={t("common.actions.cancel")}
      onClose={close}
      onCancel={close}
      onOk={onUpdate}>
      <div className="flex flex-col gap-4 pb-1">
        {/* 头部：版本 + 发布信息 + 前往发布页 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/12 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <RocketLaunchRounded fontSize="small" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-text-primary text-lg leading-6 font-semibold">
                  Clash Verge Self
                </span>
                {version && (
                  <span className="bg-primary/12 text-primary rounded-full px-2 py-0.5 font-mono text-xs font-semibold">
                    v{version}
                  </span>
                )}
                {isPreview && (
                  <span className="bg-warning/12 text-warning rounded-full px-2 py-0.5 text-xs font-medium">
                    {t("pages.settings.verge.updateViewer.preview")}
                  </span>
                )}
              </div>
              {releaseDate && (
                <div className="text-text-secondary mt-0.5 text-xs">
                  {t("pages.settings.verge.updateViewer.released", {
                    date: releaseDate,
                  })}
                </div>
              )}
            </div>
          </div>

          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewRounded fontSize="small" />}
            onClick={() => {
              openUrl(
                isPreview
                  ? "https://github.com/oomeow/clash-verge-self/releases/tag/preview"
                  : `https://github.com/oomeow/clash-verge-self/releases/tag/v${version}`,
              );
            }}>
            {t("pages.settings.verge.actions.goToReleasePage")}
          </Button>
        </div>

        {/* 更新内容 */}
        <div className="flex min-h-0 flex-col">
          <div className="text-text-secondary mb-2 text-xs font-semibold tracking-wider uppercase">
            {t("pages.settings.verge.updateViewer.whatsNew")}
          </div>
          <div
            className="border-divider bg-background-default min-h-0 overflow-auto rounded-xl border"
            style={{ maxHeight: Math.max(200, size.height - 380) }}>
            <MarkdownPreview
              className="p-4"
              source={markdownContent}
              wrapperElement={{ "data-color-mode": themeMode }}
              components={markdownComponents}
            />
          </div>
        </div>

        {/* 下载进度 */}
        <DownloadProgress ref={progressRef} active={appUpdating} />
      </div>
    </BaseDialog>
  );
});

export default UpdateViewer;
