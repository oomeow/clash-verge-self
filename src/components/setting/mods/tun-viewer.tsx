import { BaseDialog, DialogRef, SwitchLovely } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useClash } from "@/hooks/use-clash";
import getSystem from "@/utils/get-system";
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { StackModeSwitch } from "./stack-mode-switch";

const OS = getSystem();

export const TunViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const { clash, mutateClash, patchClash } = useClash();
  const [open, setOpen] = useState(false);
  const isMacos = OS === "macos";
  const defaultDeviceName = isMacos ? "utun_Mihomo" : "Mihomo";
  const [values, setValues] = useState({
    stack: "gvisor",
    device: defaultDeviceName,
    autoRoute: true,
    autoDetectInterface: true,
    dnsHijack: ["any:53"],
    strictRoute: false,
    mtu: 9000,
  });
  const [isLoading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setValues({
        stack: clash?.tun.stack ?? "gvisor",
        device: clash?.tun.device ?? defaultDeviceName,
        autoRoute: clash?.tun["auto-route"] ?? true,
        autoDetectInterface: clash?.tun["auto-detect-interface"] ?? true,
        dnsHijack: clash?.tun["dns-hijack"] ?? ["any:53"],
        strictRoute: clash?.tun["strict-route"] ?? false,
        mtu: clash?.tun.mtu ?? 9000,
      });
    },
    close: () => setOpen(false),
  }));

  const doSave = async (retry = 5) => {
    setLoading(true);
    const tun = {
      stack: values.stack,
      device: values.device === "" ? defaultDeviceName : values.device,
      "auto-route": values.autoRoute,
      "auto-detect-interface": values.autoDetectInterface,
      "dns-hijack": values.dnsHijack[0] === "" ? [] : values.dnsHijack,
      "strict-route": values.strictRoute,
      mtu: values.mtu ?? 9000,
    };
    try {
      await patchClash({ tun });
      await mutateClash(
        (old) => ({ ...(old! || {}), tun: { ...old?.tun, ...tun } }),
        false,
      );
      setLoading(false);
      setOpen(false);
      notice("success", t("messages.clash.configUpdated"));
    } catch (err: any) {
      if (retry < 0) {
        await patchClash({ tun: { enable: false } });
        await mutateClash(
          (old) => ({
            ...(old! || {}),
            tun: { ...old?.tun, ...tun, enable: false },
          }),
          false,
        );
        setLoading(false);
        setOpen(false);
        notice("error", err);
      } else {
        setTimeout(() => doSave(retry - 1), 1000);
      }
    }
  };

  const onSave = useLockFn(async () => {
    if (isMacos) {
      const device = values.device;
      if (!device.startsWith("utun")) {
        notice("error", t("messages.clash.tun.macosDeviceNameError"), 3000);
        return;
      } else {
        const suffix = device.slice(4);
        const isNotNumber = !/^\d+$/.test(suffix);
        console.log(suffix, isNotNumber);
        if (isNotNumber) {
          notice("error", "device name must end with number, such as utun1234");
          return;
        }
      }
    }
    doSave();
  });

  return (
    <BaseDialog
      open={open}
      title={
        <Box display="flex" justifyContent="space-between" gap={1}>
          <Typography variant="h6">
            {t("pages.settings.clash.tun.label")}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              setValues({
                stack: "gvisor",
                device: defaultDeviceName,
                autoRoute: true,
                autoDetectInterface: true,
                dnsHijack: ["any:53"],
                strictRoute: false,
                mtu: 9000,
              });
            }}>
            {t("common.actions.resetToDefault")}
          </Button>
        </Box>
      }
      loading={isLoading}
      contentStyle={{ width: 450 }}
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}>
      <List>
        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText primary={t("common.fields.stack")} />
          <StackModeSwitch
            value={values.stack}
            onChange={(value) => {
              setValues((v) => ({ ...v, stack: value }));
            }}
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText primary={t("common.fields.device")} />
          <TextField
            size="small"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            sx={{ width: 250 }}
            value={values.device}
            placeholder="Mihomo"
            onChange={(e) =>
              setValues((v) => ({ ...v, device: e.target.value }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText primary={t("pages.settings.clash.tun.autoRoute")} />
          <SwitchLovely
            edge="end"
            checked={values.autoRoute}
            onChange={(_, c) => setValues((v) => ({ ...v, autoRoute: c }))}
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText primary={t("pages.settings.clash.tun.strictRoute")} />
          <SwitchLovely
            edge="end"
            checked={values.strictRoute}
            onChange={(_, c) => setValues((v) => ({ ...v, strictRoute: c }))}
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.clash.tun.autoDetectInterface")}
          />
          <SwitchLovely
            edge="end"
            checked={values.autoDetectInterface}
            onChange={(_, c) =>
              setValues((v) => ({ ...v, autoDetectInterface: c }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText primary={t("pages.settings.clash.tun.dnsHijack")} />
          <TextField
            size="small"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            sx={{ width: 250 }}
            value={values.dnsHijack.join(",")}
            placeholder="Please use , to separate multiple DNS servers"
            onChange={(e) =>
              setValues((v) => ({ ...v, dnsHijack: e.target.value.split(",") }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText primary={t("pages.settings.clash.tun.mtu")} />
          <TextField
            size="small"
            type="number"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            sx={{ width: 250 }}
            value={values.mtu}
            placeholder="9000"
            onChange={(e) =>
              setValues((v) => ({ ...v, mtu: parseInt(e.target.value) }))
            }
          />
        </ListItem>
      </List>
    </BaseDialog>
  );
});
