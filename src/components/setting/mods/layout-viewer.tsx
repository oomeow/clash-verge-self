import { BaseDialog, DialogRef, SwitchLovely } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { GuardState } from "@/components/setting/mods/guard-state";
import { useVergeStore } from "@/stores";
import { copyIconFile, getAppDir } from "@/services/cmds";
import getSystem from "@/utils/get-system";
import InfoRounded from "@mui/icons-material/InfoRounded";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  styled,
  Tooltip,
} from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

const appWindow = getCurrentWebviewWindow();

export const LayoutViewer = forwardRef<DialogRef>((_props, ref) => {
  const OS = getSystem();
  const show_title_setting = OS === "linux" || OS === "windows";

  const { t } = useTranslation();
  const { notice } = useNotice();
  const {
    enableSystemTitleBar = false,
    enableKeepUiActive = false,
    keepInDock = false,
    trafficGraph = true,
    enableMemoryUsage = true,
    enableGroupIcon = true,
    menuIcon = "monochrome",
    enableTray = true,
    trayIcon = "monochrome",
    commonTrayIcon = false,
    sysproxyTrayIcon = false,
    tunTrayIcon = false,
  } = useVergeStore(
    useShallow((s) => ({
      enableSystemTitleBar: s.verge.enable_system_title_bar,
      enableKeepUiActive: s.verge.enable_keep_ui_active,
      keepInDock: s.verge.keep_in_dock,
      trafficGraph: s.verge.traffic_graph,
      enableMemoryUsage: s.verge.enable_memory_usage,
      enableGroupIcon: s.verge.enable_group_icon,
      menuIcon: s.verge.menu_icon,
      enableTray: s.verge.enable_tray,
      trayIcon: s.verge.tray_icon,
      commonTrayIcon: s.verge.common_tray_icon,
      sysproxyTrayIcon: s.verge.sysproxy_tray_icon,
      tunTrayIcon: s.verge.tun_tray_icon,
    })),
  );
  const patchVerge = useVergeStore((s) => s.patchVerge);

  const [open, setOpen] = useState(false);
  const [commonIcon, setCommonIcon] = useState("");
  const [sysproxyIcon, setSysproxyIcon] = useState("");
  const [tunIcon, setTunIcon] = useState("");

  useEffect(() => {
    initIconPath();
  }, []);

  async function initIconPath() {
    const appDir = await getAppDir();
    const icon_dir = await join(appDir, "icons");
    const common_icon_png = await join(icon_dir, "common.png");
    const common_icon_ico = await join(icon_dir, "common.ico");
    const sysproxy_icon_png = await join(icon_dir, "sysproxy.png");
    const sysproxy_icon_ico = await join(icon_dir, "sysproxy.ico");
    const tun_icon_png = await join(icon_dir, "tun.png");
    const tun_icon_ico = await join(icon_dir, "tun.ico");
    if (await exists(common_icon_ico)) {
      setCommonIcon(common_icon_ico);
    } else {
      setCommonIcon(common_icon_png);
    }
    if (await exists(sysproxy_icon_ico)) {
      setSysproxyIcon(sysproxy_icon_ico);
    } else {
      setSysproxyIcon(sysproxy_icon_png);
    }
    if (await exists(tun_icon_ico)) {
      setTunIcon(tun_icon_ico);
    } else {
      setTunIcon(tun_icon_png);
    }
  }

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const onSwitchFormat = (_e: any, value: boolean) => value;
  const onError = (err: any) => {
    notice("error", err.message || err.toString());
  };

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.layout.title")}
      contentStyle={{ width: 450 }}
      hideOkBtn
      hideCancelBtn
      onClose={() => setOpen(false)}>
      <List>
        {show_title_setting && (
          <Item>
            <ListItemText
              primary={
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <span>{t("pages.settings.verge.layout.systemTitleBar")}</span>
                </Box>
              }
            />
            <GuardState
              value={enableSystemTitleBar ?? false}
              valueProps="checked"
              onCatch={onError}
              onFormat={onSwitchFormat}
              onGuard={async (e) => {
                await patchVerge({ enable_system_title_bar: e });
                await appWindow.setDecorations(e);
              }}>
              <SwitchLovely edge="end" />
            </GuardState>
          </Item>
        )}

        {OS === "macos" && (
          <Item>
            <ListItemText
              primary={
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <span>
                    {t("pages.settings.verge.layout.keepInDock.label")}
                  </span>
                  <Tooltip
                    title={t("pages.settings.verge.layout.keepInDock.info")}
                    placement="top">
                    <IconButton color="inherit" size="small">
                      <InfoRounded
                        fontSize="inherit"
                        style={{ cursor: "pointer", opacity: 0.75 }}
                      />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            />
            <GuardState
              value={keepInDock}
              valueProps="checked"
              onCatch={onError}
              onFormat={onSwitchFormat}
              onGuard={(e) => patchVerge({ keep_in_dock: e })}>
              <SwitchLovely edge="end" />
            </GuardState>
          </Item>
        )}

        <Item>
          <ListItemText
            primary={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <span>
                  {t("pages.settings.verge.layout.keepUiActive.label")}
                </span>
                <Tooltip
                  title={t("pages.settings.verge.layout.keepUiActive.info")}
                  placement="top">
                  <IconButton color="inherit" size="small">
                    <InfoRounded
                      fontSize="inherit"
                      style={{ cursor: "pointer", opacity: 0.75 }}
                    />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          />
          <GuardState
            value={enableKeepUiActive ?? false}
            valueProps="checked"
            onCatch={onError}
            onFormat={onSwitchFormat}
            onGuard={(e) => patchVerge({ enable_keep_ui_active: e })}>
            <SwitchLovely edge="end" />
          </GuardState>
        </Item>
        <Item>
          <ListItemText
            primary={t("pages.settings.verge.layout.trafficGraph")}
          />
          <GuardState
            value={trafficGraph}
            valueProps="checked"
            onCatch={onError}
            onFormat={onSwitchFormat}
            onGuard={(e) => patchVerge({ traffic_graph: e })}>
            <SwitchLovely edge="end" />
          </GuardState>
        </Item>

        <Item>
          <ListItemText
            primary={t("pages.settings.verge.layout.memoryUsage")}
          />
          <GuardState
            value={enableMemoryUsage}
            valueProps="checked"
            onCatch={onError}
            onFormat={onSwitchFormat}
            onGuard={(e) => patchVerge({ enable_memory_usage: e })}>
            <SwitchLovely edge="end" />
          </GuardState>
        </Item>

        <Item>
          <ListItemText
            primary={t("pages.settings.verge.layout.proxyGroupIcon")}
          />
          <GuardState
            value={enableGroupIcon}
            valueProps="checked"
            onCatch={onError}
            onFormat={onSwitchFormat}
            onGuard={(e) => patchVerge({ enable_group_icon: e })}>
            <SwitchLovely edge="end" />
          </GuardState>
        </Item>

        <Item>
          <ListItemText primary={t("pages.settings.verge.layout.menuIcon")} />
          <GuardState
            value={menuIcon}
            onCatch={onError}
            onFormat={(e: any) => e.target.value}
            onGuard={(e) => patchVerge({ menu_icon: e })}>
            <Select size="small" sx={{ width: 140, "> div": { py: "7.5px" } }}>
              <MenuItem value="monochrome">
                {t("pages.settings.verge.layout.icon.monochrome")}
              </MenuItem>
              <MenuItem value="colorful">
                {t("pages.settings.verge.layout.icon.colorful")}
              </MenuItem>
              <MenuItem value="disable">{t("common.actions.disable")}</MenuItem>
            </Select>
          </GuardState>
        </Item>

        <Item>
          <ListItemText primary={t("pages.settings.verge.layout.tray.label")} />
          <GuardState
            value={enableTray}
            valueProps="checked"
            onCatch={onError}
            onFormat={onSwitchFormat}
            onGuard={(e) => patchVerge({ enable_tray: e })}>
            <SwitchLovely edge="end" />
          </GuardState>
        </Item>

        {OS === "macos" && (
          <Item>
            <ListItemText
              primary={t("pages.settings.verge.layout.tray.icon")}
            />
            <GuardState
              value={trayIcon}
              onCatch={onError}
              onFormat={(e: any) => e.target.value}
              onGuard={(e) => patchVerge({ tray_icon: e })}>
              <Select
                size="small"
                sx={{ width: 140, "> div": { py: "7.5px" } }}>
                <MenuItem value="monochrome">
                  {t("pages.settings.verge.layout.icon.monochrome")}
                </MenuItem>
                <MenuItem value="colorful">
                  {t("pages.settings.verge.layout.icon.colorful")}
                </MenuItem>
              </Select>
            </GuardState>
          </Item>
        )}

        <Item>
          <ListItemText
            primary={t("pages.settings.verge.layout.tray.common")}
          />
          <GuardState
            value={commonTrayIcon}
            onCatch={onError}
            onGuard={(e) => patchVerge({ common_tray_icon: e })}>
            <Button
              variant="outlined"
              size="small"
              startIcon={
                commonTrayIcon &&
                commonIcon && (
                  <img height="20px" src={convertFileSrc(commonIcon)} />
                )
              }
              onClick={async () => {
                if (commonTrayIcon) {
                  patchVerge({ common_tray_icon: false });
                } else {
                  const path = await openDialog({
                    directory: false,
                    multiple: false,
                    filters: [
                      {
                        name: "Tray Icon Image",
                        extensions: ["png", "ico"],
                      },
                    ],
                  });
                  if (path?.length) {
                    await copyIconFile(`${path}`, "common");
                    await initIconPath();
                    patchVerge({ common_tray_icon: true });
                  }
                }
              }}>
              {commonTrayIcon
                ? t("common.actions.clear")
                : t("common.actions.browse")}
            </Button>
          </GuardState>
        </Item>

        <Item>
          <ListItemText
            primary={t("pages.settings.verge.layout.tray.systemProxy")}
          />
          <GuardState
            value={sysproxyTrayIcon}
            onCatch={onError}
            onGuard={(e) => patchVerge({ sysproxy_tray_icon: e })}>
            <Button
              variant="outlined"
              size="small"
              startIcon={
                sysproxyTrayIcon &&
                sysproxyIcon && (
                  <img height="20px" src={convertFileSrc(sysproxyIcon)} />
                )
              }
              onClick={async () => {
                if (sysproxyTrayIcon) {
                  patchVerge({ sysproxy_tray_icon: false });
                } else {
                  const path = await openDialog({
                    directory: false,
                    multiple: false,
                    filters: [
                      {
                        name: "Tray Icon Image",
                        extensions: ["png", "ico"],
                      },
                    ],
                  });
                  if (path?.length) {
                    await copyIconFile(`${path}`, "sysproxy");
                    await initIconPath();
                    patchVerge({ sysproxy_tray_icon: true });
                  }
                }
              }}>
              {sysproxyTrayIcon
                ? t("common.actions.clear")
                : t("common.actions.browse")}
            </Button>
          </GuardState>
        </Item>

        <Item>
          <ListItemText primary={t("pages.settings.verge.layout.tray.tun")} />
          <GuardState
            value={tunTrayIcon}
            onCatch={onError}
            onGuard={(e) => patchVerge({ tun_tray_icon: e })}>
            <Button
              variant="outlined"
              size="small"
              startIcon={
                tunTrayIcon &&
                tunIcon && <img height="20px" src={convertFileSrc(tunIcon)} />
              }
              onClick={async () => {
                if (tunTrayIcon) {
                  patchVerge({ tun_tray_icon: false });
                } else {
                  const path = await openDialog({
                    directory: false,
                    multiple: false,
                    filters: [
                      {
                        name: "Tray Icon Image",
                        extensions: ["png", "ico"],
                      },
                    ],
                  });
                  if (path?.length) {
                    await copyIconFile(`${path}`, "tun");
                    await initIconPath();
                    patchVerge({ tun_tray_icon: true });
                  }
                }
              }}>
              {tunTrayIcon
                ? t("common.actions.clear")
                : t("common.actions.browse")}
            </Button>
          </GuardState>
        </Item>
      </List>
    </BaseDialog>
  );
});

const Item = styled(ListItem)(() => ({
  padding: "5px 2px",
}));

export default LayoutViewer;
