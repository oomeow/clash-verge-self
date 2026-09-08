import InfoRounded from "@mui/icons-material/InfoRounded";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import { BaseDialog, type DialogRef, SwitchLovely } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { DEFAULT_TEST_URL } from "@/services/delay";
import { useVergeStore } from "@/stores";
import { getErrorMessage } from "@/utils";

export const MiscViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const autoCloseConnection = useVergeStore(
    (s) => s.verge.auto_close_connection ?? true,
  );
  const autoCheckUpdate = useVergeStore(
    (s) => s.verge.auto_check_update ?? true,
  );
  const enableBuiltinEnhanced = useVergeStore(
    (s) => s.verge.enable_builtin_enhanced ?? true,
  );
  const proxyLayoutColumn = useVergeStore(
    (s) => s.verge.proxy_layout_column ?? 6,
  );
  const defaultLatencyTest = useVergeStore(
    (s) => s.verge.default_latency_test ?? "",
  );
  const autoLogClean = useVergeStore((s) => s.verge.auto_log_clean ?? 0);
  const defaultLatencyTimeout = useVergeStore(
    (s) => s.verge.default_latency_timeout ?? 5000,
  );
  const logRollSizeMb = useVergeStore((s) => s.verge.log_roll_size_mb ?? 10);
  const logMaxKeepFiles = useVergeStore(
    (s) => s.verge.log_max_keep_files ?? 10,
  );
  const patchVerge = useVergeStore((s) => s.patchVerge);

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    autoCloseConnection: true,
    autoCheckUpdate: true,
    enableBuiltinEnhanced: true,
    proxyLayoutColumn: 6,
    defaultLatencyTest: "",
    autoLogClean: 0,
    defaultLatencyTimeout: 5000,
    logRollSizeMb: 10,
    logMaxKeepFiles: 10,
  });

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setValues({
        autoCloseConnection,
        autoCheckUpdate,
        enableBuiltinEnhanced,
        proxyLayoutColumn,
        defaultLatencyTest,
        autoLogClean,
        defaultLatencyTimeout,
        logRollSizeMb,
        logMaxKeepFiles,
      });
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    try {
      await patchVerge({
        auto_close_connection: values.autoCloseConnection,
        auto_check_update: values.autoCheckUpdate,
        enable_builtin_enhanced: values.enableBuiltinEnhanced,
        proxy_layout_column: values.proxyLayoutColumn,
        default_latency_test: values.defaultLatencyTest,
        default_latency_timeout: values.defaultLatencyTimeout || 5000,
        auto_log_clean: values.autoLogClean as IVergeConfig["auto_log_clean"],
        log_roll_size_mb: Math.max(1, values.logRollSizeMb || 1),
        log_max_keep_files: Math.max(1, values.logMaxKeepFiles || 1),
      });
      setOpen(false);
    } catch (err: unknown) {
      notice("error", getErrorMessage(err));
    }
  });

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.misc.title")}
      maxWidth="xs"
      fullWidth
      okBtn={t("common.actions.save")}
      cancelBtn={t("common.actions.cancel")}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}>
      <List>
        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.verge.misc.autoCloseConnections")}
          />
          <SwitchLovely
            edge="end"
            checked={values.autoCloseConnection}
            onChange={(_, c) =>
              setValues((v) => ({ ...v, autoCloseConnection: c }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.verge.misc.autoCheckUpdate")}
          />
          <SwitchLovely
            edge="end"
            checked={values.autoCheckUpdate}
            onChange={(_, c) =>
              setValues((v) => ({ ...v, autoCheckUpdate: c }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.verge.misc.enableBuiltinEnhanced")}
          />
          <SwitchLovely
            edge="end"
            checked={values.enableBuiltinEnhanced}
            onChange={(_, c) =>
              setValues((v) => ({ ...v, enableBuiltinEnhanced: c }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.verge.misc.proxyLayoutColumn")}
          />
          <Select
            size="small"
            sx={{ width: 135, "> div": { py: "7.5px" } }}
            value={values.proxyLayoutColumn}
            onChange={(e) => {
              setValues((v) => ({
                ...v,
                proxyLayoutColumn: e.target.value as number,
              }));
            }}>
            <MenuItem value={6} key={6}>
              {t("common.actions.auto")}
            </MenuItem>
            {[1, 2, 3, 4, 5].map((i) => (
              <MenuItem value={i} key={i}>
                {i}
              </MenuItem>
            ))}
          </Select>
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.verge.misc.autoLogClean.label")}
          />
          <Select
            size="small"
            sx={{ width: 135, "> div": { py: "7.5px" } }}
            value={values.autoLogClean}
            onChange={(e) => {
              setValues((v) => ({
                ...v,
                autoLogClean: e.target.value as number,
              }));
            }}>
            {[
              {
                key: "pages.settings.verge.misc.autoLogClean.options.never",
                value: 0,
              },
              {
                key: "pages.settings.verge.misc.autoLogClean.options.sevenDays",
                value: 1,
              },
              {
                key: "pages.settings.verge.misc.autoLogClean.options.thirtyDays",
                value: 2,
              },
              {
                key: "pages.settings.verge.misc.autoLogClean.options.ninetyDays",
                value: 3,
              },
            ].map((i) => (
              <MenuItem key={i.value} value={i.value}>
                {t(i.key)}
              </MenuItem>
            ))}
          </Select>
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.verge.misc.defaultLatencyTest")}
          />
          <TextField
            size="small"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            sx={{ width: 250 }}
            value={values.defaultLatencyTest}
            placeholder={DEFAULT_TEST_URL}
            onChange={(e) =>
              setValues((v) => ({ ...v, defaultLatencyTest: e.target.value }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={t("pages.settings.verge.misc.defaultLatencyTimeout")}
          />
          <TextField
            size="small"
            type="number"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            sx={{ width: 120 }}
            value={values.defaultLatencyTimeout || ""}
            placeholder="5000"
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                defaultLatencyTimeout: parseInt(e.target.value, 10),
              }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <span>{t("pages.settings.verge.misc.logRollSizeMb")}</span>
                <Tooltip
                  title={t("pages.settings.verge.misc.logRollSizeMbInfo")}
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
          <TextField
            size="small"
            type="number"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            sx={{ width: 120 }}
            value={values.logRollSizeMb || ""}
            placeholder="10"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                logRollSizeMb: Math.max(1, parseInt(e.target.value, 10)),
              }))
            }
          />
        </ListItem>

        <ListItem sx={{ padding: "5px 2px" }}>
          <ListItemText
            primary={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <span>{t("pages.settings.verge.misc.logMaxKeepFiles")}</span>
                <Tooltip
                  title={t("pages.settings.verge.misc.logMaxKeepFilesInfo")}
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
          <TextField
            size="small"
            type="number"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            sx={{ width: 120 }}
            value={values.logMaxKeepFiles || ""}
            placeholder="10"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                logMaxKeepFiles: Math.max(1, parseInt(e.target.value, 10)),
              }))
            }
          />
        </ListItem>
      </List>
    </BaseDialog>
  );
});

export default MiscViewer;
