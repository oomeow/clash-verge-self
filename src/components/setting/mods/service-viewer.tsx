import Check from "@mui/icons-material/Check";
import Close from "@mui/icons-material/Close";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import { BaseDialog, DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useService } from "@/hooks/use-service";
import { installService, uninstallService } from "@/services/cmds";
import { useVergeStore } from "@/stores";
import { getErrorMessage } from "@/utils";

interface Props {
  enable: boolean;
}

export const ServiceViewer = forwardRef<DialogRef, Props>((props, ref) => {
  const { enable } = props;

  const { t } = useTranslation();
  const { notice } = useNotice();
  const patchVerge = useVergeStore((s) => s.patchVerge);
  const [open, setOpen] = useState(false);

  const { serviceStatus, mutateCheckService } = useService();

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const state = serviceStatus != null ? serviceStatus : "pending";

  const onInstall = useLockFn(async () => {
    try {
      await installService();
      await mutateCheckService();
      setOpen(false);
      setTimeout(() => {
        mutateCheckService();
      }, 2000);
      notice("success", t("messages.settings.serviceInstalled"));
    } catch (err: unknown) {
      mutateCheckService();
      notice("error", getErrorMessage(err));
    }
  });

  const onUninstall = useLockFn(async () => {
    try {
      if (enable) {
        await patchVerge({ enable_service_mode: false });
      }

      await uninstallService();
      mutateCheckService();
      setOpen(false);
      notice("success", t("messages.settings.serviceUninstalled"));
    } catch (err: unknown) {
      mutateCheckService();
      notice("error", getErrorMessage(err));
    }
  });

  // fix unhandled error of the service mode
  const onDisable = useLockFn(async () => {
    try {
      await patchVerge({ enable_service_mode: false });
      mutateCheckService();
      setOpen(false);
    } catch (err: unknown) {
      mutateCheckService();
      notice("error", getErrorMessage(err));
    }
  });

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.clash.serviceMode.label")}
      maxWidth="xs"
      fullWidth
      contentStyle={{ userSelect: "text" }}
      hideFooter
      onClose={() => setOpen(false)}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 1,
        }}>
        {state === "active" || state === "installed" ? (
          <Check color="success" />
        ) : (
          <Close color="error" />
        )}
        <Box>
          <Typography
            sx={{
              "& span": {
                color: state === "active" ? "primary.main" : "text.primary",
              },
            }}>
            {t("pages.settings.clash.serviceMode.currentState")}:{" "}
            {t(`common.status.service.${state}`)}
          </Typography>
          {(state === "unknown" || state === "uninstall") && (
            <Typography
              sx={{
                mt: 1,
                fontSize: 14,
                color: "text.secondary",
              }}>
              {t("pages.settings.clash.serviceMode.info")}
            </Typography>
          )}
        </Box>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 4, justifyContent: "flex-end" }}>
        {state === "uninstall" && enable && (
          <Button variant="contained" onClick={onDisable}>
            {t("pages.settings.clash.serviceMode.disable")}
          </Button>
        )}

        {state === "uninstall" && (
          <Button variant="contained" onClick={onInstall}>
            {t("common.actions.install")}
          </Button>
        )}

        {(state === "active" || state === "installed") && (
          <Button variant="contained" color="error" onClick={onUninstall}>
            {t("common.actions.uninstall")}
          </Button>
        )}
      </Stack>
    </BaseDialog>
  );
});

export default ServiceViewer;
