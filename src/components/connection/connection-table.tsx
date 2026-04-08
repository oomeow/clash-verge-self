import { useConnectionsStore } from "@/stores";
import parseTraffic from "@/utils/parse-traffic";
import { truncateStr } from "@/utils/truncate-str";
import CancelIcon from "@mui/icons-material/Close";
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridSortModel,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
} from "@mui/x-data-grid";
import { GridApiCommunity } from "@mui/x-data-grid/internals";
import dayjs from "dayjs";
import { RefObject, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

interface Props {
  gridApiRef: RefObject<GridApiCommunity>;
  connections: IConnectionsItem[];
  isActive: boolean;
  onShowDetail: (data: IConnectionsItem) => void;
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
        headerName: t("Type"),
        width: tabColumnsWidths["type"] ?? 160,
        minWidth: 100,
      },
      {
        field: "host",
        headerName: t("Host"),
        width: tabColumnsWidths["host"] ?? 220,
        minWidth: 220,
      },
      {
        field: "ulSpeed",
        headerName: t("UL Speed"),
        width: tabColumnsWidths["ulSpeed"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" ") + "/s",
      },
      {
        field: "dlSpeed",
        headerName: t("DL Speed"),
        width: tabColumnsWidths["dlSpeed"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" ") + "/s",
      },
      {
        field: "chains",
        headerName: t("Chains"),
        width: tabColumnsWidths["chains"] ?? 260,
        minWidth: 260,
      },
      {
        field: "rule",
        headerName: t("Rule"),
        width: tabColumnsWidths["rule"] ?? 300,
        minWidth: 230,
      },
      {
        field: "process",
        headerName: t("Process"),
        width: tabColumnsWidths["process"] ?? 240,
        minWidth: 120,
      },
      {
        field: "source",
        headerName: t("Source"),
        width: tabColumnsWidths["source"] ?? 200,
        minWidth: 150,
      },
      {
        field: "remoteDestination",
        headerName: t("Destination"),
        width: tabColumnsWidths["remoteDestination"] ?? 200,
        minWidth: 150,
      },
      {
        field: "upload",
        headerName: t("Uploaded"),
        width: tabColumnsWidths["upload"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" "),
      },
      {
        field: "download",
        headerName: t("Downloaded"),
        width: tabColumnsWidths["download"] ?? 100,
        align: "center",
        headerAlign: "center",
        valueFormatter: (value) => parseTraffic(value).join(" "),
      },
      {
        field: "time",
        headerName: t("Time"),
        width: tabColumnsWidths["time"] ?? 120,
        minWidth: 100,
        align: "right",
        headerAlign: "right",
        sortComparator: (v1, v2) => {
          return new Date(v2).getTime() - new Date(v1).getTime();
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
    }
    return temp;
  }, [tabColumnsWidths, isActive]);

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
      onSortModelChange={(p, d) => {
        setTabSortModel(p.map((item) => ({ ...item })));
      }}
      onRowClick={(e) => onShowDetail(e.row.connectionData)}
      columnVisibilityModel={columnVisible}
      onColumnVisibilityModelChange={(e) => setColumnVisible(e)}
    />
  );
};
