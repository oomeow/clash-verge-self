import CloseRounded from "@mui/icons-material/CloseRounded";
import { IconButton, ListItem, ListItemText, Typography } from "@mui/material";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

import type { IClosedConnectionItem } from "@/hooks/use-connection-data";
import parseTraffic from "@/utils/parse-traffic";

interface Props {
  value: IClosedConnectionItem;
  isActive: boolean;
  onShowDetail?: () => void;
}

export const ConnectionItem = (props: Props) => {
  const { t } = useTranslation();
  const { value, isActive, onShowDetail } = props;

  const { id, metadata, chains, start, curUpload, curDownload } = value;

  const onDelete = useLockFn(async () => closeConnection(id));
  const uploadSpeed = curUpload ?? 0;
  const downloadSpeed = curDownload ?? 0;
  const chainText = chains?.length ? [...chains].reverse().join(" / ") : "";
  const showTraffic = uploadSpeed >= 100 || downloadSpeed >= 100;
  const trafficText = showTraffic
    ? `${parseTraffic(uploadSpeed).join(" ")} / ${parseTraffic(
        downloadSpeed,
      ).join(" ")}`
    : "";

  return (
    <ListItem
      dense
      sx={{
        borderBottom: "1px solid var(--divider-color)",
        "&:hover": { backgroundColor: "var(--background-color-alpha)" },
      }}
      secondaryAction={
        isActive ? (
          <IconButton edge="end" color="inherit" onClick={onDelete}>
            <CloseRounded />
          </IconButton>
        ) : (
          <Typography sx={{ fontSize: 14 }} color="textSecondary">
            {dayjs(value.closedTime).fromNow()}
          </Typography>
        )
      }>
      <ListItemText
        sx={{ userSelect: "text", cursor: "pointer" }}
        primary={metadata.host || metadata.destinationIP}
        onClick={onShowDetail}
        secondary={
          <span className="inline-block flex-wrap">
            <span className="border-text-secondary/30 text-success mt-1 mr-1 inline-block rounded-full border px-1.5 text-[11px] leading-tight uppercase">
              {metadata.network}
            </span>

            <span className="border-text-secondary/30 mt-1 mr-1 inline-block rounded-full border px-1.5 text-[11px] leading-tight">
              {metadata.type}
            </span>

            {!!metadata.process && (
              <span className="border-text-secondary/30 mt-1 mr-1 inline-block rounded-full border px-1.5 text-[11px] leading-tight">
                {metadata.process}
              </span>
            )}

            {!!chainText && (
              <span className="border-text-secondary/30 mt-1 mr-1 inline-block rounded-full border px-1.5 text-[11px] leading-tight">
                {chainText}
              </span>
            )}

            <span className="border-text-secondary/30 mt-1 mr-1 inline-block rounded-full border px-1.5 text-[11px] leading-tight">
              {t("pages.connections.columns.startAt", {
                time: dayjs(start).fromNow(),
              })}
            </span>

            {!!trafficText && (
              <span className="border-text-secondary/30 mt-1 mr-1 inline-block rounded-full border px-1.5 text-[11px] leading-tight">
                {trafficText}
              </span>
            )}
          </span>
        }
      />
    </ListItem>
  );
};
