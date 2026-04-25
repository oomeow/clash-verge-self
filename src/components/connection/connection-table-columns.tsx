import CancelIcon from "@mui/icons-material/Close";
import { type ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { type TFunction } from "i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

import parseTraffic from "@/utils/parse-traffic";

import { type ColumnMeta, type ConnectionRow } from "./connection-table.types";
import { getOrderedConnectionColumns } from "./connection-table-utils";

interface CreateConnectionColumnsOptions {
  isActive: boolean;
  t: TFunction;
  columnOrder: string[];
  getColumnWidth: (columnId: string, fallback: number) => number;
}

export const createConnectionColumns = ({
  isActive,
  t,
  columnOrder,
  getColumnWidth,
}: CreateConnectionColumnsOptions): ColumnDef<ConnectionRow>[] => {
  const leadingColumns = isActive
    ? [
        {
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <button
              className="cursor-pointer rounded-full text-xs hover:bg-gray-200"
              onClick={(event) => {
                event.stopPropagation();
                closeConnection(row.original.id);
              }}>
              <CancelIcon fontSize="small" />
            </button>
          ),
          enableSorting: false,
          enableHiding: false,
          enableResizing: false,
          size: 50,
          minSize: 50,
          meta: { align: "center" } satisfies ColumnMeta,
        } satisfies ColumnDef<ConnectionRow>,
      ]
    : [
        {
          accessorKey: "closedTime",
          header: t("pages.connections.columns.closedTime"),
          cell: ({ getValue }) => dayjs(getValue<number>()).fromNow(),
          sortingFn: (rowA, rowB, columnId) =>
            rowA.getValue<number>(columnId) - rowB.getValue<number>(columnId),
          enableHiding: false,
          size: getColumnWidth("closedTime", 110),
          minSize: 110,
          meta: {} satisfies ColumnMeta,
        } satisfies ColumnDef<ConnectionRow>,
      ];

  const sharedColumns = [
    {
      accessorKey: "type",
      header: t("common.fields.type"),
      size: getColumnWidth("type", 160),
      minSize: 100,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "host",
      header: t("common.fields.host"),
      size: getColumnWidth("host", 220),
      minSize: 200,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "ulSpeed",
      header: t("pages.connections.columns.ulSpeed"),
      cell: ({ getValue }) => `${parseTraffic(getValue<number>()).join(" ")}/s`,
      size: getColumnWidth("ulSpeed", 100),
      minSize: 100,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "dlSpeed",
      header: t("pages.connections.columns.dlSpeed"),
      cell: ({ getValue }) => `${parseTraffic(getValue<number>()).join(" ")}/s`,
      size: getColumnWidth("dlSpeed", 100),
      minSize: 100,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "chains",
      header: t("pages.connections.columns.chains"),
      size: getColumnWidth("chains", 260),
      minSize: 260,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "rule",
      header: t("pages.connections.columns.rule"),
      size: getColumnWidth("rule", 300),
      minSize: 230,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "process",
      header: t("common.fields.process"),
      size: getColumnWidth("process", 240),
      minSize: 120,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "source",
      header: t("common.fields.source"),
      size: getColumnWidth("source", 200),
      minSize: 150,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "remoteDestination",
      header: t("common.fields.destination"),
      size: getColumnWidth("remoteDestination", 200),
      minSize: 150,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "upload",
      header: t("pages.connections.columns.uploaded"),
      cell: ({ getValue }) => parseTraffic(getValue<number>()).join(" "),
      size: getColumnWidth("upload", 100),
      minSize: 100,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "download",
      header: t("pages.connections.columns.downloaded"),
      cell: ({ getValue }) => parseTraffic(getValue<number>()).join(" "),
      size: getColumnWidth("download", 100),
      minSize: 100,
      meta: {} satisfies ColumnMeta,
    },
    {
      accessorKey: "time",
      header: t("common.fields.time"),
      cell: ({ getValue }) => dayjs(getValue<string>()).fromNow(),
      sortingFn: (rowA, rowB, columnId) =>
        dayjs(rowA.getValue<string>(columnId)).valueOf() -
        dayjs(rowB.getValue<string>(columnId)).valueOf(),
      size: getColumnWidth("time", 120),
      minSize: 100,
      meta: {
        align: "center",
      } satisfies ColumnMeta,
    },
  ] satisfies ColumnDef<ConnectionRow>[];

  return [
    ...leadingColumns,
    ...getOrderedConnectionColumns(sharedColumns, columnOrder),
  ];
};
