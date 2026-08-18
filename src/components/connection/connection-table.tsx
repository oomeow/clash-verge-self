import { arrayMove } from "@dnd-kit/helpers";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import UnfoldMoreRounded from "@mui/icons-material/UnfoldMoreRounded";
import ViewColumnRounded from "@mui/icons-material/ViewColumnRounded";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  type Cell,
  type ColumnVisibilityState,
  flexRender,
  type Row,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  type CSSProperties,
  memo,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { IClosedConnectionItem } from "@/hooks/use-connection-data";
import { useConnectionsStore } from "@/stores";

import {
  type ColumnMeta,
  type ConnectionColumnDef,
  type ConnectionRow,
  connectionTableFeatures,
} from "./connection-table.types";
import { ConnectionTableColumnSelector } from "./connection-table-column-selector";
import { createConnectionColumns } from "./connection-table-columns";
import {
  getConnectionCellTooltipText,
  getConnectionSelectorColumns,
  getNormalizedConnectionColumnOrder,
  mapConnectionsToRows,
} from "./connection-table-utils";

interface Props {
  tableContainerRef: RefObject<HTMLDivElement | null>;
  connections: IClosedConnectionItem[];
  isActive: boolean;
  onShowDetail: (data: IClosedConnectionItem) => void;
}

interface ConnectionTableBodyProps {
  rows: Row<typeof connectionTableFeatures, ConnectionRow>[];
  tableContainerElement: HTMLDivElement | null;
  columnLayoutKey: string;
  onShowDetail: (data: IClosedConnectionItem) => void;
  getCellTooltipText: (
    cell: Cell<typeof connectionTableFeatures, ConnectionRow, unknown>,
  ) => string;
}

interface ConnectionTableBodyRowProps {
  row: Row<typeof connectionTableFeatures, ConnectionRow>;
  virtualRow: VirtualItem;
  columnLayoutKey: string;
  onShowDetail: (data: IClosedConnectionItem) => void;
  getCellTooltipText: (
    cell: Cell<typeof connectionTableFeatures, ConnectionRow, unknown>,
  ) => string;
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
    columnLayoutKey: _columnLayoutKey,
    onShowDetail,
    getCellTooltipText,
  }: ConnectionTableBodyRowProps) => {
    return (
      <tr
        data-body-row="true"
        onClick={() => onShowDetail(row.original.connectionData)}
        style={{
          contain: "layout style paint",
          display: "flex",
          position: "absolute",
          transform: `translate3d(0, ${virtualRow.start}px, 0)`,
          width: "100%",
          height: `${virtualRow.size}px`,
          willChange: "transform",
        }}>
        {row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta;
          const justifyContent = getColumnJustifyContent(meta?.align);
          const renderedCell = flexRender(
            cell.column.columnDef.cell,
            cell.getContext(),
          );

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
              <span
                className="flex h-full w-full items-center overflow-hidden text-sm text-ellipsis whitespace-nowrap"
                style={{ justifyContent }}
                onPointerEnter={(event) => {
                  const tooltipText = getCellTooltipText(cell);
                  if (tooltipText) {
                    event.currentTarget.title = tooltipText;
                    return;
                  }

                  event.currentTarget.removeAttribute("title");
                }}>
                <span
                  className="min-w-0 overflow-hidden leading-tight text-ellipsis whitespace-nowrap"
                  data-column-content="true">
                  {renderedCell}
                </span>
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
    prev.columnLayoutKey === next.columnLayoutKey &&
    prev.getCellTooltipText === next.getCellTooltipText &&
    prev.onShowDetail === next.onShowDetail,
);

const ConnectionTableBody = memo(
  ({
    rows,
    tableContainerElement,
    columnLayoutKey,
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
          contain: "layout style paint",
          display: "grid",
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
        }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <ConnectionTableBodyRow
              key={row.id}
              row={row}
              virtualRow={virtualRow}
              columnLayoutKey={columnLayoutKey}
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
    prev.columnLayoutKey === next.columnLayoutKey &&
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

  const [columnVisible, setColumnVisible] = useState<ColumnVisibilityState>({});
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

  const getColumnWidth = useCallback(
    (columnId: string, fallback: number) =>
      tabColumnsWidths[columnId] ?? fallback,
    [tabColumnsWidths],
  );

  const columns = useMemo<ConnectionColumnDef[]>(
    () =>
      createConnectionColumns({
        isActive,
        t,
        columnOrder: tabColumnOrder,
        getColumnWidth,
      }),
    [getColumnWidth, isActive, t, tabColumnOrder],
  );

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

  const table = useTable(
    {
      features: connectionTableFeatures,
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
    },
    (state) => ({
      sorting: state.sorting,
      columnVisibility: state.columnVisibility,
    }),
  );

  const getResolvedColumnWidth = useCallback(
    (column: ReturnType<typeof table.getAllLeafColumns>[number]) =>
      columnWidthsRef.current[column.id] ??
      tabColumnsWidths[column.id] ??
      column.getSize(),
    [tabColumnsWidths],
  );

  const tableWidth = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .reduce((total, column) => total + getResolvedColumnWidth(column), 0),
    [columnVisible, getResolvedColumnWidth, table],
  );

  const syncTableWidthStyles = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    let nextWidth = 0;
    table.getVisibleLeafColumns().forEach((column) => {
      nextWidth += getResolvedColumnWidth(column);
    });

    container.style.setProperty("--connection-table-width", `${nextWidth}px`);
  }, [getResolvedColumnWidth, table, tableContainerRef]);

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
      columnWidthsRef.current[column.id] = getResolvedColumnWidth(column);
    });
    syncTableWidthStyles();
  }, [columns, getResolvedColumnWidth, syncTableWidthStyles, table]);

  const getCellTooltipText = useCallback(
    (cell: Cell<typeof connectionTableFeatures, ConnectionRow, unknown>) =>
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
        `[data-column-id="${selectorColumnId}"] [data-column-content="true"]`,
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
      styleVars[getColumnVarName(column.id)] =
        `${getResolvedColumnWidth(column)}px`;
    });

    return styleVars;
  }, [getResolvedColumnWidth, table, tableWidth]);

  const columnLayoutKey = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .join("|"),
    [columnVisible, columns, table],
  );

  const headerContent = useMemo(
    () =>
      table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} className="flex w-full">
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta;
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
                    <span className="truncate">
                      <span
                        className="inline-block max-w-none"
                        data-column-content="true">
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
                      className="absolute top-0 right-0 h-full w-0.5 cursor-col-resize bg-[rgba(0,0,0,0.2)] opacity-45 transition-[opacity,background-color,width] hover:w-1.5 hover:bg-[rgba(0,0,0,0.22)] hover:opacity-100"
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
                          getResolvedColumnWidth(header.column),
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
    [
      autoResizeColumn,
      columnVisible,
      columns,
      getResolvedColumnWidth,
      sorting,
      startResize,
      table,
    ],
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
    (oldIndex: number, newIndex: number) => {
      if (oldIndex === newIndex) return;
      const currentOrder = selectorColumns.map((column) => column.id);
      setTabColumnOrder(arrayMove(currentOrder, oldIndex, newIndex));
    },
    [selectorColumns, setTabColumnOrder],
  );

  return (
    <Box className="flex h-full min-h-0 flex-col">
      <Box className="flex shrink-0 items-center justify-end px-1 py-1">
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
            bgcolor: theme.palette.background.paper,
            top: 0,
            zIndex: 1,
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
            fontWeight: 500,
          },
          "& tr[data-body-row='true']": {
            cursor: "pointer",
          },
          "& tr[data-body-row='true']:hover": {
            backgroundColor: theme.palette.action.hover,
          },
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
            columnLayoutKey={columnLayoutKey}
            onShowDetail={onShowDetail}
            getCellTooltipText={getCellTooltipText}
          />
        </table>
      </Box>
    </Box>
  );
};
