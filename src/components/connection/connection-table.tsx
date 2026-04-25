import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import CancelIcon from "@mui/icons-material/Close";
import UnfoldMoreRounded from "@mui/icons-material/UnfoldMoreRounded";
import ViewColumnRounded from "@mui/icons-material/ViewColumnRounded";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  type Cell,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import dayjs from "dayjs";
import {
  type CSSProperties,
  memo,
  type MouseEvent as ReactMouseEvent,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { closeConnection } from "tauri-plugin-mihomo-api";

import { IClosedConnectionItem } from "@/hooks/use-connection-data";
import { useConnectionsStore } from "@/stores";
import parseTraffic from "@/utils/parse-traffic";

import { type ColumnMeta, type ConnectionRow } from "./connection-table.types";
import { ConnectionTableColumnSelector } from "./connection-table-column-selector";
import {
  getConnectionCellTooltipText,
  getConnectionSelectorColumns,
  getNormalizedConnectionColumnOrder,
  getOrderedConnectionColumns,
  mapConnectionsToRows,
} from "./connection-table-utils";

interface Props {
  tableContainerRef: RefObject<HTMLDivElement | null>;
  connections: IClosedConnectionItem[];
  isActive: boolean;
  onShowDetail: (data: IClosedConnectionItem) => void;
}

interface ConnectionTableBodyProps {
  rows: Row<ConnectionRow>[];
  tableContainerElement: HTMLDivElement | null;
  onShowDetail: (data: IClosedConnectionItem) => void;
  getCellTooltipText: (cell: Cell<ConnectionRow, unknown>) => string;
}

interface ConnectionTableBodyRowProps {
  row: Row<ConnectionRow>;
  virtualRow: VirtualItem;
  onShowDetail: (data: IClosedConnectionItem) => void;
  getCellTooltipText: (cell: Cell<ConnectionRow, unknown>) => string;
}

const ROW_HEIGHT = 37;

const getColumnVarName = (columnId: string) =>
  `--connection-col-${columnId}-width`;

const getColumnJustifyContent = (
  align?: ColumnMeta["align"],
): CSSProperties["justifyContent"] => {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
};

const ConnectionTableBodyRow = memo(
  ({
    row,
    virtualRow,
    onShowDetail,
    getCellTooltipText,
  }: ConnectionTableBodyRowProps) => {
    return (
      <tr
        data-body-row="true"
        onClick={() => onShowDetail(row.original.connectionData)}
        style={{
          display: "flex",
          position: "absolute",
          transform: `translateY(${virtualRow.start}px)`,
          width: "100%",
          height: `${virtualRow.size}px`,
        }}>
        {row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
          const justifyContent = getColumnJustifyContent(meta?.align);
          const renderedCell = flexRender(
            cell.column.columnDef.cell,
            cell.getContext(),
          );
          const tooltipText = getCellTooltipText(cell);

          return (
            <td
              key={cell.id}
              data-column-id={cell.column.id}
              data-body-cell="true"
              style={{
                display: "flex",
                width: `var(${getColumnVarName(cell.column.id)})`,
                minWidth: cell.column.columnDef.minSize,
                textAlign: meta?.align ?? "left",
                position: "relative",
                justifyContent,
              }}>
              <Tooltip
                followCursor
                title={tooltipText}
                disableHoverListener={!tooltipText}>
                <span
                  className="flex h-full w-full items-center overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ justifyContent }}
                  data-column-content="true">
                  <span className="min-w-0 overflow-hidden leading-tight text-ellipsis whitespace-nowrap">
                    {renderedCell}
                  </span>
                </span>
              </Tooltip>
              <span
                className="pointer-events-none invisible absolute whitespace-nowrap"
                data-column-measure="true">
                {renderedCell}
              </span>
            </td>
          );
        })}
      </tr>
    );
  },
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.row.original === next.row.original &&
    prev.virtualRow.start === next.virtualRow.start &&
    prev.virtualRow.size === next.virtualRow.size &&
    prev.getCellTooltipText === next.getCellTooltipText &&
    prev.onShowDetail === next.onShowDetail,
);

const ConnectionTableBody = memo(
  ({
    rows,
    tableContainerElement,
    onShowDetail,
    getCellTooltipText,
  }: ConnectionTableBodyProps) => {
    const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
      count: rows.length,
      estimateSize: () => ROW_HEIGHT,
      getScrollElement: () => tableContainerElement,
      getItemKey: (index) => rows[index]?.id ?? index,
      overscan: 5,
    });

    return (
      <tbody
        style={{
          display: "grid",
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
        }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];

          return (
            <ConnectionTableBodyRow
              key={row.id}
              row={row}
              virtualRow={virtualRow}
              onShowDetail={onShowDetail}
              getCellTooltipText={getCellTooltipText}
            />
          );
        })}
      </tbody>
    );
  },
  (prev, next) =>
    prev.rows === next.rows &&
    prev.tableContainerElement === next.tableContainerElement &&
    prev.onShowDetail === next.onShowDetail &&
    prev.getCellTooltipText === next.getCellTooltipText,
);

export const ConnectionTable = (props: Props) => {
  const { t } = useTranslation();
  const { tableContainerRef, connections, isActive, onShowDetail } = props;
  const tabColumnsWidths = useConnectionsStore(
    (state) => state.tabColumnsWidths,
  );
  const tabColumnOrder = useConnectionsStore((state) => state.tabColumnOrder);
  const setTabSortModel = useConnectionsStore((state) => state.setTabSortModel);
  const tabSortModel = useConnectionsStore((state) => state.tabSortModel);
  const setTabColumnWidth = useConnectionsStore(
    (state) => state.setTabColumnWidth,
  );
  const setTabColumnOrder = useConnectionsStore(
    (state) => state.setTabColumnOrder,
  );

  const [columnVisible, setColumnVisible] = useState<VisibilityState>({});
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [tableContainerElement, setTableContainerElement] =
    useState<HTMLDivElement | null>(null);
  const columnWidthsRef = useRef<Record<string, number>>({});
  const resizeFrameRef = useRef<number | null>(null);
  const resizeDraftRef = useRef<{ columnId: string; width: number } | null>(
    null,
  );

  const handleTableContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      tableContainerRef.current = node;
      setTableContainerElement(node);
    },
    [tableContainerRef],
  );

  const sorting = useMemo<SortingState>(
    () => tabSortModel.map((item) => ({ id: item.id, desc: item.desc })),
    [tabSortModel],
  );

  const normalizedTabColumnOrder = useMemo(
    () => getNormalizedConnectionColumnOrder(tabColumnOrder),
    [tabColumnOrder],
  );

  useEffect(() => {
    if (
      normalizedTabColumnOrder.length !== tabColumnOrder.length ||
      normalizedTabColumnOrder.some(
        (columnId, index) => columnId !== tabColumnOrder[index],
      )
    ) {
      setTabColumnOrder(normalizedTabColumnOrder);
    }
  }, [normalizedTabColumnOrder, setTabColumnOrder, tabColumnOrder]);

  const columns = useMemo<ColumnDef<ConnectionRow>[]>(() => {
    const getColumnWidth = (columnId: string, fallback: number) =>
      tabColumnsWidths[columnId] ?? fallback;

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
            minSize: 100,
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
        minSize: 120,
        meta: {} satisfies ColumnMeta,
      },
      {
        accessorKey: "ulSpeed",
        header: t("pages.connections.columns.ulSpeed"),
        cell: ({ getValue }) =>
          `${parseTraffic(getValue<number>()).join(" ")}/s`,
        size: getColumnWidth("ulSpeed", 100),
        minSize: 100,
        meta: {} satisfies ColumnMeta,
      },
      {
        accessorKey: "dlSpeed",
        header: t("pages.connections.columns.dlSpeed"),
        cell: ({ getValue }) =>
          `${parseTraffic(getValue<number>()).join(" ")}/s`,
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
      ...getOrderedConnectionColumns(sharedColumns, tabColumnOrder),
    ];
  }, [isActive, t, tabColumnOrder, tabColumnsWidths]);

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, []);

  const connRows = useMemo<ConnectionRow[]>(
    () => mapConnectionsToRows(connections),
    [connections],
  );

  const table = useReactTable({
    data: connRows,
    columns,
    state: {
      sorting,
      columnVisibility: columnVisible,
    },
    enableMultiSort: false,
    onSortingChange: (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setTabSortModel(nextSorting.map((item) => ({ ...item })));
    },
    onColumnVisibilityChange: setColumnVisible,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableWidth = useMemo(
    () =>
      table.getVisibleLeafColumns().reduce((total, column) => {
        const width =
          columnWidthsRef.current[column.id] ??
          tabColumnsWidths[column.id] ??
          column.getSize();
        return total + width;
      }, 0),
    [columnVisible, tabColumnsWidths, table],
  );

  const syncTableWidthStyles = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    let nextWidth = 0;
    table.getVisibleLeafColumns().forEach((column) => {
      nextWidth +=
        columnWidthsRef.current[column.id] ??
        tabColumnsWidths[column.id] ??
        column.getSize();
    });

    container.style.setProperty("--connection-table-width", `${nextWidth}px`);
  }, [tabColumnsWidths, table, tableContainerRef]);

  const applyColumnWidthToDom = useCallback(
    (columnId: string, width: number) => {
      const container = tableContainerRef.current;
      if (!container) return;

      columnWidthsRef.current[columnId] = width;
      container.style.setProperty(getColumnVarName(columnId), `${width}px`);
      syncTableWidthStyles();
    },
    [syncTableWidthStyles, tableContainerRef],
  );

  useEffect(() => {
    table.getAllLeafColumns().forEach((column) => {
      columnWidthsRef.current[column.id] =
        tabColumnsWidths[column.id] ?? column.getSize();
    });
    syncTableWidthStyles();
  }, [columns, syncTableWidthStyles, tabColumnsWidths, table]);

  const getCellTooltipText = useCallback(
    (cell: Cell<ConnectionRow, unknown>) =>
      getConnectionCellTooltipText(cell, t),
    [t],
  );

  const autoResizeColumn = useCallback(
    (columnId: string, minWidth = 80) => {
      const container = tableContainerRef.current;
      if (!container) return;

      const selectorColumnId =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(columnId)
          : columnId;
      const contents = container.querySelectorAll<HTMLElement>(
        `[data-column-id="${selectorColumnId}"] [data-column-measure="true"]`,
      );
      if (contents.length === 0) return;

      let nextWidth = minWidth;
      contents.forEach((content) => {
        const contentWidth = Math.ceil(
          Math.max(content.scrollWidth, content.getBoundingClientRect().width),
        );
        const cell = content.closest<HTMLElement>("[data-column-id]");
        const style = cell ? window.getComputedStyle(cell) : null;
        const cellPadding = style
          ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
          : 0;
        nextWidth = Math.max(nextWidth, contentWidth + cellPadding);
      });

      applyColumnWidthToDom(columnId, nextWidth);
      setTabColumnWidth(columnId, nextWidth);
    },
    [applyColumnWidthToDom, setTabColumnWidth, tableContainerRef],
  );

  const startResize = useCallback(
    (
      event: ReactMouseEvent<HTMLSpanElement>,
      columnId: string,
      initialWidth: number,
      minWidth = 80,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const queueResizeWidth = (width: number) => {
        resizeDraftRef.current = { columnId, width };
        if (resizeFrameRef.current !== null) return;

        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          const draft = resizeDraftRef.current;
          if (!draft) return;
          applyColumnWidthToDom(draft.columnId, draft.width);
        });
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const width = Math.max(
          minWidth,
          initialWidth + moveEvent.clientX - startX,
        );
        queueResizeWidth(width);
      };

      const onMouseUp = () => {
        const draftWidth =
          resizeDraftRef.current?.columnId === columnId
            ? resizeDraftRef.current.width
            : initialWidth;
        if (resizeFrameRef.current !== null) {
          cancelAnimationFrame(resizeFrameRef.current);
          resizeFrameRef.current = null;
        }
        applyColumnWidthToDom(columnId, draftWidth);
        resizeDraftRef.current = null;
        setTabColumnWidth(columnId, draftWidth);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [applyColumnWidthToDom, setTabColumnWidth],
  );

  const tableStyleVars = useMemo(() => {
    const styleVars: Record<string, string> = {
      "--connection-table-width": `${tableWidth}px`,
    };

    table.getAllLeafColumns().forEach((column) => {
      styleVars[getColumnVarName(column.id)] = `${
        tabColumnsWidths[column.id] ?? column.getSize()
      }px`;
    });

    return styleVars;
  }, [tabColumnsWidths, table, tableWidth]);

  const headerContent = useMemo(
    () =>
      table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta as ColumnMeta | undefined;
            const sorted = header.column.getIsSorted();
            const justifyContent = getColumnJustifyContent(meta?.align);

            return (
              <th
                key={header.id}
                data-column-id={header.column.id}
                data-header-cell="true"
                style={{
                  display: "flex",
                  width: `var(${getColumnVarName(header.column.id)})`,
                  minWidth: header.column.columnDef.minSize,
                  textAlign: meta?.align ?? "left",
                  position: "relative",
                  justifyContent,
                }}>
                <div
                  className="relative flex h-full w-full items-center"
                  style={{ justifyContent }}>
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1 bg-transparent pr-3 text-inherit"
                    style={{
                      cursor: header.column.getCanSort()
                        ? "pointer"
                        : "default",
                      justifyContent,
                      width: header.column.getCanResize()
                        ? "calc(100% - 4px)"
                        : "100%",
                    }}
                    onClick={header.column.getToggleSortingHandler()}>
                    <span className="truncate" data-column-content="true">
                      <span
                        className="inline-block max-w-none"
                        data-column-measure="true">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </span>
                    </span>
                    {sorted === "asc" ? (
                      <ArrowUpwardRounded sx={{ fontSize: 14 }} />
                    ) : sorted === "desc" ? (
                      <ArrowDownwardRounded sx={{ fontSize: 14 }} />
                    ) : header.column.getCanSort() ? (
                      <UnfoldMoreRounded sx={{ fontSize: 14, opacity: 0.6 }} />
                    ) : null}
                  </button>
                  {header.column.getCanResize() ? (
                    <span
                      className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-[rgba(0,0,0,0.08)] opacity-45 transition-[opacity,background-color,width] hover:w-1.5 hover:bg-[rgba(0,0,0,0.22)] hover:opacity-100"
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        autoResizeColumn(
                          header.column.id,
                          header.column.columnDef.minSize,
                        );
                      }}
                      onMouseDown={(event) =>
                        startResize(
                          event,
                          header.column.id,
                          columnWidthsRef.current[header.column.id] ??
                            tabColumnsWidths[header.column.id] ??
                            header.getSize(),
                          header.column.columnDef.minSize,
                        )
                      }
                    />
                  ) : null}
                </div>
              </th>
            );
          })}
        </tr>
      )),
    [autoResizeColumn, columns, sorting, startResize, tabColumnsWidths, table],
  );

  const selectorColumns = useMemo(
    () =>
      isColumnSelectorOpen ? getConnectionSelectorColumns(columns, table) : [],
    [columnVisible, columns, isColumnSelectorOpen, table],
  );

  const handleToggleColumnVisible = useCallback(
    (columnId: string) => {
      const column = table.getColumn(columnId);
      if (!column) return;
      column.toggleVisibility(!column.getIsVisible());
    },
    [table],
  );

  const handleColumnOrderDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;

      const currentOrder = selectorColumns.map((column) => column.id);
      const oldIndex = currentOrder.indexOf(String(active.id));
      const newIndex = currentOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      setTabColumnOrder(arrayMove(currentOrder, oldIndex, newIndex));
    },
    [selectorColumns, setTabColumnOrder],
  );

  return (
    <Box className="flex h-full min-h-0 flex-col">
      <Box className="flex items-center px-1 py-1">
        <Tooltip title={t("pages.connections.columns.actions")}>
          <IconButton
            size="small"
            onClick={() => setIsColumnSelectorOpen((open) => !open)}>
            <ViewColumnRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {isColumnSelectorOpen ? (
        <ConnectionTableColumnSelector
          open
          title={t("pages.connections.columns.actions")}
          description={t("pages.connections.columns.dragToReorder")}
          columns={selectorColumns}
          onClose={() => setIsColumnSelectorOpen(false)}
          onToggleVisible={handleToggleColumnVisible}
          onDragEnd={handleColumnOrderDragEnd}
        />
      ) : null}

      <Box
        ref={handleTableContainerRef}
        style={tableStyleVars}
        className="min-h-0 flex-1 overflow-auto"
        sx={(theme) => ({
          overflow: "auto",
          position: "relative",
          borderTop: `1px solid ${theme.palette.divider}`,
          "div:focus, button:focus": { outline: "none !important" },
          "& thead": {
            display: "grid",
            position: "sticky",
            top: 0,
            zIndex: 1,
            backgroundColor: "#ffffff",
          },
          "& th, & td": {
            margin: 0,
            borderBottom: `1px solid ${theme.palette.divider}`,
            padding: "6px 12px",
            fontSize: 13,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxSizing: "border-box",
            alignItems: "center",
          },
          "& th": {
            backgroundColor: "#ffffff",
            fontWeight: 500,
          },
          "& tr[data-body-row='true']": {
            cursor: "pointer",
          },
          "& tr[data-body-row='true']:hover": {
            backgroundColor: theme.palette.action.hover,
          },
          ...theme.applyStyles("dark", {
            "& thead, & th": {
              backgroundColor: "#282a36",
            },
          }),
        })}>
        <table
          style={{
            display: "grid",
            width: "var(--connection-table-width)",
            minWidth: "100%",
          }}>
          <thead>{headerContent}</thead>
          <ConnectionTableBody
            rows={table.getRowModel().rows}
            tableContainerElement={tableContainerElement}
            onShowDetail={onShowDetail}
            getCellTooltipText={getCellTooltipText}
          />
        </table>
      </Box>
    </Box>
  );
};
