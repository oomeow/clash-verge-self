import { BaseDialog, DialogRef, SwitchLovely } from "@/components/base";
import { useNotice } from "@/components/base/notifice";
import { useClashInfo } from "@/hooks/use-clash";
import { Shuffle } from "@mui/icons-material";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { nanoid } from "nanoid";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { GuardState } from "./guard-state";
import { useVerge } from "@/hooks/use-verge";
import { MihomoWebSocket } from "tauri-plugin-mihomo-api";

export const ControllerViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const { verge, mutateVerge, patchVerge } = useVerge();
  const [open, setOpen] = useState(false);
  const { clashInfo, patchInfo } = useClashInfo();
  const { enable_external_controller = false } = verge;

  const [controller, setController] = useState(clashInfo?.server || "");
  const [secret, setSecret] = useState(clashInfo?.secret || "");

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setController(clashInfo?.server || "");
      setSecret(clashInfo?.secret || "");
    },
    close: () => setOpen(false),
  }));

  const onSwitchFormat = (_e: any, value: boolean) => value;
  const onError = (err: any) => {
    notice("error", err.message || err.toString());
  };

  const onSave = useLockFn(async () => {
    try {
      await patchInfo({ "external-controller": controller, secret });
      notice("success", t("External Controller Address Modified"), 1000);
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString(), 4000);
    }
  });

  return (
    <BaseDialog
      open={open}
      title={
        <div className="flex items-center justify-between">
          {t("External Controller")}
          <GuardState
            value={enable_external_controller}
            valueProps="checked"
            onCatch={onError}
            onFormat={onSwitchFormat}
            onGuard={async (e) => {
              MihomoWebSocket.cleanupAll();
              return patchVerge({ enable_external_controller: e });
            }}
            onSuccess={(v) => {
              if (v) {
                notice("success", t("External Controller Enabled"), 1000);
              } else {
                notice("success", t("External Controller Disabled"), 1000);
              }
            }}>
            <SwitchLovely edge="end" />
          </GuardState>
        </div>
      }
      contentStyle={{ width: 400 }}
      hideOkBtn={!enable_external_controller}
      okBtn={t("Save")}
      cancelBtn={t("Cancel")}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}>
      <List>
        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText primary={t("External Controller Host")} />
          <TextField
            disabled={!enable_external_controller}
            size="small"
            autoComplete="off"
            sx={{ width: 175 }}
            value={controller}
            placeholder="Required"
            onChange={(e) => setController(e.target.value)}
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}>
                <span>{t("External Controller Secret")}</span>
                <IconButton
                  disabled={!enable_external_controller}
                  color="inherit"
                  size="small"
                  onClick={() => setSecret(nanoid())}>
                  <Shuffle fontSize="inherit" style={{ opacity: 0.75 }} />
                </IconButton>
              </Box>
            }
          />
          <TextField
            disabled={!enable_external_controller}
            size="small"
            autoComplete="off"
            sx={{ width: 175 }}
            value={secret}
            placeholder={t("Recommended")}
            onChange={(e) =>
              setSecret(e.target.value?.replace(/[^\x00-\x7F]/g, ""))
            }
          />
        </ListItem>
      </List>
    </BaseDialog>
  );
});
