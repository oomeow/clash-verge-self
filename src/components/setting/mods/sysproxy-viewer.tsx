import Add from "@mui/icons-material/Add";
import InfoRounded from "@mui/icons-material/InfoRounded";
import Remove from "@mui/icons-material/Remove";
import RotateLeft from "@mui/icons-material/RotateLeft";
import {
  Box,
  Button,
  IconButton,
  Input,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  styled,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  BaseDialog,
  BaseFieldset,
  DialogRef,
  EditorViewer,
  SwitchLovely,
} from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import {
  getAutotemProxy,
  getDefaultBypass,
  getSystemProxy,
} from "@/services/cmds";
import { useVergeStore } from "@/stores";
import getSystem from "@/utils/get-system";

const DEFAULT_PAC = `function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}`;

const OS = getSystem();

export const SysproxyViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const isWindows = getSystem() === "windows";
  const separator = isWindows ? ";" : ",";

  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [bypass, setBypass] = useState<string[]>([]);
  const [bypassInput, setBypassInput] = useState("");

  const [sysproxy, setSysproxy] = useState<SysProxy>();
  const [autoproxy, setAutoproxy] = useState<AutoProxy>();

  const enableSystemProxy = useVergeStore(
    (s) => s.verge.enable_system_proxy ?? false,
  );
  const proxyAutoConfig = useVergeStore(
    (s) => s.verge.proxy_auto_config ?? false,
  );
  const pacFileContent = useVergeStore(
    (s) => s.verge.pac_file_content ?? DEFAULT_PAC,
  );
  const enableProxyGuard = useVergeStore(
    (s) => s.verge.enable_proxy_guard ?? false,
  );
  const bypassVerge = useVergeStore((s) => {
    if (OS === "linux") return s.verge.linux_bypass ?? "";
    if (OS === "macos") return s.verge.macos_bypass ?? "";
    if (OS === "windows") return s.verge.windows_bypass ?? "";
    return s.verge.bypass ?? "";
  });
  const proxyGuardDuration = useVergeStore(
    (s) => s.verge.proxy_guard_duration ?? 10,
  );
  const patchVerge = useVergeStore((s) => s.patchVerge);

  const [value, setValue] = useState({
    guard: enableProxyGuard,
    duration: proxyGuardDuration,
    pac: proxyAutoConfig,
    pac_content: pacFileContent,
  });

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setValue({
        guard: enableProxyGuard,
        duration: proxyGuardDuration,
        pac: proxyAutoConfig,
        pac_content: pacFileContent ?? DEFAULT_PAC,
      });
      getSystemProxy().then((p) => setSysproxy(p));
      getAutotemProxy().then((p) => setAutoproxy(p));
      const bypassList = bypassVerge.split(separator) ?? [];
      if (bypassList.length > 0) {
        setBypass(bypassList);
      } else {
        getDefaultBypass().then((value) => {
          setBypass(value.split(separator));
        });
      }
    },
    close: () => {
      setOpen(false);
      const bypassList = bypassVerge.split(separator) ?? [];
      if (bypassList.length > 0) {
        setBypass(bypassList);
      } else {
        getDefaultBypass().then((value) => {
          setBypass(value.split(separator));
        });
      }
    },
  }));

  const onSave = useLockFn(async () => {
    if (value.duration < 1) {
      notice("error", t("messages.settings.proxyGuardDurationTooShort"));
      return;
    }

    const patch: Partial<IVergeConfig> = {};

    if (value.guard !== enableProxyGuard) {
      patch.enable_proxy_guard = value.guard;
    }
    if (value.duration !== proxyGuardDuration) {
      patch.proxy_guard_duration = value.duration;
    }
    const bypassStr = bypass.join(separator);
    if (bypassStr !== bypassVerge) {
      if (OS === "windows") {
        patch.windows_bypass = bypassStr;
      } else if (OS === "macos") {
        patch.macos_bypass = bypassStr;
      } else if (OS === "linux") {
        patch.linux_bypass = bypassStr;
      }
    }
    if (value.pac !== proxyAutoConfig) {
      patch.proxy_auto_config = value.pac;
    }
    if (value.pac_content !== pacFileContent) {
      patch.pac_file_content = value.pac_content;
    }
    try {
      await patchVerge(patch);
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  });

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.system.proxy.dialogTitle")}
      contentStyle={{ width: 450 }}
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      onClose={() => {
        setOpen(false);
        const bypass = sysproxy?.bypass.split(separator) ?? [];
        setBypass(bypass);
      }}
      onCancel={() => {
        setOpen(false);
        const bypass = sysproxy?.bypass.split(separator) ?? [];
        setBypass(bypass);
      }}
      onOk={onSave}>
      <List>
        <BaseFieldset
          label={t("pages.settings.system.proxy.current")}
          padding="15px 10px">
          <FlexBox>
            <Typography className="label">
              {t("pages.settings.system.proxy.enableStatus")}
            </Typography>
            <Typography className="value">
              {value.pac
                ? autoproxy?.enable
                  ? t("common.status.enabled")
                  : t("common.status.disabled")
                : sysproxy?.enable
                  ? t("common.status.enabled")
                  : t("common.status.disabled")}
            </Typography>
          </FlexBox>
          {!value.pac && (
            <>
              <FlexBox>
                <Typography className="label">
                  {t("pages.settings.system.proxy.serverAddr")}
                </Typography>
                <Typography className="value">
                  {sysproxy?.server
                    ? sysproxy.server
                    : t("common.status.notAvailable")}
                </Typography>
              </FlexBox>
              <FlexBox>
                <Typography className="label">
                  {t("pages.settings.system.proxy.bypassValue")}
                </Typography>
                <Typography className="value wrap-anywhere">
                  {sysproxy?.bypass
                    ? sysproxy.bypass
                    : t("common.status.notAvailable")}
                </Typography>
              </FlexBox>
            </>
          )}
          {value.pac && (
            <FlexBox>
              <Typography className="label">
                {t("pages.settings.system.proxy.pac.url")}
              </Typography>
              <Typography className="value">{autoproxy?.url || "-"}</Typography>
            </FlexBox>
          )}
        </BaseFieldset>
        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.system.proxy.pac.useMode")}
          />
          <SwitchLovely
            edge="end"
            disabled={!enableSystemProxy}
            checked={value.pac}
            onChange={(_, e) => setValue((v) => ({ ...v, pac: e }))}
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.system.proxy.guard.label")}
          />
          <Tooltip title={t("pages.settings.system.proxy.guard.info")}>
            <IconButton color="inherit" size="small">
              <InfoRounded
                fontSize="inherit"
                style={{ cursor: "pointer", opacity: 0.75 }}
              />
            </IconButton>
          </Tooltip>
          <SwitchLovely
            edge="end"
            disabled={!enableSystemProxy}
            checked={value.guard}
            onChange={(_, e) => setValue((v) => ({ ...v, guard: e }))}
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.system.proxy.guard.duration")}
          />
          <TextField
            disabled={!enableSystemProxy}
            size="small"
            value={value.duration}
            sx={{ width: 100 }}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">s</InputAdornment>,
              },
            }}
            onChange={(e) => {
              setValue((v) => ({
                ...v,
                duration: +e.target.value.replace(/\D/, ""),
              }));
            }}
          />
        </ListItem>
        {!value.pac && (
          <>
            <ListItem sx={{ padding: "5px 2px" }}>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {t("pages.settings.system.proxy.bypass.label")}
                    <Tooltip
                      title={t(
                        "pages.settings.system.proxy.bypass.resetDefault",
                      )}>
                      <span>
                        <IconButton
                          // disabled={!enabled}
                          color="primary"
                          size="small"
                          onClick={async () => {
                            const defaultBypass = await getDefaultBypass();
                            setBypass(defaultBypass.split(separator));
                          }}>
                          <RotateLeft fontSize="inherit" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                }
              />
            </ListItem>
            <TextField
              // disabled={!enabled}
              size="small"
              autoComplete="off"
              sx={{ width: "100%" }}
              value={bypassInput}
              onChange={(e) => {
                const value = e.target.value;
                setBypassInput(value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (bypassInput.trim().length > 0) {
                    if (bypass.includes(bypassInput)) {
                      setBypassInput("");
                      notice(
                        "info",
                        t("pages.settings.system.proxy.bypass.duplicate"),
                      );
                    } else {
                      setBypass((v) => [...v, bypassInput.trim()]);
                      setBypassInput("");
                    }
                  }
                }
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <IconButton
                      // disabled={!enabled}
                      color="primary"
                      size="small"
                      onClick={() => {
                        if (bypassInput.trim().length > 0) {
                          if (bypass.includes(bypassInput)) {
                            setBypassInput("");
                            notice(
                              "info",
                              t("pages.settings.system.proxy.bypass.duplicate"),
                            );
                          } else {
                            setBypass((v) => [...v, bypassInput.trim()]);
                            setBypassInput("");
                          }
                        }
                      }}>
                      <Add fontSize="inherit" />
                    </IconButton>
                  ),
                },
              }}
            />
            {bypass?.map((item) => {
              return (
                <ListItem
                  key={item}
                  sx={{
                    padding: "8px",
                    bgcolor: "var(--background-color-alpha)",
                    margin: "5px 0",
                  }}>
                  <ListItemText primary={item} />
                  {!["localhost", "127.0.0.1"].includes(item) && (
                    <IconButton
                      // disabled={!enabled}
                      size="small"
                      color="warning"
                      onClick={() => {
                        setBypass((v) => v.filter((i) => i !== item));
                      }}>
                      <Remove fontSize="inherit" />
                    </IconButton>
                  )}
                </ListItem>
              );
            })}
          </>
        )}
        {value.pac && (
          <>
            <ListItem sx={{ padding: "5px 2px", alignItems: "start" }}>
              <ListItemText
                primary={t("pages.settings.system.proxy.pac.content")}
              />
              <Input
                value={value.pac_content ?? ""}
                disabled
                sx={{ width: 230 }}
                endAdornment={
                  <Button
                    onClick={() => {
                      setEditorOpen(true);
                    }}>
                    {t("common.actions.edit")}
                  </Button>
                }
              />
              <EditorViewer
                title={`${t("common.actions.edit")} PAC`}
                open={editorOpen}
                scope="pac"
                language="javascript"
                property={value.pac_content ?? ""}
                onChange={(content) => {
                  let pac = DEFAULT_PAC;
                  if (content.trim().length > 0) {
                    pac = content;
                  }
                  setValue((v) => ({ ...v, pac_content: pac }));
                }}
                onClose={() => {
                  setEditorOpen(false);
                }}
              />
            </ListItem>
          </>
        )}
      </List>
    </BaseDialog>
  );
});

const FlexBox = styled("div")`
  display: flex;
  margin-top: 4px;

  .label {
    flex: none;
    //width: 85px;
  }
`;
