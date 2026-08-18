import type { Cell, Table } from "@tanstack/react-table";
import dayjs from "dayjs";
import type { TFunction } from "i18next";

import type { IClosedConnectionItem } from "@/hooks/use-connection-data";
import parseTraffic from "@/utils/parse-traffic";
import { truncateStr } from "@/utils/truncate-str";

import {
  type ColumnOption,
  type ConnectionColumnDef,
  type ConnectionRow,
  type connectionTableFeatures,
  DEFAULT_COLUMN_ORDER,
} from "./connection-table.types";

export const mapConnectionsToRows = (
  connections: IClosedConnectionItem[],
): ConnectionRow[] => {
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
      dlSpeed: each.curDownload ?? 0,
      ulSpeed: each.curUpload ?? 0,
      chains,
      rule,
      process:
        truncateStr(metadata.process || metadata.processPath || "") || "",
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
};

export const getConnectionCellTooltipText = (
  cell: Cell<typeof connectionTableFeatures, ConnectionRow, unknown>,
  t: TFunction,
) => {
  const { connectionData } = cell.row.original;

  switch (cell.column.id) {
    case "actions":
      return t("pages.connections.actions.closeConnection");
    case "ulSpeed":
      return `${parseTraffic(connectionData.curUpload ?? 0).join(" ")}/s`;
    case "dlSpeed":
      return `${parseTraffic(connectionData.curDownload ?? 0).join(" ")}/s`;
    case "upload":
      return parseTraffic(connectionData.upload).join(" ");
    case "download":
      return parseTraffic(connectionData.download).join(" ");
    case "time":
      return dayjs(connectionData.start).format("YYYY-MM-DD HH:mm:ss");
    case "closedTime":
      return connectionData.closedTime
        ? dayjs(connectionData.closedTime).format("YYYY-MM-DD HH:mm:ss")
        : "";
    case "process":
      return (
        connectionData.metadata.process ||
        connectionData.metadata.processPath ||
        ""
      );
    default: {
      const value = cell.getValue();
      return value == null ? "" : String(value);
    }
  }
};

export const getNormalizedConnectionColumnOrder = (columnOrder: string[]) => {
  return [
    ...columnOrder.filter((columnId) =>
      DEFAULT_COLUMN_ORDER.includes(columnId as never),
    ),
    ...DEFAULT_COLUMN_ORDER.filter(
      (columnId) => !columnOrder.includes(columnId),
    ),
  ];
};

export const getConnectionColumnId = (column: ConnectionColumnDef) => {
  if ("accessorKey" in column && column.accessorKey) {
    return String(column.accessorKey);
  }

  return String(column.id);
};

export const getOrderedConnectionColumns = (
  columns: ConnectionColumnDef[],
  columnOrder: string[],
) => {
  const columnMap = new Map(
    columns.map((column) => [getConnectionColumnId(column), column]),
  );
  const orderedIds = [
    ...columnOrder.filter((columnId) => columnMap.has(columnId)),
    ...DEFAULT_COLUMN_ORDER.filter(
      (columnId) => columnMap.has(columnId) && !columnOrder.includes(columnId),
    ),
  ];

  return orderedIds.map((columnId) => columnMap.get(columnId)!);
};

export const getConnectionSelectorColumns = (
  columns: ConnectionColumnDef[],
  table: Table<typeof connectionTableFeatures, ConnectionRow>,
): ColumnOption[] => {
  return columns
    .map((column) => {
      const columnId = getConnectionColumnId(column);
      const tableColumn = table.getColumn(columnId);
      if (!tableColumn?.getCanHide()) return null;

      return {
        id: columnId,
        label:
          typeof column.header === "string" ? column.header : tableColumn.id,
        visible: tableColumn.getIsVisible(),
      };
    })
    .filter((column): column is ColumnOption => column !== null);
};
