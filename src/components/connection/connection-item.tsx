import { IClosedConnectionItem } from "@/hooks/use-connection-data";
import parseTraffic from "@/utils/parse-traffic";
import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  IconButton,
  ListItem,
  ListItemText,
  Typography,
  alpha,
  styled,
} from "@mui/material";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

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
  const showTraffic = curUpload! >= 100 || curDownload! >= 100;

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

            {chains?.length > 0 && (
              <Tag>{[...chains].reverse().join(" / ")}</Tag>
            )}

            <Tag>{t("Start At", { time: dayjs(start).fromNow() })}</Tag>

            {showTraffic && (
              <Tag>
                {parseTraffic(curUpload!)} / {parseTraffic(curDownload!)}
              </Tag>
            )}
          </span>
        }
      />
    </ListItem>
  );
};
