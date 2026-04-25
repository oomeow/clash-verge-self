import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import CancelIcon from "@mui/icons-material/Close";
import UnfoldMoreRounded from "@mui/icons-material/UnfoldMoreRounded";
import ViewColumnRounded from "@mui/icons-material/ViewColumnRounded";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs from "dayjs";
import {
  MouseEvent as ReactMouseEvent,
  RefObject,
  useDeferredValue,
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

import { ColumnMeta, ConnectionRow } from "./connection-table.types";
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

const ROW_HEIGHT = 37;

export const ConnectionTable = (props: Props) => {
  const { t } = useTranslation();
  const { tableContainerRef, connections, isActive, onShowDetail } = props;
  const deferredConnections = useDeferredValue(connections);
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
  const columnWidthsRef = useRef<Record<string, number>>({});
  const resizeFrameRef = useRef<number | null>(null);
  const resizeDraftRef = useRef<{ columnId: string; width: number } | null>(
    null,
  );

  const sorting = useMemo<SortingState>(
    () => tabSortModel.map((item) => ({ id: item.id, desc: item.desc })),
    [tabSortModel],
  );

  const getColumnWidth = (columnId: string, fallback: number) =>
    tabColumnsWidths[columnId] ?? fallback;

  const columns = useMemo<ColumnDef<ConnectionRow>[]>(() => {
    const leadingColumns = isActive
      ? [
          {
            id: "actions",
            header: "",
            cell: ({ row }) => (
              <button
                className="rounded-full text-xs hover:bg-gray-200"
                onClick={(event) => {
                  event.stopPropagation();
                  closeConnection(row.original.id);
                }}>
                <CancelIcon fontSize="small" />
              </button>
            ),
            enableSorting: false,
            enableHiding: false,
            meta: { align: "center", width: 55 } satisfies ColumnMeta,
          } satisfies ColumnDef<ConnectionRow>,
        ]
      : [
          {
            accessorKey: "closedTime",
            header: t("pages.connections.columns.closedTime"),
            cell: ({ getValue }) => dayjs(getValue<number>()).fromNow(),
            sortingFn: (rowA, rowB, columnId) =>
              rowA.getValue<number>(columnId) - rowB.getValue<number>(columnId),
            meta: { width: 110 } satisfies ColumnMeta,
          } satisfies ColumnDef<ConnectionRow>,
        ];

    const sharedColumns = [
      {
        accessorKey: "type",
        header: t("common.fields.type"),
        meta: {
          width: getColumnWidth("type", 160),
          minWidth: 100,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "host",
        header: t("common.fields.host"),
        meta: {
          width: getColumnWidth("host", 220),
          minWidth: 120,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "ulSpeed",
        header: t("pages.connections.columns.ulSpeed"),
        cell: ({ getValue }) =>
          `${parseTraffic(getValue<number>()).join(" ")}/s`,
        meta: {
          width: getColumnWidth("ulSpeed", 100),
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "dlSpeed",
        header: t("pages.connections.columns.dlSpeed"),
        cell: ({ getValue }) =>
          `${parseTraffic(getValue<number>()).join(" ")}/s`,
        meta: {
          width: getColumnWidth("dlSpeed", 100),
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "chains",
        header: t("pages.connections.columns.chains"),
        meta: {
          width: getColumnWidth("chains", 260),
          minWidth: 260,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "rule",
        header: t("pages.connections.columns.rule"),
        meta: {
          width: getColumnWidth("rule", 300),
          minWidth: 230,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "process",
        header: t("common.fields.process"),
        meta: {
          width: getColumnWidth("process", 240),
          minWidth: 120,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "source",
        header: t("common.fields.source"),
        meta: {
          width: getColumnWidth("source", 200),
          minWidth: 150,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "remoteDestination",
        header: t("common.fields.destination"),
        meta: {
          width: getColumnWidth("remoteDestination", 200),
          minWidth: 150,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "upload",
        header: t("pages.connections.columns.uploaded"),
        cell: ({ getValue }) => parseTraffic(getValue<number>()).join(" "),
        meta: {
          width: getColumnWidth("upload", 100),
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "download",
        header: t("pages.connections.columns.downloaded"),
        cell: ({ getValue }) => parseTraffic(getValue<number>()).join(" "),
        meta: {
          width: getColumnWidth("download", 100),
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "time",
        header: t("common.fields.time"),
        cell: ({ getValue }) => dayjs(getValue<string>()).fromNow(),
        sortingFn: (rowA, rowB, columnId) =>
          dayjs(rowA.getValue<string>(columnId)).valueOf() -
          dayjs(rowB.getValue<string>(columnId)).valueOf(),
        meta: {
          align: "center",
          width: getColumnWidth("time", 120),
          minWidth: 100,
        } satisfies ColumnMeta,
      },
    ] satisfies ColumnDef<ConnectionRow>[];

    return [
      ...leadingColumns,
      ...getOrderedConnectionColumns(sharedColumns, tabColumnOrder),
    ];
  }, [getColumnWidth, isActive, t, tabColumnOrder]);

  const connRows = useMemo<ConnectionRow[]>(
    () => mapConnectionsToRows(deferredConnections),
    [deferredConnections],
  );

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, []);

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

  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const tableWidth = useMemo(
    () =>
      table.getVisibleLeafColumns().reduce((total, column) => {
        const meta = column.columnDef.meta as ColumnMeta | undefined;
        return total + (meta?.width ?? meta?.minWidth ?? 0);
      }, 0),
    [table, columns, columnVisible],
  );

  const getColumnVarName = (columnId: string) =>
    `--connection-col-${columnId}-width`;

  const syncTableWidthStyles = () => {
    const container = tableContainerRef.current;
    if (!container) return;

    let nextWidth = 0;
    table.getVisibleLeafColumns().forEach((column) => {
      const meta = column.columnDef.meta as ColumnMeta | undefined;
      nextWidth +=
        columnWidthsRef.current[column.id] ??
        meta?.width ??
        meta?.minWidth ??
        0;
    });

    container.style.setProperty("--connection-table-width", `${nextWidth}px`);
  };

  const applyColumnWidthToDom = (columnId: string, width: number) => {
    const container = tableContainerRef.current;
    if (!container) return;

    columnWidthsRef.current[columnId] = width;
    container.style.setProperty(getColumnVarName(columnId), `${width}px`);
    syncTableWidthStyles();
  };

  useEffect(() => {
    table.getAllLeafColumns().forEach((column) => {
      const meta = column.columnDef.meta as ColumnMeta | undefined;
      columnWidthsRef.current[column.id] = meta?.width ?? meta?.minWidth ?? 0;
    });
    syncTableWidthStyles();
  }, [columns, table]);

  const startResize = (
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
  };

  const autoResizeColumn = (columnId: string, minWidth = 80) => {
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
  };

  const tableStyleVars = useMemo(() => {
    const styleVars: Record<string, string> = {
      "--connection-table-width": `${tableWidth}px`,
    };

    table.getAllLeafColumns().forEach((column) => {
      const meta = column.columnDef.meta as ColumnMeta | undefined;
      styleVars[getColumnVarName(column.id)] =
        `${meta?.width ?? meta?.minWidth ?? 0}px`;
    });

    return styleVars;
  }, [table, tableWidth]);

  const getColumnJustifyContent = (align?: ColumnMeta["align"]) => {
    if (align === "center") return "center";
    if (align === "right") return "flex-end";
    return "flex-start";
  };

  const renderHeaderContent = () => {
    return table.getHeaderGroups().map((headerGroup) => (
      <Box key={headerGroup.id} className="flex">
        {headerGroup.headers.map((header) => {
          const meta = header.column.columnDef.meta as ColumnMeta | undefined;
          const sorted = header.column.getIsSorted();
          const textAlign = meta?.align ?? "left";
          const justifyContent = getColumnJustifyContent(meta?.align);

          return (
            <Box
              key={header.id}
              data-column-id={header.column.id}
              data-header-cell="true"
              style={{
                width: `var(${getColumnVarName(header.column.id)})`,
                minWidth: meta?.minWidth,
                textAlign,
                flexShrink: 0,
              }}>
              <div
                className="relative flex h-full w-full items-center"
                style={{
                  justifyContent,
                }}>
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-1 bg-transparent pr-3 text-inherit"
                  style={{
                    cursor: header.column.getCanSort() ? "pointer" : "default",
                    justifyContent,
                    width: meta?.width ? "calc(100% - 4px)" : "100%",
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
                {meta?.width ? (
                  <span
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-[rgba(0,0,0,0.08)] opacity-45 transition-[opacity,background-color,width] hover:w-1.5 hover:bg-[rgba(0,0,0,0.22)] hover:opacity-100"
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      autoResizeColumn(header.column.id, meta.minWidth);
                    }}
                    onMouseDown={(event) =>
                      startResize(
                        event,
                        header.column.id,
                        meta.width,
                        meta.minWidth,
                      )
                    }
                  />
                ) : null}
              </div>
            </Box>
          );
        })}
      </Box>
    ));
  };

  const selectorColumns = useMemo(
    () => getConnectionSelectorColumns(columns, table),
    [columnVisible, columns, table],
  );

  useEffect(() => {
    const normalizedOrder = getNormalizedConnectionColumnOrder(tabColumnOrder);

    if (
      normalizedOrder.length !== tabColumnOrder.length ||
      normalizedOrder.some(
        (columnId, index) => columnId !== tabColumnOrder[index],
      )
    ) {
      setTabColumnOrder(normalizedOrder);
    }
  }, [setTabColumnOrder, tabColumnOrder]);

  const handleToggleColumnVisible = (columnId: string) => {
    const column = table.getColumn(columnId);
    if (!column) return;
    column.toggleVisibility(!column.getIsVisible());
  };

  const handleColumnOrderDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const currentOrder = selectorColumns.map((column) => column.id);
    const oldIndex = currentOrder.indexOf(String(active.id));
    const newIndex = currentOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    setTabColumnOrder(arrayMove(currentOrder, oldIndex, newIndex));
  };

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

      <ConnectionTableColumnSelector
        open={isColumnSelectorOpen}
        title={t("pages.connections.columns.actions")}
        description={t("pages.connections.columns.dragToReorder")}
        columns={selectorColumns}
        onClose={() => setIsColumnSelectorOpen(false)}
        onToggleVisible={handleToggleColumnVisible}
        onDragEnd={handleColumnOrderDragEnd}
      />

      <Box
        ref={tableContainerRef}
        style={tableStyleVars}
        className="min-h-0 flex-1 overflow-auto"
        sx={(theme) => ({
          borderTop: `1px solid ${theme.palette.divider}`,
          "div:focus, button:focus": { outline: "none !important" },
        })}>
        <Box
          sx={(theme) => ({
            width: "var(--connection-table-width)",
            minWidth: "100%",
            position: "relative",
            "& [data-header-cell='true'], & [data-body-cell='true']": {
              borderBottom: `1px solid ${theme.palette.divider}`,
              padding: "6px 12px",
              fontSize: 13,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              alignItems: "center",
              boxSizing: "border-box",
            },
          })}>
          <Box
            sx={(theme) => ({
              position: "sticky",
              top: 0,
              zIndex: 2,
              bgcolor: "#ffffff",
              ...theme.applyStyles("dark", {
                bgcolor: "#282a36",
              }),
            })}>
            {renderHeaderContent()}
          </Box>

          <Box
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];

              return (
                <Box
                  key={row.id}
                  className="flex"
                  onClick={() => onShowDetail(row.original.connectionData)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                  }}
                  sx={(theme) => ({
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor: theme.palette.action.hover,
                    },
                  })}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | ColumnMeta
                      | undefined;
                    const justifyContent = getColumnJustifyContent(meta?.align);
                    const renderedCell = flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    );
                    const tooltipText = getConnectionCellTooltipText(cell, t);

                    return (
                      <Box
                        key={cell.id}
                        data-column-id={cell.column.id}
                        data-body-cell="true"
                        style={{
                          width: `var(${getColumnVarName(cell.column.id)})`,
                          minWidth: meta?.minWidth,
                          textAlign: meta?.align ?? "left",
                          position: "relative",
                          flexShrink: 0,
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
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
