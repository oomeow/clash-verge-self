import Check from "@mui/icons-material/Check";
import Delete from "@mui/icons-material/Delete";
import { Button, ButtonGroup, Chip } from "@mui/material";
import { useLockFn } from "ahooks";
import dayjs, { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import LinuxIcon from "@/assets/image/linux.svg?react";
import MacIcon from "@/assets/image/macos.svg?react";
import WindowsIcon from "@/assets/image/windows.svg?react";
import { BaseDialog, BaseEmpty, DialogRef, Marquee } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import {
  applyBackupAndReload,
  deleteBackup,
  listBackup,
} from "@/services/cmds";
import { sleep } from "@/utils";

dayjs.extend(customParseFormat);

type BackupFileItem = IBackupFile & {
  platform: string;
  type: "profiles" | "all";
  backupTime: Dayjs;
};

export type BackupSource = "webdav" | "local";

export interface BackupFilesViewerRef extends DialogRef {
  getAllBackupFiles: (source?: BackupSource) => Promise<void>;
}

export const BackupFilesViewer = forwardRef<BackupFilesViewerRef>(
  (_props, ref) => {
    const { t } = useTranslation();
    const { notice } = useNotice();
    const [open, setOpen] = useState(false);
    const [deletingFile, setDeletingFile] = useState("");
    const [applyingFile, setApplyingFile] = useState("");
    const [backupFiles, setBackupFiles] = useState<BackupFileItem[]>([]);
    const [filter, setFilter] = useState<"all" | "profiles">("all");
    const [source, setSource] = useState<BackupSource>("webdav");
    const filterBackupFiles = backupFiles.filter(
      (item) => item.type === filter,
    );

    useImperativeHandle(ref, () => ({
      open: () => {
        setOpen(true);
      },
      close: () => {
        setOpen(false);
      },
      getAllBackupFiles: (source) => getAllBackupFiles(source),
    }));

    const getAllBackupFiles = async (nextSource: BackupSource = source) => {
      setSource(nextSource);
      const files = await listBackup(nextSource);
      const backupFiles = files
        .map((file): BackupFileItem | null => {
          const platform = file.filename.split("-")[0];
          const type =
            file.filename.split("-")[1] === "profiles" ? "profiles" : "all";
          const fileBackupTimeStr = file.filename.match(
            /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/,
          );
          if (!fileBackupTimeStr) return null;
          const backupTime = dayjs(fileBackupTimeStr[0], "YYYY-MM-DD_HH-mm-ss");
          return {
            ...file,
            platform,
            type,
            backupTime,
          } as BackupFileItem;
        })
        .filter((file): file is BackupFileItem => Boolean(file))
        .sort((a, b) => (a.backupTime.isAfter(b.backupTime) ? -1 : 1));
      setBackupFiles(backupFiles);
    };

    const handleDeleteBackup = async (file: BackupFileItem) => {
      try {
        setDeletingFile(file.filename);
        await deleteBackup(source, file.filename);
        await getAllBackupFiles();
        notice("success", t("messages.backup.deleteSuccess"));
      } catch (e) {
        notice("error", t("messages.backup.deleteFailed", { error: e }));
      } finally {
        setDeletingFile("");
      }
    };

    const handleApplyBackup = useLockFn(async (file: BackupFileItem) => {
      try {
        setApplyingFile(file.filename);
        await applyBackupAndReload(source, file.filename);
        await sleep(1000);
        setApplyingFile("");
        notice("success", t("messages.backup.applySuccess"));
      } catch (ignore) {
        notice("error", t("messages.backup.applyFailed"));
        setApplyingFile("");
      }
    });

    return (
      <BaseDialog
        open={open}
        fullWidth
        contentStyle={{ width: 600 }}
        title={
          <div className="flex items-center justify-between">
            {t("pages.settings.verge.backup.files")}
            <ButtonGroup size="small" variant="outlined">
              <Button
                variant={filter === "all" ? "contained" : "outlined"}
                onClick={() => setFilter("all")}>
                {t("pages.settings.verge.backup.scopes.all")}
              </Button>
              <Button
                variant={filter === "profiles" ? "contained" : "outlined"}
                onClick={() => setFilter("profiles")}>
                {t("pages.settings.verge.backup.scopes.profiles")}
              </Button>
            </ButtonGroup>
          </div>
        }
        hideOkBtn
        cancelBtn={t("common.actions.back")}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}>
        <div className="h-full w-full items-center justify-center">
          {filterBackupFiles.length > 0 ? (
            <div>
              {filterBackupFiles.map((file) => (
                <div
                  className="bg-primary/10 my-2 flex items-center justify-between rounded-md px-2 py-1"
                  key={file.href}>
                  <div className="mr-2 shrink-0 grow-0 basis-10 p-1">
                    {file.platform === "windows" ? (
                      <WindowsIcon className="h-full w-full" />
                    ) : file.platform === "linux" ? (
                      <LinuxIcon className="h-full w-full" />
                    ) : (
                      <MacIcon className="h-full w-full" />
                    )}
                  </div>
                  <div className="mr-2 flex grow flex-col justify-center space-y-2! overflow-hidden py-1">
                    <Marquee pauseOnHover>
                      <span>{file.filename}</span>
                    </Marquee>
                    <div>
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={
                          file.type === "profiles"
                            ? t("pages.settings.verge.backup.scopes.profiles")
                            : t("pages.settings.verge.backup.scopes.all")
                        }
                      />
                      <span className="ml-4 text-xs text-gray-500 dark:text-gray-400">
                        {file.backupTime.fromNow()}
                      </span>
                    </div>
                  </div>
                  <Button
                    sx={{ mr: 1, minWidth: "80px" }}
                    disabled={applyingFile === file.filename}
                    loading={deletingFile === file.filename}
                    onClick={() => handleDeleteBackup(file)}
                    variant="contained"
                    color="error"
                    size="small"
                    loadingPosition="start"
                    startIcon={<Delete />}>
                    {t("common.actions.delete")}
                  </Button>
                  <div>
                    <Button
                      sx={{ minWidth: "80px" }}
                      disabled={deletingFile === file.filename}
                      loading={applyingFile === file.filename}
                      onClick={() => handleApplyBackup(file)}
                      variant="contained"
                      size="small"
                      loadingPosition="start"
                      startIcon={<Check />}>
                      {t("common.actions.apply")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BaseEmpty />
          )}
        </div>
      </BaseDialog>
    );
  },
);

export default BackupFilesViewer;
