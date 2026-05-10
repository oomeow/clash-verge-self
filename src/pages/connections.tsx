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
import {
  type ConnectionsOrderType,
  type ConnectionsTabName,
  useConnectionsStore,
} from "@/stores";
import parseTraffic from "@/utils/parse-traffic";

type OrderCompare = (
  a: IClosedConnectionItem,
  b: IClosedConnectionItem,
) => number;

const SCROLL_TOP_VISIBLE_THRESHOLD = 240;

const getScrollerTop = (scroller: HTMLElement | Window) =>
  "scrollY" in scroller ? scroller.scrollY : scroller.scrollTop;

const orderOpts: Record<
  ConnectionsOrderType,
  { labelKey: string; compare: OrderCompare }
> = {
  Default: {
    labelKey: "common.status.default",
    compare: (a, b) =>
      new Date(b.start || "0").getTime() - new Date(a.start || "0").getTime(),
  },
  "Upload Speed": {
    labelKey: "pages.connections.columns.uploadSpeed",
    compare: (a, b) => (b.curUpload ?? 0) - (a.curUpload ?? 0),
  },
  "Download Speed": {
    labelKey: "pages.connections.columns.downloadSpeed",
    compare: (a, b) => (b.curDownload ?? 0) - (a.curDownload ?? 0),
  },
};

const compareClosedConnections: OrderCompare = (a, b) =>
  b.closedTime - a.closedTime;

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
  const [tabName, setTabName] = useState<ConnectionsTabName>("active");
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VirtuosoHandle>(null);
  const listScrollerRef = useRef<HTMLElement | Window | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isTableLayout = connLayout === "table";
  const isActiveTab = tabName === "active";

  const {
    response: { data: connData = initConnData },
    clearClosedConnections,
  } = useConnectionData();

  const detailRef = useRef<ConnectionDetailRef>(null!);
  const totalUpload = parseTraffic(connData.uploadTotal);
  const totalDownload = parseTraffic(connData.downloadTotal);
  const activeConns = connData.activeConnections;
  const closedConns = connData.closedConnections;

  const currentConnections = isActiveTab ? activeConns : closedConns;
  const filteredConnections = useMemo(() => {
    const normalizedHostSearch = hostSearch.trim().toLowerCase();
    const matchesFilters = createConnectionFilterMatcher(filters);
    const compareConnections = isActiveTab
      ? (orderOpts[curOrderOpt] ?? orderOpts.Default).compare
      : compareClosedConnections;

    return currentConnections
      .filter((conn) => {
        const host = conn.metadata.host || conn.metadata.destinationIP || "";
        const matchesHost =
          !normalizedHostSearch ||
          host.toLowerCase().includes(normalizedHostSearch);

        return matchesHost && matchesFilters(conn);
      })
      .sort(compareConnections);
  }, [currentConnections, curOrderOpt, filters, hostSearch, isActiveTab]);

  const onCloseAll = useLockFn(async () => {
    if (
      !isActiveTab ||
      filteredConnections.length === connData.activeConnections.length
    ) {
      await closeAllConnections();
    } else {
      await Promise.all(
        filteredConnections.map((conn) => closeConnection(conn.id)),
      );
    }
  });

  const scrollToTop = useCallback(() => {
    if (isTableLayout) {
      tableContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    } else {
      listRef.current?.scrollToIndex({
        index: 0,
        align: "start",
        behavior: "auto",
      });
    }
  }, [isTableLayout]);

  const handleTabChange = useCallback(
    (nextTab: ConnectionsTabName) => {
      setTabName(nextTab);
      setShowScrollTop(false);
      requestAnimationFrame(scrollToTop);
    },
    [scrollToTop],
  );

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

    if (!scroller || filteredConnections.length === 0) {
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
  }, [filteredConnections.length, isTableLayout, tabName]);

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
        <div className="mx-2 flex min-w-0 items-center gap-2 overflow-hidden p-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex w-fit shrink-0 items-center gap-4">
              <div className="flex items-center gap-1">
                <Tooltip title={t("pages.connections.columns.totalUploaded")}>
                  <Upload fontSize="small" />
                </Tooltip>
                <span className="text-sm">{totalUpload[0]}</span>
                <span className="text-sm">{totalUpload[1]}</span>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip title={t("pages.connections.columns.totalDownloaded")}>
                  <Download fontSize="small" />
                </Tooltip>
                <span className="text-sm">{totalDownload[0]}</span>
                <span className="text-sm">{totalDownload[1]}</span>
              </div>
            </div>
            <Tooltip
              title={
                isTableLayout
                  ? t("pages.connections.view.list")
                  : t("pages.connections.view.table")
              }>
              <IconButton
                color="inherit"
                size="small"
                onClick={() =>
                  setConnectionsLayout(isTableLayout ? "list" : "table")
                }>
                {isTableLayout ? (
                  <TableRowsRounded fontSize="inherit" />
                ) : (
                  <TableChartRounded fontSize="inherit" />
                )}
              </IconButton>
            </Tooltip>
          </div>
          <Button size="small" variant="contained" onClick={onCloseAll}>
            <span className="whitespace-nowrap">
              {t("pages.connections.actions.closeAll")}{" "}
              {isActiveTab ? filteredConnections.length : activeConns.length}
            </span>
          </Button>
        </div>
      }>
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <Box
          sx={{
            mx: "10px",
            py: "10px",
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexShrink: 0,
            userSelect: "text",
            boxSizing: "border-box",
          }}>
          <ButtonGroup size="small" className="w-fit shrink-0 grow-0">
            <Button
              variant={isActiveTab ? "contained" : "outlined"}
              onClick={() => handleTabChange("active")}>
              {t("common.status.active")} {activeConns.length}
            </Button>
            <Button
              variant={!isActiveTab ? "contained" : "outlined"}
              onClick={() => handleTabChange("closed")}>
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
            connections={currentConnections}
            filters={filters}
            hostSearch={hostSearch}
            onChange={setFilters}
            onHostSearchChange={setHostSearch}
          />
        </Box>

        <Box
          sx={[
            {
              flex: 1,
              minHeight: 0,
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
          {filteredConnections.length === 0 ? (
            <BaseEmpty text={t("common.empty.noConnections")} />
          ) : isTableLayout ? (
            <ConnectionTable
              tableContainerRef={tableContainerRef}
              connections={filteredConnections}
              isActive={isActiveTab}
              onShowDetail={(detail) =>
                detailRef.current?.open(detail, isActiveTab)
              }
            />
          ) : (
            <Virtuoso
              ref={listRef}
              scrollerRef={handleListScrollerRef}
              data={filteredConnections}
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
        <Zoom in={!isActiveTab && filteredConnections.length > 0} unmountOnExit>
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
