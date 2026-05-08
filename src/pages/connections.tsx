import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import Download from "@mui/icons-material/Download";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import TableChartRounded from "@mui/icons-material/TableChartRounded";
import TableRowsRounded from "@mui/icons-material/TableRowsRounded";
import Upload from "@mui/icons-material/Upload";
import {
  Box,
  Button,
  ButtonGroup,
  Fab,
  IconButton,
  MenuItem,
  Tooltip,
  Zoom,
} from "@mui/material";
import { useLockFn } from "ahooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { closeAllConnections, closeConnection } from "tauri-plugin-mihomo-api";

import { BaseEmpty, BasePage, BaseStyledSelect } from "@/components/base";
import {
  ConnectionDetail,
  ConnectionDetailRef,
} from "@/components/connection/connection-detail";
import {
  ConnectionFilter,
  ConnectionFilterBox,
  createConnectionFilterMatcher,
} from "@/components/connection/connection-filter-box";
import { ConnectionItem } from "@/components/connection/connection-item";
import { ConnectionTable } from "@/components/connection/connection-table";
import {
  IClosedConnectionItem,
  initConnData,
  useConnectionData,
} from "@/hooks/use-connection-data";
import { type ConnectionsOrderType, useConnectionsStore } from "@/stores";
import parseTraffic from "@/utils/parse-traffic";

type OrderFunc = (list: IClosedConnectionItem[]) => IClosedConnectionItem[];

const SCROLL_TOP_VISIBLE_THRESHOLD = 240;

const getScrollerTop = (scroller: HTMLElement | Window) =>
  "scrollY" in scroller ? scroller.scrollY : scroller.scrollTop;

const ConnectionsPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ConnectionFilter[]>([]);
  const [hostSearch, setHostSearch] = useState("");
  const connLayout = useConnectionsStore((s) => s.layout);
  const setConnectionsLayout = useConnectionsStore(
    (s) => s.setConnectionsLayout,
  );
  const curOrderOpt = useConnectionsStore((s) => s.curOrderOpt);
  const setOrderType = useConnectionsStore((s) => s.setOrderType);
  const [tabName, setTabName] = useState("active");
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VirtuosoHandle>(null);
  const listScrollerRef = useRef<HTMLElement | Window | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isTableLayout = connLayout === "table";
  const isActiveTab = tabName === "active";

  const orderOpts: Record<
    ConnectionsOrderType,
    { labelKey: string; sort: OrderFunc }
  > = {
    Default: {
      labelKey: "common.status.default",
      sort: (list) =>
        list.sort(
          (a, b) =>
            new Date(b.start || "0").getTime()! -
            new Date(a.start || "0").getTime()!,
        ),
    },
    "Upload Speed": {
      labelKey: "pages.connections.columns.uploadSpeed",
      sort: (list) => list.sort((a, b) => b.curUpload! - a.curUpload!),
    },
    "Download Speed": {
      labelKey: "pages.connections.columns.downloadSpeed",
      sort: (list) => list.sort((a, b) => b.curDownload! - a.curDownload!),
    },
  };

  const {
    response: { data: connData = initConnData },
    clearClosedConnections,
  } = useConnectionData();

  const detailRef = useRef<ConnectionDetailRef>(null!);
  const totalUpload = parseTraffic(connData.uploadTotal);
  const totalDownload = parseTraffic(connData.downloadTotal);
  const activeConns = connData.activeConnections;
  const closedConns = connData.closedConnections;

  // filter connections
  const orderFunc = orderOpts[curOrderOpt]?.sort;
  const conns = isActiveTab ? activeConns : closedConns;
  const matchesConnectionFilters = useMemo(
    () => createConnectionFilterMatcher(filters),
    [filters],
  );
  const normalizedHostSearch = hostSearch.trim().toLowerCase();
  const matchesHostSearch = useMemo(() => {
    if (!normalizedHostSearch) return () => true;

    return (conn: IClosedConnectionItem) => {
      const host = conn.metadata.host || conn.metadata.destinationIP || "";
      return host.toLowerCase().includes(normalizedHostSearch);
    };
  }, [normalizedHostSearch]);
  const filterConn = useMemo(() => {
    let filteredConnections =
      filters.length > 0 || normalizedHostSearch
        ? conns.filter(
            (conn) => matchesConnectionFilters(conn) && matchesHostSearch(conn),
          )
        : [...conns];
    if (orderFunc) filteredConnections = orderFunc(filteredConnections);
    if (!isActiveTab) {
      filteredConnections = filteredConnections.sort(
        (a, b) => b.closedTime - a.closedTime,
      );
    }

    return filteredConnections;
  }, [
    conns,
    filters.length,
    isActiveTab,
    matchesConnectionFilters,
    matchesHostSearch,
    normalizedHostSearch,
    orderFunc,
  ]);

  const onCloseAll = useLockFn(async () => {
    if (
      !isActiveTab ||
      filterConn.length === connData.activeConnections.length
    ) {
      await closeAllConnections();
    } else {
      await Promise.all(filterConn.map((conn) => closeConnection(conn.id)));
    }
  });

  const scrollToTop = useCallback(() => {
    if (isTableLayout) {
      tableContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      listRef.current?.scrollToIndex({
        index: 0,
        align: "start",
        behavior: "smooth",
      });
    }
  }, [isTableLayout]);

  const handleListScrollerRef = useCallback(
    (ref: HTMLElement | Window | null) => {
      listScrollerRef.current = ref;
    },
    [],
  );

  useEffect(() => {
    const scroller = isTableLayout
      ? tableContainerRef.current
      : listScrollerRef.current;

    if (!scroller || filterConn.length === 0) {
      setShowScrollTop(false);
      return;
    }

    const updateScrollTopVisible = () => {
      setShowScrollTop(getScrollerTop(scroller) > SCROLL_TOP_VISIBLE_THRESHOLD);
    };

    updateScrollTopVisible();
    scroller.addEventListener("scroll", updateScrollTopVisible, {
      passive: true,
    });

    return () => {
      scroller.removeEventListener("scroll", updateScrollTopVisible);
    };
  }, [filterConn.length > 0, isTableLayout, tabName]);

  return (
    <BasePage
      full
      title={
        <span style={{ whiteSpace: "nowrap" }}>
          {t("pages.connections.title")}
        </span>
      }
      contentStyle={{ height: "100%" }}
      header={
        <div className="mx-2 flex items-center overflow-hidden">
          <div className="flex w-full items-center space-x-2 p-2">
            <div className="flex w-fit items-center space-x-4">
              <div className="flex w-full items-center space-x-1">
                <Tooltip title={t("pages.connections.columns.totalUploaded")}>
                  <Upload fontSize="small" />
                </Tooltip>
                <span className="text-sm">{totalUpload[0]}</span>
                <span className="text-sm">{totalUpload[1]}</span>
              </div>
              <div className="flex w-full items-center space-x-1">
                <Tooltip title={t("pages.connections.columns.totalDownloaded")}>
                  <Download fontSize="small" />
                </Tooltip>
                <span className="text-sm">{totalDownload[0]}</span>
                <span className="text-sm">{totalDownload[1]}</span>
              </div>
            </div>
            <IconButton
              color="inherit"
              size="small"
              title={
                isTableLayout
                  ? t("pages.connections.view.list")
                  : t("pages.connections.view.table")
              }
              onClick={() =>
                setConnectionsLayout(isTableLayout ? "list" : "table")
              }>
              {isTableLayout ? (
                <TableRowsRounded fontSize="inherit" />
              ) : (
                <TableChartRounded fontSize="inherit" />
              )}
            </IconButton>
          </div>
          <div>
            <Button size="small" variant="contained" onClick={onCloseAll}>
              <span style={{ whiteSpace: "nowrap" }}>
                {t("pages.connections.actions.closeAll")}{" "}
                {isActiveTab ? filterConn.length : activeConns.length}
              </span>
            </Button>
          </div>
        </div>
      }>
      <div className="relative h-full w-full overflow-hidden">
        <Box
          sx={{
            mb: "10px",
            pt: "10px",
            mx: "10px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            userSelect: "text",
            boxSizing: "border-box",
          }}>
          <ButtonGroup size="small" className="mr-2 w-fit shrink-0 grow-0">
            <Button
              variant={isActiveTab ? "contained" : "outlined"}
              onClick={() => {
                setTabName("active");
                if (isTableLayout && tableContainerRef.current) {
                  tableContainerRef.current.scrollTo({ top: 0 });
                }
              }}>
              {t("common.status.active")} {activeConns.length}
            </Button>
            <Button
              variant={!isActiveTab ? "contained" : "outlined"}
              onClick={() => {
                setTabName("closed");
                if (isTableLayout && tableContainerRef.current) {
                  tableContainerRef.current.scrollTo({ top: 0 });
                }
              }}>
              {t("common.status.closed")} {closedConns.length}
            </Button>
          </ButtonGroup>
          {!isTableLayout && isActiveTab && (
            <BaseStyledSelect
              value={curOrderOpt}
              onChange={(e) =>
                setOrderType(e.target.value as ConnectionsOrderType)
              }>
              {Object.entries(orderOpts).map(([opt, config]) => (
                <MenuItem key={opt} value={opt}>
                  <span style={{ fontSize: 14 }}>{t(config.labelKey)}</span>
                </MenuItem>
              ))}
            </BaseStyledSelect>
          )}
          <ConnectionFilterBox
            connections={conns}
            filters={filters}
            hostSearch={hostSearch}
            onChange={setFilters}
            onHostSearchChange={setHostSearch}
          />
        </Box>

        <Box
          sx={[
            {
              height: "calc(100% - 50px)",
            },
            (theme) => ({
              userSelect: "text",
              mx: "10px",
              mb: "4px",
              borderRadius: "8px",
              bgcolor: "#ffffff",
              ...theme.applyStyles("dark", {
                bgcolor: "#282a36",
              }),
              boxSizing: "border-box",
            }),
          ]}>
          {filterConn.length === 0 ? (
            <BaseEmpty text={t("common.empty.noConnections")} />
          ) : isTableLayout ? (
            <ConnectionTable
              tableContainerRef={tableContainerRef}
              connections={filterConn}
              isActive={isActiveTab}
              onShowDetail={(detail) =>
                detailRef.current?.open(detail, isActiveTab)
              }
            />
          ) : (
            <Virtuoso
              ref={listRef}
              scrollerRef={handleListScrollerRef}
              data={filterConn}
              itemContent={(_, item) => (
                <ConnectionItem
                  key={item.id}
                  value={item}
                  isActive={isActiveTab}
                  onShowDetail={() =>
                    detailRef.current?.open(item, isActiveTab)
                  }
                />
              )}
            />
          )}
        </Box>
        <ConnectionDetail ref={detailRef} />
        <Zoom in={showScrollTop} unmountOnExit>
          <Tooltip title={t("common.actions.scrollToTop")}>
            <Fab
              size="medium"
              sx={{
                position: "absolute",
                right: 16,
                bottom: isActiveTab ? 16 : 80,
              }}
              color="primary"
              onClick={scrollToTop}>
              <KeyboardArrowUpRounded />
            </Fab>
          </Tooltip>
        </Zoom>
        <Zoom in={!isActiveTab && filterConn.length > 0} unmountOnExit>
          <Fab
            size="medium"
            variant="extended"
            sx={{
              position: "absolute",
              right: 16,
              bottom: 16,
            }}
            color="primary"
            onClick={() => clearClosedConnections()}>
            <DeleteForeverRounded sx={{ mr: 1 }} fontSize="small" />
            {t("common.actions.clear")}
          </Fab>
        </Zoom>
      </div>
    </BasePage>
  );
};

export default ConnectionsPage;
