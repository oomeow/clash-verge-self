import CancelIcon from "@mui/icons-material/Close";
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
} from "@mui/x-data-grid";
import { GridApiCommunity } from "@mui/x-data-grid/internals";
import dayjs from "dayjs";
import { RefObject, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

import { IClosedConnectionItem } from "@/hooks/use-connection-data";
import { useConnectionsStore } from "@/stores";
import parseTraffic from "@/utils/parse-traffic";
import { truncateStr } from "@/utils/truncate-str";

interface Props {
  gridApiRef: RefObject<GridApiCommunity>;
  connections: IClosedConnectionItem[];
  isActive: boolean;
  onShowDetail: (data: IClosedConnectionItem) => void;
}

export const ConnectionTable = (props: Props) => {
  const { t } = useTranslation();
  const { gridApiRef, connections, isActive, onShowDetail } = props;
  const tabColumnsWidths = useConnectionsStore(
    (state) => state.tabColumnsWidths,
  );
  const setTabSortModel = useConnectionsStore((state) => state.setTabSortModel);
  const tabSortModel = useConnectionsStore((state) => state.tabSortModel);
  const setTabColumnWidth = useConnectionsStore(
    (state) => state.setTabColumnWidth,
  );

  const Toolbar = () => (
    <div style={{ margin: "5px" }}>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
    </div>
  );

  const [columnVisible, setColumnVisible] = useState<
    Partial<Record<keyof IConnectionsItem, boolean>>
  >({});

  const columns: GridColDef[] = useMemo(() => {
    const temp: GridColDef[] = [
      {
        field: "type",
        headerName: t("common.fields.type"),
        width: tabColumnsWidths["type"] ?? 160,
        minWidth: 100,
      },
      {
        field: "host",
        headerName: t("common.fields.host"),
        width: tabColumnsWidths["host"] ?? 220,
        minWidth: 220,
      },
      {
        field: "ulSpeed",
        headerName: t("pages.connections.columns.ulSpeed"),
        width: tabColumnsWidths["ulSpeed"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" ") + "/s",
      },
      {
        field: "dlSpeed",
        headerName: t("pages.connections.columns.dlSpeed"),
        width: tabColumnsWidths["dlSpeed"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" ") + "/s",
      },
      {
        field: "chains",
        headerName: t("pages.connections.columns.chains"),
        width: tabColumnsWidths["chains"] ?? 260,
        minWidth: 260,
      },
      {
        field: "rule",
        headerName: t("pages.connections.columns.rule"),
        width: tabColumnsWidths["rule"] ?? 300,
        minWidth: 230,
      },
      {
        field: "process",
        headerName: t("common.fields.process"),
        width: tabColumnsWidths["process"] ?? 240,
        minWidth: 120,
      },
      {
        field: "source",
        headerName: t("common.fields.source"),
        width: tabColumnsWidths["source"] ?? 200,
        minWidth: 150,
      },
      {
        field: "remoteDestination",
        headerName: t("common.fields.destination"),
        width: tabColumnsWidths["remoteDestination"] ?? 200,
        minWidth: 150,
      },
      {
        field: "upload",
        headerName: t("pages.connections.columns.uploaded"),
        width: tabColumnsWidths["upload"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" "),
      },
      {
        field: "download",
        headerName: t("pages.connections.columns.downloaded"),
        width: tabColumnsWidths["download"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" "),
      },
      {
        field: "time",
        headerName: t("common.fields.time"),
        width: tabColumnsWidths["time"] ?? 120,
        minWidth: 100,
        align: "right",
        headerAlign: "right",
        sortComparator: (v1, v2) => {
          return dayjs(v1).valueOf() - dayjs(v2).valueOf();
        },
        valueFormatter: (value) => dayjs(value).fromNow(),
      },
    ];
    if (isActive) {
      temp.unshift({
        field: "actions",
        type: "actions",
        width: 50,
        cellClassName: "actions",
        getActions: ({ id }) => {
          return [
            <GridActionsCellItem
              icon={<CancelIcon />}
              label="Cancel"
              className="textPrimary"
              onClick={() => closeConnection(id.toString())}
              color="inherit"
            />,
          ];
        },
      });
    } else {
      temp.unshift({
        field: "closedTime",
        headerName: t("pages.connections.columns.closedTime"),
        type: "dateTime",
        width: 100,
        sortComparator: (v1, v2) => {
          return v1 - v2;
        },
        valueFormatter: (value) => dayjs(value).fromNow(),
      });
    }
    return temp;
  }, [tabColumnsWidths, isActive, t]);

  const connRows = useMemo(() => {
    return connections.map((each) => {
      const { metadata, rulePayload } = each;
      const chains = [...each.chains].reverse().join(" / ");
      const rule = rulePayload ? `${each.rule}(${rulePayload})` : each.rule;
      return {
        id: each.id,
        host: metadata.host
          ? `${metadata.host}:${metadata.destinationPort}`
          : `${metadata.destinationIP}:${metadata.destinationPort}`,
        download: each.download,
        upload: each.upload,
        dlSpeed: each.curDownload,
        ulSpeed: each.curUpload,
        chains,
        rule,
        process: truncateStr(metadata.process || metadata.processPath),
        time: each.start,
        source: `${metadata.sourceIP}:${metadata.sourcePort}`,
        remoteDestination: metadata.destinationIP
          ? `${metadata.destinationIP}`
          : `${metadata.remoteDestination}`,
        type: `${metadata.type} (${metadata.network})`,
        connectionData: each,
        closedTime: each.closedTime,
      };
    });
  }, [connections]);

  return (
    <DataGrid
      apiRef={gridApiRef}
      density="compact"
      disableDensitySelector
      disableColumnMenu
      rows={connRows}
      columns={columns}
      sortModel={tabSortModel}
      slots={{ toolbar: Toolbar }}
      sx={(theme) => ({
        border: "none",
        "div:focus": { outline: "none !important" },
        "& .MuiDataGrid-container--top .MuiDataGrid-columnHeader": {
          backgroundColor: "#ffffff",
        },
        ...theme.applyStyles("dark", {
          "& .MuiDataGrid-container--top .MuiDataGrid-columnHeader": {
            backgroundColor: "#282a36",
          },
        }),
      })}
      onColumnWidthChange={(p) => {
        setTabColumnWidth(p.colDef.field, p.width);
      }}
      onSortModelChange={(p, _d) => {
        setTabSortModel(p.map((item) => ({ ...item })));
      }}
      onRowClick={(e) => onShowDetail(e.row.connectionData)}
      columnVisibilityModel={columnVisible}
      onColumnVisibilityModelChange={(e) => setColumnVisible(e)}
    />
  );
};
