import { DialogRef } from "@/components/base";
import {
  WebDavFilesViewer,
  WebDavFilesViewerRef,
} from "@/components/setting/mods/webdav-files-viewer";
import { useVerge } from "@/hooks/use-verge";
import { routes } from "@/routes/__root";
import {
  applyLocalBackup,
  copyClashEnv,
  createAndUploadBackup,
  createLocalBackup,
  exitApp,
  getAppDir,
  openAppDir,
  openCoreDir,
  openDevTools,
  openLogsDir,
  updateWebDavInfo,
} from "@/services/cmds";
import getSystem from "@/utils/get-system";
import Check from "@mui/icons-material/Check";
import CloudUpload from "@mui/icons-material/CloudUpload";
import ContentCopy from "@mui/icons-material/ContentCopy";
import Refresh from "@mui/icons-material/Refresh";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { TabContext, TabPanel } from "@mui/lab";
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  Input,
  InputAdornment,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { version } from "@root/package.json";
import { open } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNotice } from "../base/notifies";
import { ConfigViewer } from "./mods/config-viewer";
import { GuardState } from "./mods/guard-state";
import { HotkeyViewer } from "./mods/hotkey-viewer";
import { LayoutViewer } from "./mods/layout-viewer";
import { MiscViewer } from "./mods/misc-viewer";
import { SettingItem, SettingList } from "./mods/setting-comp";
import { ThemeModeSwitch } from "./mods/theme-mode-switch";
import { ThemeViewer } from "./mods/theme-viewer";
import { useLazyDialogRef } from "./use-lazy-dialog-ref";
import { UpdateViewer } from "./mods/update-viewer";

interface Props {
  onError?: (err: Error) => void;
}

const OS = getSystem();

const SettingVerge = ({ onError }: Props) => {
  const { t } = useTranslation();
  const { notice } = useNotice();

  const { verge, patchVerge, mutateVerge } = useVerge();
  const {
    app_log_level,
    theme_mode,
    language,
    tray_event,
    env_type,
    startup_script,
    start_page,
    webdav_url,
    webdav_username,
    webdav_password,
  } = verge;
  const configRef = useLazyDialogRef<DialogRef>();
  const hotkeyRef = useLazyDialogRef<DialogRef>();
  const miscRef = useLazyDialogRef<DialogRef>();
  const themeRef = useLazyDialogRef<DialogRef>();
  const layoutRef = useLazyDialogRef<DialogRef>();
  const updateRef = useLazyDialogRef<DialogRef>();
  const webDavRef = useLazyDialogRef<WebDavFilesViewerRef>();

  const onChangeData = (patch: Partial<IVergeConfig>) => {
    mutateVerge({ ...verge, ...patch }, false);
  };

  const onCheckUpdate = async () => {
    try {
      const info = await check();
      if (!info) {
        notice("success", t("messages.app.latestVersion"));
      } else {
        updateRef.open();
      }
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  };

  const [backupMode, setBackupMode] = useState<"local" | "webdav">("local");
  const [expand, setExpand] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, watch, reset } = useForm<IWebDavConfig>({
    defaultValues: {
      url: webdav_url,
      username: webdav_username,
      password: webdav_password,
    },
  });

  // web dav setting
  const [saving, setSaving] = useState(false);
  const [onlyBackupProfiles, setOnlyBackupProfiles] = useState(false);
  const [loadingBackupFiles, setLoadingBackupFiles] = useState(false);
  const [startingBackup, setStartingBackup] = useState(false);

  const url = watch("url");
  const username = watch("username");
  const password = watch("password");
  const webdavChanged =
    webdav_url !== url ||
    webdav_username !== username ||
    webdav_password !== password;

  const onSubmit = async (data: IWebDavConfig) => {
    try {
      if (webdavChanged) {
        setSaving(true);
        await patchVerge({
          webdav_url: data.url,
          webdav_username: data.username,
          webdav_password: data.password,
        });
        await updateWebDavInfo(data.url, data.username, data.password);
      } else {
        setLoadingBackupFiles(true);
        await new Promise<void>((resolve) => {
          webDavRef.withDialog(async (ref) => {
            await ref.getAllBackupFiles();
            ref.open();
            resolve();
          });
        });
      }
    } catch (e: any) {
      notice(
        "error",
        t("messages.backup.webdavConnectionFailed", { error: e }),
        3000,
      );
    } finally {
      setSaving(false);
      setLoadingBackupFiles(false);
    }
  };

  const handleSelectLocalBackup = async () => {
    const appDir = await getAppDir();
    const defaultAppBackupDir = appDir + "/backup";
    const selected = await open({
      multiple: false,
      directory: false,
      defaultPath: defaultAppBackupDir,
      filters: [{ name: "zip", extensions: ["zip"] }],
    });
    if (selected) {
      if (selected.endsWith(".zip")) {
        await applyLocalBackup(selected);
        notice("success", t("messages.backup.applySuccess"));
      } else {
        notice("error", t("pages.settings.verge.backup.invalidFileFormat"));
      }
    }
  };

  const handleBackup = async () => {
    try {
      setStartingBackup(true);
      if (backupMode === "local") {
        await createLocalBackup(onlyBackupProfiles);
      } else if (backupMode === "webdav") {
        await createAndUploadBackup(onlyBackupProfiles);
      }
      notice("success", t("messages.backup.success"));
    } catch (e) {
      notice("error", t("messages.backup.failed", { error: e }), 3000);
    } finally {
      setStartingBackup(false);
    }
  };

  return (
    <SettingList title={t("pages.settings.verge.title")}>
      {themeRef.mounted && <ThemeViewer ref={themeRef.dialogRef} />}
      {configRef.mounted && <ConfigViewer ref={configRef.dialogRef} />}
      {hotkeyRef.mounted && <HotkeyViewer ref={hotkeyRef.dialogRef} />}
      {miscRef.mounted && <MiscViewer ref={miscRef.dialogRef} />}
      {layoutRef.mounted && <LayoutViewer ref={layoutRef.dialogRef} />}
      {updateRef.mounted && <UpdateViewer ref={updateRef.dialogRef} />}
      {webDavRef.mounted && <WebDavFilesViewer ref={webDavRef.dialogRef} />}

      <SettingItem label={t("pages.settings.verge.misc.appLogLevel")}>
        <GuardState
          value={app_log_level ?? "info"}
          onCatch={onError}
          onFormat={(e: any) => e.target.value}
          onChange={(e) => onChangeData({ app_log_level: e })}
          onGuard={(e) => patchVerge({ app_log_level: e })}>
          <Select size="small" sx={{ width: 110, "> div": { py: "7.5px" } }}>
            {["trace", "debug", "info", "warn", "error", "silent"].map((i) => (
              <MenuItem value={i} key={i}>
                {i[0].toUpperCase() + i.slice(1).toLowerCase()}
              </MenuItem>
            ))}
          </Select>
        </GuardState>
      </SettingItem>

      <SettingItem label={t("common.fields.language")}>
        <GuardState
          value={language ?? "en"}
          onCatch={onError}
          onFormat={(e: any) => e.target.value}
          onChange={(e) => onChangeData({ language: e })}
          onGuard={(e) => patchVerge({ language: e })}>
          <Select size="small" sx={{ width: 110, "> div": { py: "7.5px" } }}>
            <MenuItem value="zh">中文</MenuItem>
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="ru">Русский</MenuItem>
            <MenuItem value="fa">فارسی</MenuItem>
          </Select>
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.verge.themeMode.label")}>
        <GuardState
          value={theme_mode}
          onCatch={onError}
          onChange={(e) => onChangeData({ theme_mode: e })}
          onGuard={(e) => patchVerge({ theme_mode: e })}>
          <ThemeModeSwitch />
        </GuardState>
      </SettingItem>

      {OS !== "linux" && (
        <SettingItem label={t("pages.settings.verge.tray.clickEvent")}>
          <GuardState
            value={tray_event ?? "main_window"}
            onCatch={onError}
            onFormat={(e: any) => e.target.value}
            onChange={(e) => onChangeData({ tray_event: e })}
            onGuard={(e) => patchVerge({ tray_event: e })}>
            <Select size="small" sx={{ width: 140, "> div": { py: "7.5px" } }}>
              <MenuItem value="main_window">
                {t("pages.settings.verge.tray.showMainWindow")}
              </MenuItem>
              <MenuItem value="system_proxy">
                {t("pages.settings.system.proxy.label")}
              </MenuItem>
              <MenuItem value="tun_mode">
                {t("pages.settings.clash.tun.label")}
              </MenuItem>
              <MenuItem value="disable">{t("common.actions.disable")}</MenuItem>
            </Select>
          </GuardState>
        </SettingItem>
      )}

      <SettingItem
        label={t("pages.settings.verge.env.copyType")}
        extra={
          <IconButton
            color="inherit"
            size="small"
            onClick={() => {
              copyClashEnv();
              notice("success", t("pages.settings.verge.env.copySuccess"));
            }}>
            <ContentCopy fontSize="inherit" style={{ opacity: 0.75 }} />
          </IconButton>
        }>
        <GuardState
          value={env_type ?? (OS === "windows" ? "powershell" : "bash")}
          onCatch={onError}
          onFormat={(e: any) => e.target.value}
          onChange={(e) => onChangeData({ env_type: e })}
          onGuard={(e) => patchVerge({ env_type: e })}>
          <Select size="small" sx={{ width: 140, "> div": { py: "7.5px" } }}>
            <MenuItem value="bash">Bash</MenuItem>
            <MenuItem value="cmd">CMD</MenuItem>
            <MenuItem value="powershell">PowerShell</MenuItem>
            <MenuItem value="nushell">NuShell</MenuItem>
          </Select>
        </GuardState>
      </SettingItem>

      <SettingItem label={t("common.fields.startPage")}>
        <GuardState
          value={start_page ?? "/"}
          onCatch={onError}
          onFormat={(e: any) => e.target.value}
          onChange={(e) => onChangeData({ start_page: e })}
          onGuard={(e) => patchVerge({ start_page: e })}>
          <Select size="small" sx={{ width: 140, "> div": { py: "7.5px" } }}>
            {routes.map((route) => {
              return (
                <MenuItem key={route.path} value={route.path}>
                  {t(route.label)}
                </MenuItem>
              );
            })}
          </Select>
        </GuardState>
      </SettingItem>

      <SettingItem label={t("common.fields.startupScript")}>
        <GuardState
          value={startup_script ?? ""}
          onCatch={onError}
          onFormat={(e: any) => e.target.value}
          onChange={(e) => onChangeData({ startup_script: e })}
          onGuard={(e) => patchVerge({ startup_script: e })}>
          <Input
            value={startup_script}
            disabled
            sx={{ width: 230 }}
            endAdornment={
              <>
                <Button
                  onClick={async () => {
                    const path = await open({
                      directory: false,
                      multiple: false,
                      filters: [
                        {
                          name: "Shell Script",
                          extensions: ["sh", "bat", "ps1"],
                        },
                      ],
                    });
                    if (path?.length) {
                      onChangeData({ startup_script: `${path}` });
                      patchVerge({ startup_script: `${path}` });
                    }
                  }}>
                  {t("common.actions.browse")}
                </Button>
                {startup_script && (
                  <Button
                    onClick={async () => {
                      onChangeData({ startup_script: "" });
                      patchVerge({ startup_script: "" });
                    }}>
                    {t("common.actions.clear")}
                  </Button>
                )}
              </>
            }></Input>
        </GuardState>
      </SettingItem>

      <SettingItem
        openMoreSettings
        onClick={() => themeRef.open()}
        label={t("pages.settings.verge.theme.title")}
      />

      <SettingItem
        openMoreSettings
        onClick={() => layoutRef.open()}
        label={t("pages.settings.verge.layout.title")}
      />

      <SettingItem
        openMoreSettings
        onClick={() => miscRef.open()}
        label={t("pages.settings.verge.misc.title")}
      />

      <SettingItem
        openMoreSettings
        onClick={() => {
          if (expand && webdavChanged) {
            reset();
          }
          setExpand(!expand);
        }}
        label={t("pages.settings.verge.backup.title")}
        expand={expand}
      />

      <Collapse in={expand} timeout={"auto"} unmountOnExit>
        <div className="bg-primary-alpha w-full">
          <TabContext value={backupMode}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs
                value={backupMode}
                onChange={(_e, value) => {
                  setBackupMode(value);
                }}
                aria-label="backup model">
                <Tab
                  label={t("pages.settings.verge.backup.types.local")}
                  id="local-tab"
                  value="local"
                />
                <Tab
                  label={t("pages.settings.verge.backup.types.webdav")}
                  id="webdav-tab"
                  value="webdav"
                />
              </Tabs>
            </Box>
            <TabPanel value="local">
              <div className="flex w-full items-center justify-end">
                <FormControlLabel
                  className="mx-0"
                  control={
                    <Checkbox
                      checked={onlyBackupProfiles}
                      size="small"
                      onChange={(e) => setOnlyBackupProfiles(e.target.checked)}
                    />
                  }
                  label={t("pages.settings.verge.backup.onlyProfiles")}
                />
              </div>
              <div className="flex w-full items-center justify-around space-x-4!">
                <Button
                  startIcon={<Refresh />}
                  onClick={() => handleSelectLocalBackup()}
                  size="small"
                  fullWidth
                  variant="contained">
                  {t("pages.settings.verge.backup.actions.recovery")}
                </Button>
                <Button
                  loading={startingBackup}
                  startIcon={<CloudUpload />}
                  loadingPosition="start"
                  size="small"
                  fullWidth
                  variant="contained"
                  onClick={() => handleBackup()}>
                  {t("pages.settings.verge.backup.actions.backup")}
                </Button>
              </div>
            </TabPanel>
            <TabPanel value="webdav">
              <form onSubmit={handleSubmit(onSubmit)}>
                <TextField
                  label={t("pages.settings.verge.backup.webdav.url")}
                  {...register("url")}
                  size="small"
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  autoComplete="off"
                  autoCorrect="off"
                />
                <TextField
                  label={t("pages.settings.verge.backup.webdav.username")}
                  {...register("username")}
                  size="small"
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  autoComplete="off"
                  autoCorrect="off"
                />
                <TextField
                  label={t("pages.settings.verge.backup.webdav.password")}
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  size="small"
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  autoComplete="off"
                  autoCorrect="off"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            className="text-primary-main"
                            aria-label="toggle password visibility"
                            onClick={() => {
                              setShowPassword(!showPassword);
                            }}
                            edge="end">
                            {showPassword ? (
                              <Visibility fontSize="inherit" />
                            ) : (
                              <VisibilityOff fontSize="inherit" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <div className="flex w-full items-center justify-end">
                  <FormControlLabel
                    className="mx-0"
                    control={
                      <Checkbox
                        checked={onlyBackupProfiles}
                        size="small"
                        onChange={(e) =>
                          setOnlyBackupProfiles(e.target.checked)
                        }
                      />
                    }
                    label={t("pages.settings.verge.backup.onlyProfiles")}
                  />
                </div>
                <div className="flex w-full items-center justify-around space-x-4!">
                  {webdavChanged ? (
                    <Button
                      loading={saving}
                      startIcon={<Check />}
                      loadingPosition="start"
                      type="submit"
                      size="small"
                      fullWidth
                      variant="contained">
                      {t("common.actions.save")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        loading={loadingBackupFiles}
                        startIcon={<Refresh />}
                        loadingPosition="start"
                        type="submit"
                        size="small"
                        fullWidth
                        variant="contained">
                        {t("pages.settings.verge.backup.actions.recovery")}
                      </Button>
                      <Button
                        loading={startingBackup}
                        startIcon={<CloudUpload />}
                        loadingPosition="start"
                        size="small"
                        fullWidth
                        variant="contained"
                        onClick={() => handleBackup()}>
                        {t("pages.settings.verge.backup.actions.backup")}
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </TabPanel>
          </TabContext>
        </div>
      </Collapse>

      <SettingItem
        openMoreSettings
        onClick={() => hotkeyRef.open()}
        label={t("pages.settings.verge.hotkeys.title")}
      />

      <SettingItem
        onClick={() => configRef.open()}
        label={t("pages.settings.verge.runtimeConfig")}
      />

      <SettingItem
        onClick={openAppDir}
        label={t("pages.settings.verge.actions.openAppDir")}
      />

      <SettingItem
        onClick={openCoreDir}
        label={t("pages.settings.verge.actions.openCoreDir")}
      />

      <SettingItem
        onClick={openLogsDir}
        label={t("pages.settings.verge.actions.openLogsDir")}
      />

      <SettingItem
        onClick={onCheckUpdate}
        label={t("pages.settings.verge.actions.checkForUpdates")}
      />

      <SettingItem
        onClick={openDevTools}
        label={t("pages.settings.verge.actions.openDevTools")}
      />

      <SettingItem onClick={() => exitApp()} label={t("common.actions.exit")} />

      <SettingItem label={t("pages.settings.verge.version")}>
        <Typography sx={{ py: "7px", pr: 1 }}>v{version}</Typography>
      </SettingItem>
    </SettingList>
  );
};

export default SettingVerge;
