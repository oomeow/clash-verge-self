import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  alpha,
  IconButton,
  ListItem,
  ListItemText,
  styled,
  Typography,
} from "@mui/material";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

import { IClosedConnectionItem } from "@/hooks/use-connection-data";
import parseTraffic from "@/utils/parse-traffic";

const Tag = styled("span")(({ theme }) => ({
  fontSize: "10px",
  padding: "0 4px",
  lineHeight: 1.375,
  border: "1px solid",
  borderRadius: 4,
  borderColor: alpha(theme.palette.text.secondary, 0.35),
  marginTop: "4px",
  marginRight: "4px",
}));

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
      sx={{ borderBottom: "1px solid var(--divider-color)" }}
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
            <Tag sx={{ textTransform: "uppercase", color: "success" }}>
              {metadata.network}
            </Tag>

            <Tag>{metadata.type}</Tag>

            {!!metadata.process && <Tag>{metadata.process}</Tag>}

            {!!chainText && <Tag>{chainText}</Tag>}

            <Tag>
              {t("pages.connections.columns.startAt", {
                time: dayjs(start).fromNow(),
              })}
            </Tag>

            {!!trafficText && <Tag>{trafficText}</Tag>}
          </span>
        }
      />
    </ListItem>
  );
};
