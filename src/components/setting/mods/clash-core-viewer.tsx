import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import RestartAlt from "@mui/icons-material/RestartAlt";
import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { debounce } from "lodash-es";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PulseLoader } from "react-spinners";
import { closeAllConnections } from "tauri-plugin-mihomo-api";

import MetaIcon from "@/assets/image/Meta.svg?react";
import { BaseDialog, type DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useClash } from "@/hooks/use-clash";
import { useMihomoCoresInfo } from "@/hooks/use-mihomo-cores-info";
import { usePortable } from "@/hooks/use-portable";
import {
  changeClashCore,
  grantPermissions,
  restartSidecar,
} from "@/services/cmds";
import { useVergeStore } from "@/stores";
import getSystem from "@/utils/get-system";

import MihomoVersionManager from "./mihomo-version-manager";

interface Props {
  serviceActive: boolean;
}

const OS = getSystem();
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// const refreshMihomoWebSocketData = () => {
//   useRefreshTrafficDateStore.getState().refresh();
//   useRefreshMemoryDateStore.getState().refresh();
//   useRefreshConnectionDateStore.getState().refresh();
//   useRefreshLogsDateStore.getState().refresh();
// };

export const ClashCoreViewer = forwardRef<DialogRef, Props>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const clashCore = useVergeStore((s) => s.verge.clash_core ?? "self-mihomo");
  const patchVerge = useVergeStore((s) => s.patchVerge);
  const { clash } = useClash();
  const { tun } = clash ?? {};
  const [open, setOpen] = useState(false);
  const [changingCore, setChangingCore] = useState("");
  const versionManagerRef = useRef<DialogRef>(null);
  const { mihomoCoresInfo, enableGrantPermissions, muteMihomoCoresInfo } =
    useMihomoCoresInfo();

  const { portable } = usePortable();
  const isLinuxPortable = portable && OS === "linux";

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const onCoreChange = useLockFn(async (core: string) => {
    if (core === clashCore) return;
    if (isLinuxPortable) {
      const enableTun = tun?.enable ?? false;
      const permissionsGranted =
        mihomoCoresInfo.find((info) => info.core === core)
          ?.permissionsGranted ?? false;
      if (enableTun && !permissionsGranted) {
        notice(
          "warning",
          t("messages.clash.core.requireGrant", { core: `${core}` }),
        );
        return;
      }
    }

    try {
      setChangingCore(core);
      // await ManagedMihomoWebSocket.cleanupAll();
      await closeAllConnections().catch(() => undefined);
      await changeClashCore(core);
      patchVerge({ clash_core: core });
      // refreshMihomoWebSocketData();
      notice(
        "success",
        t("messages.clash.core.switched", { core: `${core}` }),
        1000,
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      setChangingCore("");
    }
  });

  const onGrant = useLockFn(async (core: string) => {
    try {
      await grantPermissions(core);
      // 自动重启
      if (core === clashCore) await restartSidecar();
      notice(
        "success",
        t("messages.clash.core.permissionsGranted", {
          core: `${core}`,
        }),
        1000,
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      muteMihomoCoresInfo();
      // await refreshMihomoPermissions();
    }
  });

  const onRestart = debounce(async () => {
    try {
      await restartSidecar();
      notice("success", t(`messages.clash.core.restarted`), 1000);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  }, 500);

  const onVersionManager = useLockFn(async () => {
    versionManagerRef.current?.open();
  });

  return (
    <>
      <BaseDialog
        open={open}
        title={
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
            }}>
            {t("pages.settings.clash.core.label")}
            <Box>
              <Button
                variant="contained"
                size="small"
                startIcon={<ManageSearchIcon />}
                sx={{ marginRight: "8px" }}
                onClick={onVersionManager}>
                {t("common.actions.versionManager")}
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={onRestart}
                startIcon={<RestartAlt />}>
                {t("common.actions.restart")}
              </Button>
            </Box>
          </Box>
        }
        hideOkBtn
        hideCancelBtn
        maxWidth="xs"
        fullWidth
        onClose={() => setOpen(false)}>
        <List component="nav">
          {mihomoCoresInfo.map((each) => {
            const active = each.core === clashCore;
            return (
              <ListItemButton
                sx={{ borderRadius: 1 }}
                key={each.core}
                selected={active}
                onClick={() => onCoreChange(each.core)}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <MetaIcon className="h-8 w-8" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box
                      component="span"
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {each.name}
                      </Typography>
                      {active && (
                        <Chip
                          size="small"
                          color="primary"
                          label={t("pages.settings.clash.core.inUse")}
                          sx={{ height: 18, fontSize: 10, flexShrink: 0 }}
                        />
                      )}
                      {enableGrantPermissions && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color={each.permissionsGranted ? "success" : "error"}
                          label={
                            each.permissionsGranted
                              ? t("common.status.granted")
                              : t("common.status.notGranted")
                          }
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
                        mt: 0.25,
                      }}>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontFamily: MONO }}>
                        {each.core}
                      </Typography>
                      {each.version && (
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", fontFamily: MONO }}>
                          {each.version}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                {changingCore === each.core && (
                  <PulseLoader
                    className="mr-4"
                    size={6}
                    color="var(--mui-palette-primary-main)"
                  />
                )}

                {enableGrantPermissions && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onGrant(each.core);
                    }}>
                    {each.permissionsGranted
                      ? t("common.actions.reGrant")
                      : t("common.actions.grant")}
                  </Button>
                )}
              </ListItemButton>
            );
          })}
        </List>
      </BaseDialog>
      <MihomoVersionManager ref={versionManagerRef} />
    </>
  );
});

export default ClashCoreViewer;
