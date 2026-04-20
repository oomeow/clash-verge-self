import { BaseDialog, DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { usePortable } from "@/hooks/use-portable";
import { useWindowSize } from "@/hooks/use-window-size";
import { useThemeModeStore, useAppUpdatingStore } from "@/stores";
import getSystem from "@/utils/get-system";
import { Box, Button, LinearProgress } from "@mui/material";
import { relaunch } from "@tauri-apps/plugin-process";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { check } from "@tauri-apps/plugin-updater";
import { useLockFn } from "ahooks";
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import MarkdownPreview from "@uiw/react-markdown-preview";

const OS = getSystem();

export const UpdateViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const [open, setOpen] = useState(false);
  const appUpdating = useAppUpdatingStore((s) => s.appUpdating);
  const setAppUpdating = useAppUpdatingStore((s) => s.setAppUpdating);
  const { size } = useWindowSize();
  const { portable } = usePortable();

  const { data: updateInfo } = useSWR("checkUpdate", check, {
    errorRetryCount: 2,
    revalidateIfStale: false,
    focusThrottleInterval: 36e5, // 1 hour
  });

  const [downloaded, setDownloaded] = useState(0);
  const [buffer, setBuffer] = useState(0);
  // default 10M
  const [total, setTotal] = useState(10 * 1024 * 1024);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const markdownContent = useMemo(() => {
    if (!updateInfo?.body) {
      return "New Version is available";
    }
    return updateInfo?.body;
  }, [updateInfo]);

  const breakChangeFlag = useMemo(() => {
    if (!updateInfo?.body) {
      return false;
    }
    return updateInfo?.body.toLowerCase().includes("break change");
  }, [updateInfo]);

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
      await updateInfo.downloadAndInstall((e) => {
        if (e.event === "Started") setTotal(e.data.contentLength || 100);
        if (e.event === "Progress") {
          const chunkLength = e.data.chunkLength;
          setBuffer(chunkLength);
          setDownloaded((prev) => {
            return prev + chunkLength;
          });
        }
      });
      await relaunch();
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      setAppUpdating(false);
    }
  });

  return (
    <BaseDialog
      open={open}
      title={
        <div className="flex justify-between">
          Clash Verge Self v{updateInfo?.version}
          <Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                openUrl(
                  `https://github.com/oomeow/clash-verge-self/releases/tag/v${updateInfo?.version}`,
                );
              }}>
              {t("pages.settings.verge.actions.goToReleasePage")}
            </Button>
          </Box>
        </div>
      }
      contentStyle={{ minWidth: 360, maxWidth: "60%" }}
      okBtn={t("common.actions.update")}
      cancelBtn={t("common.actions.cancel")}
      hideFooter={OS === "linux"}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onUpdate}>
      <div style={{ maxHeight: size.height - 260, overflow: "auto" }}>
        <MarkdownPreview
          className="p-4"
          source={markdownContent}
          wrapperElement={{ "data-color-mode": themeMode }}
          components={{
            a: ({ node, ...props }) => {
              const { children } = props;
              if (props.className === "anchor") return null;
              return (
                <a {...props} target="_blank">
                  {children}
                </a>
              );
            },
          }}
        />
      </div>
      <LinearProgress
        variant="buffer"
        value={(downloaded / total) * 100}
        valueBuffer={buffer}
        sx={{ marginTop: "10px", opacity: appUpdating ? 1 : 0 }}
      />
    </BaseDialog>
  );
});

export default UpdateViewer;
