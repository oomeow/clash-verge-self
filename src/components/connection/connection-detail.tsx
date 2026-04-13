import parseTraffic from "@/utils/parse-traffic";
import { Box, Button, Snackbar } from "@mui/material";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

export interface ConnectionDetailRef {
  open: (detail: IConnectionsItem, active: boolean) => void;
}

export const ConnectionDetail = forwardRef<ConnectionDetailRef>(
  (props, ref) => {
    const [open, setOpen] = useState(false);
    const [detail, setDetail] = useState<IConnectionsItem>();
    const [active, setActive] = useState(true);

    useImperativeHandle(ref, () => ({
      open: (detail: IConnectionsItem, active) => {
        if (open) return;
        setOpen(true);
        setDetail(detail);
        setActive(active);
      },
    }));

    const onClose = () => setOpen(false);

    return (
      <Snackbar
        autoHideDuration={6000}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        open={open}
        onClose={onClose}
        message={
          detail ? (
            <InnerConnectionDetail
              data={detail}
              active={active}
              onClose={onClose}
            />
          ) : null
        }
      />
    );
  },
);

interface InnerProps {
  data: IConnectionsItem;
  active: boolean;
  onClose?: () => void;
}

const InnerConnectionDetail = ({ data, active, onClose }: InnerProps) => {
  const { t } = useTranslation();
  const { metadata, rulePayload } = data;
  const chains = [...data.chains].reverse().join(" / ");
  const rule = rulePayload ? `${data.rule}(${rulePayload})` : data.rule;
  const host = metadata.host
    ? `${metadata.host}:${metadata.destinationPort}`
    : `${metadata.destinationIP}:${metadata.destinationPort}`;

  const information = [
    {
      label: t("common.fields.type"),
      value: `${metadata.type}(${metadata.network})`,
    },
    { label: t("common.fields.host"), value: host },
    {
      label: t("pages.connections.columns.downloaded"),
      value: parseTraffic(data.download).join(" "),
    },
    {
      label: t("pages.connections.columns.uploaded"),
      value: parseTraffic(data.upload).join(" "),
    },
    {
      label: t("pages.connections.columns.dlSpeed"),
      value: `${parseTraffic(data.curDownload ?? -1).join(" ")}/s`,
    },
    {
      label: t("pages.connections.columns.ulSpeed"),
      value: `${parseTraffic(data.curUpload ?? -1).join(" ")}/s`,
    },
    { label: t("pages.connections.columns.chains"), value: chains },
    { label: t("pages.connections.columns.rule"), value: rule },
    {
      label: t("common.fields.process"),
      value: `${metadata.process}${
        metadata.processPath ? `(${metadata.processPath})` : ""
      }`,
    },
    {
      label: t("common.fields.source"),
      value: `${metadata.sourceIP}:${metadata.sourcePort}`,
    },
    {
      label: t("common.fields.destination"),
      value: metadata.destinationIP
        ? `${metadata.destinationIP}`
        : `${metadata.remoteDestination}`,
    },
    { label: t("common.fields.time"), value: dayjs(data.start).fromNow() },
  ];

  const onDelete = useLockFn(async () => closeConnection(data.id));

  return (
    <Box sx={{ userSelect: "text", maxWidth: 500, minWidth: 300 }}>
      {information.map((each) => (
        <div key={each.label} className="flex w-full break-all">
          <div className="text-primary-main w-fit min-w-25.5 shrink-0 grow-0 pr-2 text-right font-bold">
            {each.label}
          </div>
          <div className="grow">{each.value}</div>
        </div>
      ))}

      {active && (
        <Box sx={{ textAlign: "right" }}>
          <Button
            variant="contained"
            title={t("pages.connections.actions.closeConnection")}
            onClick={() => {
              onDelete();
              onClose?.();
            }}>
            {t("pages.connections.actions.closeConnection")}
          </Button>
        </Box>
      )}
    </Box>
  );
};
