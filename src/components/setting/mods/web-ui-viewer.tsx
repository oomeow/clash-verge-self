import { Box, Button, Typography } from "@mui/material";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { BaseDialog, BaseEmpty, DialogRef } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { useClashInfo } from "@/hooks/use-clash";
import { openWebUrl } from "@/services/cmds";
import { useVergeStore } from "@/stores";

import { WebUIItem } from "./web-ui-item";

const DEFAULT_WEB_UI_LIST = [
  "https://metacubex.github.io/metacubexd/#/setup?http=true&hostname=%host&port=%port&secret=%secret",
  "https://yacd.metacubex.one/?host=%host&port=%port&secret=%secret",
];

export const WebUIViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const { notice } = useNotice();

  const { clashInfo } = useClashInfo();
  const webUIList = useVergeStore(
    useShallow((s) => s.verge.web_ui_list ?? DEFAULT_WEB_UI_LIST),
  );
  const patchVerge = useVergeStore((s) => s.patchVerge);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const handleAdd = useLockFn(async (value: string) => {
    const newList = [...webUIList, value];
    await patchVerge({ web_ui_list: newList });
  });

  const handleChange = useLockFn(async (index: number, value?: string) => {
    const newList = [...webUIList];
    newList[index] = value ?? "";
    await patchVerge({ web_ui_list: newList });
  });

  const handleDelete = useLockFn(async (index: number) => {
    const newList = [...webUIList];
    newList.splice(index, 1);
    await patchVerge({ web_ui_list: newList });
  });

  const handleOpenUrl = useLockFn(async (value?: string) => {
    if (!value) return;
    try {
      let url = value.trim().replaceAll("%host", "127.0.0.1");

      if (url.includes("%port") || url.includes("%secret")) {
        if (!clashInfo) throw new Error("failed to get clash info");
        if (!clashInfo.server?.includes(":")) {
          throw new Error(`failed to parse the server "${clashInfo.server}"`);
        }

        const port = clashInfo.server
          .slice(clashInfo.server.indexOf(":") + 1)
          .trim();

        url = url.replaceAll("%port", port || "9090");
        url = url.replaceAll(
          "%secret",
          encodeURIComponent(clashInfo.secret || ""),
        );
      }

      await openWebUrl(url);
    } catch (e: any) {
      notice("error", e.message || e.toString());
    }
  });

  return (
    <BaseDialog
      open={open}
      title={
        <Box display="flex" justifyContent="space-between">
          {t("pages.settings.clash.webUi.label")}
          <Button
            variant="contained"
            size="small"
            disabled={editing}
            onClick={() => setEditing(true)}>
            {t("common.actions.new")}
          </Button>
        </Box>
      }
      contentStyle={{
        width: 450,
        overflowY: "auto",
        userSelect: "text",
      }}
      hideOkBtn
      hideCancelBtn
      onClose={() => setOpen(false)}>
      {!editing && webUIList.length === 0 && (
        <BaseEmpty
          text={t("common.empty.empty")}
          extra={
            <Typography mt={2} sx={{ fontSize: "12px" }}>
              {t("pages.settings.clash.webUi.replaceTemplateHint")}
            </Typography>
          }
        />
      )}

      {webUIList.map((item, index) => (
        <WebUIItem
          key={index}
          value={item}
          onChange={(v) => handleChange(index, v)}
          onDelete={() => handleDelete(index)}
          onOpenUrl={handleOpenUrl}
        />
      ))}
      {editing && (
        <WebUIItem
          value=""
          onlyEdit
          onChange={(v) => {
            setEditing(false);
            handleAdd(v || "");
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </BaseDialog>
  );
});

export default WebUIViewer;
