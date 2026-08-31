import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import RocketLaunchRounded from "@mui/icons-material/RocketLaunchRounded";
import { Button, LinearProgress } from "@mui/material";
import { relaunch } from "@tauri-apps/plugin-process";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import {
  type ComponentProps,
  forwardRef,
  memo,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { BaseDialog, type DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { usePortable } from "@/hooks/use-portable";
import { useWindowSize } from "@/hooks/use-window-size";
import {
  cancelUpdateDownload,
  downloadUpdate,
  type UpdateDownloadEvent,
} from "@/services/cmds";
import { useCheckUpdateSWR } from "@/services/swr";
import { useAppUpdatingStore, useThemeModeStore } from "@/stores";
import { type ThemeMode } from "@/stores/themeStore";
import { getErrorMessage } from "@/utils";
import getSystem from "@/utils/get-system";

const isWindows = getSystem() === "windows";

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

// MarkdownPreview 重渲染代价较高（unified 管道 + 语法高亮）。独立成 memo 子组件：
// 窗口缩放（useWindowSize）、弹窗开关等无关的重渲染不会再次解析 markdown。
const ReleaseNotes = memo(
  ({ source, themeMode }: { source: string; themeMode: ThemeMode }) => (
    <MarkdownPreview
      className="p-4"
      source={source}
      wrapperElement={{ "data-color-mode": themeMode }}
      components={markdownComponents}
    />
  ),
);

interface DownloadProgressHandle {
  report: (event: UpdateDownloadEvent) => void;
  reset: () => void;
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
    report: (event: UpdateDownloadEvent) => {
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
    reset: () => {
      setDownloaded(0);
      setBuffer(0);
      setTotal(10 * 1024 * 1024);
    },
  }));

  if (!active) return null;

  // `total` 为 100 是“未知总大小”的哨兵值，此时进度条转为不确定态
  const determinate = total > 100;
  const progress = determinate ? Math.min(100, (downloaded / total) * 100) : 0;
  // 缓冲边缘 = 已下载 + 当前块大小，保证 valueBuffer >= value 且不越过 max
  const buffered = determinate
    ? Math.min(100, ((downloaded + buffer) / total) * 100)
    : 0;
  const percent = Math.round(progress);

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
        value={determinate ? progress : undefined}
        valueBuffer={determinate ? buffered : undefined}
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
  // 更新已安装，等待用户手动重启应用
  const [restartPending, setRestartPending] = useState(false);
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

  // 取消：下载中则中止下载；否则关闭弹窗
  const onCancel = () => {
    if (appUpdating) {
      cancelUpdateDownload();
    } else {
      close();
    }
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
    setRestartPending(false);
    try {
      const result = await downloadUpdate(updateInfo.rid, (event) => {
        progressRef.current?.report(event);
      });
      if (result.status === "done") {
        // Windows 下安装会自行退出并重启进程，无需显示手动重启按钮
        if (!isWindows) {
          setRestartPending(true);
        }
      } else if (result.status === "failed") {
        notice("error", result.message);
      }
    } catch (err: unknown) {
      notice("error", getErrorMessage(err));
    } finally {
      setAppUpdating(false);
      // 取消/失败/完成后清空进度显示，避免下一次下载残留旧数据
      progressRef.current?.reset();
    }
  });

  // 用户手动重启以应用已安装的更新
  const onRestart = useLockFn(async () => {
    if (!restartPending) return;
    try {
      await relaunch();
    } catch (err: unknown) {
      notice("error", getErrorMessage(err));
    }
  });

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.updateViewer.title")}
      fullWidth
      maxWidth="sm"
      okBtn={
        restartPending
          ? t("pages.settings.verge.updateViewer.restart")
          : t("common.actions.update")
      }
      okDisabled={appUpdating}
      loading={appUpdating}
      cancelBtn={
        restartPending
          ? t("pages.settings.verge.updateViewer.later")
          : t("common.actions.cancel")
      }
      onClose={close}
      onCancel={onCancel}
      onOk={restartPending ? onRestart : onUpdate}>
      <div className="flex flex-col gap-4 pb-1">
        {/* 已安装：提示用户手动重启以应用更新 */}
        {restartPending && (
          <div className="bg-success/10 text-success border-success/20 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium">
            {t("pages.settings.verge.updateViewer.installed")}
          </div>
        )}

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
            <ReleaseNotes source={markdownContent} themeMode={themeMode} />
          </div>
        </div>

        {/* 下载进度 */}
        <DownloadProgress ref={progressRef} active={appUpdating} />
      </div>
    </BaseDialog>
  );
});

export default UpdateViewer;
