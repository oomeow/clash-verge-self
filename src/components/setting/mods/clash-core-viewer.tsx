import MetaIcon from "@/assets/image/Meta.svg?react";
import { BaseDialog, DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifice";
import { useVerge } from "@/hooks/use-verge";
import {
  changeClashCore,
  checkPermissionsGranted,
  grantPermissions,
  refreshPermissionsGranted,
  restartSidecar,
} from "@/services/cmds";
import { cn } from "@/utils";
import getSystem from "@/utils/get-system";
import { RestartAlt, SwitchAccessShortcut } from "@mui/icons-material";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { useLockFn } from "ahooks";
import { debounce } from "lodash-es";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { PulseLoader } from "react-spinners";
import { mutate } from "swr";
import {
  closeAllConnections,
  MihomoWebSocket,
  upgradeCore,
} from "tauri-plugin-mihomo-api";
import { isPortable } from "@/pages/_layout";
import { useService } from "@/hooks/use-service";

interface Props {
  serviceActive: boolean;
}

const OS = getSystem();

export const ClashCoreViewer = forwardRef<DialogRef, Props>((props, ref) => {
  const { serviceActive } = props;
  const { t } = useTranslation();
  const { notice } = useNotice();
  const [mihomoCores, setMihomoCores] = useState([
    { name: "Mihomo", core: "verge-mihomo", permissions_granted: false },
    {
      name: "Mihomo Alpha",
      core: "verge-mihomo-alpha",
      permissions_granted: false,
    },
  ]);
  const { verge, mutateVerge } = useVerge();
  const [open, setOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [changingCore, setChangingCore] = useState(false);
  const { clash_core = "verge-mihomo" } = verge ?? {};
  const [currentCore, setCurrentCore] = useState(clash_core);
  const { serviceStatus } = useService();

  const showGrantPermissions =
    isPortable &&
    OS === "linux" &&
    (serviceStatus === "uninstall" || serviceStatus === "unknown");

  useEffect(() => {
    checkMihomoPermissionsGranted();
  }, []);

  const checkMihomoPermissionsGranted = useCallback(async () => {
    if (showGrantPermissions) {
      for (let core of mihomoCores) {
        const granted = await checkPermissionsGranted(core.core);
        setMihomoCores((prev) =>
          prev.map((c) =>
            c.core === core.core ? { ...c, permissions_granted: granted } : c,
          ),
        );
      }
    }
  }, [mihomoCores, showGrantPermissions]);

  const refreshMihomoPermissions = useCallback(async () => {
    if (showGrantPermissions) {
      await refreshPermissionsGranted();
      for (let core of mihomoCores) {
        await checkMihomoPermissionsGranted();
      }
    }
  }, [mihomoCores, showGrantPermissions]);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const onCoreChange = useLockFn(async (core: string) => {
    if (core === currentCore) return;

    try {
      setChangingCore(true);
      closeAllConnections();
      await changeClashCore(core);
      setCurrentCore(core);
      mutateVerge();
      await MihomoWebSocket.cleanupAll();
      setTimeout(() => {
        mutate("getClashConfig");
        mutate("getVersion");
      }, 1000);
      notice(
        "success",
        t("Switched to _clash Core", { core: `${core}` }),
        1000,
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      setChangingCore(false);
    }
  });

  const onGrant = useLockFn(async (core: string) => {
    try {
      await grantPermissions(core);
      // 自动重启
      if (core === currentCore) await restartSidecar();
      notice(
        "success",
        t("Permissions Granted Successfully for _clash Core", {
          core: `${core}`,
        }),
        1000,
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      await refreshMihomoPermissions();
    }
  });

  const onRestart = debounce(async () => {
    try {
      await restartSidecar();
      notice("success", t(`Clash Core Restarted`), 1000);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  }, 500);

  const onUpgrade = useLockFn(async () => {
    try {
      setUpgrading(true);
      await upgradeCore();
      setUpgrading(false);
      notice("success", t(`Core Version Updated`), 1000);
      setTimeout(async () => {
        await emit("verge://refresh-websocket");
      }, 2000);
    } catch (err: any) {
      setUpgrading(false);
      if (err.includes("already using latest version")) {
        notice("info", t("Currently on the Latest Version"), 1000);
      } else {
        notice("error", err.message || err.toString());
      }
    } finally {
      await refreshMihomoPermissions();
    }
  });

  return (
    <BaseDialog
      open={open}
      title={
        <Box display="flex" justifyContent="space-between">
          {t("Clash Core")}
          <Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<SwitchAccessShortcut />}
              loadingPosition="start"
              loading={upgrading}
              sx={{ marginRight: "8px" }}
              onClick={onUpgrade}>
              {t("Upgrade")}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={onRestart}
              startIcon={<RestartAlt />}>
              {t("Restart")}
            </Button>
          </Box>
        </Box>
      }
      hideOkBtn
      hideCancelBtn
      onClose={() => setOpen(false)}>
      <List component="nav">
        {mihomoCores.map((each) => (
          <ListItemButton
            key={each.core}
            selected={each.core === currentCore}
            onClick={async () => {
              await onCoreChange(each.core);
            }}>
            <ListItemIcon>
              <MetaIcon className="h-8 w-8" />
            </ListItemIcon>
            <ListItemText
              primary={
                <div className="inline-flex items-center">
                  <span>{each.name}</span>
                  {showGrantPermissions && (
                    <span
                      className={cn(
                        "ml-2 inline-block rounded-full bg-red-400 px-2 py-[2px] text-[10px] text-white",
                        {
                          "bg-primary-alpha text-primary-main":
                            each.permissions_granted,
                        },
                      )}>
                      {each.permissions_granted ? "已授权" : "未授权"}
                    </span>
                  )}
                </div>
              }
              secondary={`/${each.core}`}
            />
            {changingCore && each.core !== currentCore && (
              <PulseLoader
                className="mr-4"
                size={6}
                color="var(--primary-main)"
              />
            )}

            {showGrantPermissions && (
              <Tooltip title={t("Update core requires")}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onGrant(each.core);
                  }}>
                  {t("Grant")}
                </Button>
              </Tooltip>
            )}
          </ListItemButton>
        ))}
      </List>
    </BaseDialog>
  );
});
