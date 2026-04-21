import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import RotateLeft from "@mui/icons-material/RotateLeft";
import Shuffle from "@mui/icons-material/Shuffle";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { nanoid } from "nanoid";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import { BaseDialog, DialogRef, SwitchLovely } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useClashInfo } from "@/hooks/use-clash";

const DEFAULT_ALLOW_ORIGINS = [
  "https://metacubex.github.io",
  "https://yacd.metacubex.one",
];

export const ControllerViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const [open, setOpen] = useState(false);
  const { clashInfo, patchInfo } = useClashInfo();
  const { cors } = clashInfo || {};

  const [controller, setController] = useState(clashInfo?.server || "");
  const [secret, setSecret] = useState(clashInfo?.secret || "");
  const [allowPrivateNetwork, setAllowPrivateNetwork] = useState(
    cors?.allow_private_network || false,
  );
  const [allowOrigins, setAllowOrigins] = useState<string[]>(
    cors?.allow_origins || [],
  );
  const [allowOriginsInput, setAllowOriginsInput] = useState("");

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setController(clashInfo?.server || "");
      setSecret(clashInfo?.secret || "");
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    try {
      await patchInfo({
        "external-controller": controller,
        secret,
        "external-controller-cors": {
          "allow-private-network": allowPrivateNetwork,
          "allow-origins": allowOrigins,
        },
      });
      notice(
        "success",
        t("messages.clash.externalControllerAddressModified"),
        1000,
      );
      setOpen(false);
    } catch (err: any) {
      notice("error", err.message || err.toString(), 4000);
    }
  });

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.clash.externalController.label")}
      contentStyle={{ maxWidth: 500, width: "fit-content", minWidth: 400 }}
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}>
      <List>
        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.clash.externalController.host")}
          />
          <TextField
            size="small"
            autoComplete="off"
            sx={{ width: 175 }}
            value={controller}
            placeholder={t("common.status.required")}
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
                <span>
                  {t("pages.settings.clash.externalController.secret")}
                </span>
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={() => setSecret(nanoid())}>
                  <Shuffle fontSize="inherit" style={{ opacity: 0.75 }} />
                </IconButton>
              </Box>
            }
          />
          <TextField
            size="small"
            autoComplete="off"
            sx={{ width: 175 }}
            value={secret}
            placeholder={t("common.status.recommended")}
            onChange={(e) =>
              setSecret(e.target.value?.replace(/[^\x00-\x7F]/g, ""))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t(
              "pages.settings.clash.externalController.allowPrivateNetwork",
            )}
          />
          <SwitchLovely
            checked={allowPrivateNetwork}
            onChange={(e) => {
              const value = e.target.checked;
              setAllowPrivateNetwork(value);
            }}
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {t("pages.settings.clash.externalController.allowOrigins")}
                <Tooltip
                  title={t(
                    "pages.settings.clash.externalController.resetDefaultAllowOrigins",
                  )}>
                  <span>
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={async () => {
                        setAllowOrigins(DEFAULT_ALLOW_ORIGINS);
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
          size="small"
          autoComplete="off"
          sx={{ width: "100%", padding: "5px 2px" }}
          value={allowOriginsInput}
          onChange={(e) => {
            const value = e.target.value;
            setAllowOriginsInput(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (allowOriginsInput.trim().length > 0) {
                if (allowOrigins.includes(allowOriginsInput)) {
                  setAllowOriginsInput("");
                  notice(
                    "warning",
                    t(
                      "pages.settings.clash.externalController.duplicateAllowOrigins",
                    ),
                  );
                } else {
                  setAllowOrigins((v) => [...v, allowOriginsInput.trim()]);
                  setAllowOriginsInput("");
                }
              }
            }
          }}
          slotProps={{
            input: {
              endAdornment: (
                <IconButton
                  color="primary"
                  size="small"
                  onClick={() => {
                    if (allowOriginsInput.trim().length > 0) {
                      if (allowOrigins.includes(allowOriginsInput)) {
                        setAllowOriginsInput("");
                        notice(
                          "warning",
                          t(
                            "pages.settings.clash.externalController.duplicateAllowOrigins",
                          ),
                        );
                      } else {
                        setAllowOrigins((v) => [
                          ...v,
                          allowOriginsInput.trim(),
                        ]);
                        setAllowOriginsInput("");
                      }
                    }
                  }}>
                  <Add fontSize="inherit" />
                </IconButton>
              ),
            },
          }}
        />
      </List>
      {allowOrigins.map((item) => {
        return (
          <ListItem
            key={item}
            sx={{
              padding: "8px",
              bgcolor: "var(--background-color-alpha)",
              margin: "5px 0",
            }}>
            <ListItemText primary={item} />
            <IconButton
              size="small"
              color="warning"
              onClick={() => {
                setAllowOrigins((v) => v.filter((i) => i !== item));
              }}>
              <Remove fontSize="inherit" />
            </IconButton>
          </ListItem>
        );
      })}
    </BaseDialog>
  );
});

export default ControllerViewer;
