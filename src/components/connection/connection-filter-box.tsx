import CloseRounded from "@mui/icons-material/CloseRounded";
import FilterAltRounded from "@mui/icons-material/FilterAltRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import {
  Box,
  Chip,
  ClickAwayListener,
  IconButton,
  InputAdornment,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { IClosedConnectionItem } from "@/hooks/use-connection-data";

export type ConnectionFilterField =
  | "host"
  | "destinationIP"
  | "destinationPort"
  | "network"
  | "type"
  | "process"
  | "rule"
  | "chains"
  | "sourceIP"
  | "sourcePort"
  | "remoteDestination"
  | "inboundName";

export type ConnectionFilter = {
  field: ConnectionFilterField;
  value: string;
};

type ConnectionFilterFieldConfig = {
  field: ConnectionFilterField;
  labelKey: string;
  getValues: (connection: IClosedConnectionItem) => string[];
};

const compactValues = (values: Array<string | number | null | undefined>) => {
  const result: string[] = [];
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed.length > 0) result.push(trimmed);
  }
  return result;
};

const getFilterKey = ({ field, value }: ConnectionFilter) =>
  `${field}\u0000${value}`;

const EMPTY_VALUES: string[] = [];

const CONNECTION_FILTER_FIELDS: ConnectionFilterFieldConfig[] = [
  {
    field: "host",
    labelKey: "common.fields.host",
    getValues: ({ metadata }) => {
      const host = metadata.host
        ? `${metadata.host}:${metadata.destinationPort}`
        : `${metadata.destinationIP}:${metadata.destinationPort}`;
      return compactValues([host]);
    },
  },
  {
    field: "destinationIP",
    labelKey: "pages.connections.filters.destinationIP",
    getValues: ({ metadata }) => compactValues([metadata.destinationIP]),
  },
  {
    field: "destinationPort",
    labelKey: "pages.connections.filters.destinationPort",
    getValues: ({ metadata }) => compactValues([metadata.destinationPort]),
  },
  {
    field: "network",
    labelKey: "pages.connections.filters.network",
    getValues: ({ metadata }) => compactValues([metadata.network]),
  },
  {
    field: "type",
    labelKey: "common.fields.type",
    getValues: ({ metadata }) => compactValues([metadata.type]),
  },
  {
    field: "process",
    labelKey: "common.fields.process",
    getValues: ({ metadata }) =>
      compactValues([metadata.process, metadata.processPath]),
  },
  {
    field: "rule",
    labelKey: "pages.connections.columns.rule",
    getValues: ({ rule, rulePayload }) => {
      const formatRule = rulePayload ? `${rule}(${rulePayload})` : rule;
      return compactValues([formatRule]);
    },
  },
  {
    field: "chains",
    labelKey: "pages.connections.columns.chains",
    getValues: ({ chains }) => {
      if (!chains?.length) return [];
      const formatChains = [...chains].reverse().join(" / ");
      return compactValues([formatChains]);
    },
  },
  {
    field: "sourceIP",
    labelKey: "pages.connections.filters.sourceIP",
    getValues: ({ metadata }) => compactValues([metadata.sourceIP]),
  },
  {
    field: "sourcePort",
    labelKey: "pages.connections.filters.sourcePort",
    getValues: ({ metadata }) => compactValues([metadata.sourcePort]),
  },
  {
    field: "remoteDestination",
    labelKey: "common.fields.destination",
    getValues: ({ metadata }) =>
      compactValues([metadata.remoteDestination, metadata.sniffHost]),
  },
  {
    field: "inboundName",
    labelKey: "pages.connections.filters.inbound",
    getValues: ({ metadata }) =>
      compactValues([metadata.inboundName, metadata.inboundUser]),
  },
];

export const createConnectionFilterMatcher = (
  filters: ConnectionFilter[],
  excludedField?: ConnectionFilterField,
) => {
  const activeFilters = excludedField
    ? filters.filter((filter) => filter.field !== excludedField)
    : filters;

  if (activeFilters.length === 0) return () => true;

  const filterMap = new Map<ConnectionFilterField, Set<string>>();
  activeFilters.forEach(({ field, value }) => {
    const values = filterMap.get(field) ?? new Set<string>();
    values.add(value.toLowerCase());
    filterMap.set(field, values);
  });

  const matchers = Array.from(filterMap, ([field, values]) => {
    const config = CONNECTION_FILTER_FIELDS.find(
      (item) => item.field === field,
    );
    return config ? { getValues: config.getValues, values } : null;
  }).filter(
    (
      item,
    ): item is {
      getValues: ConnectionFilterFieldConfig["getValues"];
      values: Set<string>;
    } => item !== null,
  );

  if (matchers.length === 0) return () => true;

  return (connection: IClosedConnectionItem) => {
    return matchers.every(({ getValues, values }) =>
      getValues(connection).some((value) => values.has(value.toLowerCase())),
    );
  };
};

type Props = {
  connections: IClosedConnectionItem[];
  filters: ConnectionFilter[];
  hostSearch: string;
  onChange: (filters: ConnectionFilter[]) => void;
  onHostSearchChange: (value: string) => void;
};

export const ConnectionFilterBox = ({
  connections,
  filters,
  hostSearch,
  onChange,
  onHostSearchChange,
}: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<ConnectionFilterField>("host");
  const [valueSearch, setValueSearch] = useState("");
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const valueListRef = useRef<HTMLDivElement | null>(null);
  const fieldLabelMap = useMemo(() => {
    return new Map(
      CONNECTION_FILTER_FIELDS.map(({ field, labelKey }) => [
        field,
        t(labelKey),
      ]),
    );
  }, [t]);

  const fieldValuesMap = useMemo(() => {
    if (!open) return new Map<ConnectionFilterField, string[]>();
    const normalizedHostSearch = hostSearch.trim().toLowerCase();

    const nextMap = new Map<ConnectionFilterField, string[]>();
    CONNECTION_FILTER_FIELDS.forEach(({ field, getValues }) => {
      const matchesOtherFields = createConnectionFilterMatcher(filters, field);
      const values = new Set<string>();

      connections.forEach((connection) => {
        const host =
          connection.metadata.host || connection.metadata.destinationIP || "";
        if (
          normalizedHostSearch &&
          !host.toLowerCase().includes(normalizedHostSearch)
        ) {
          return;
        }
        if (!matchesOtherFields(connection)) return;

        getValues(connection).forEach((value) => values.add(value));
      });

      nextMap.set(
        field,
        Array.from(values).sort((left, right) => left.localeCompare(right)),
      );
    });

    return nextMap;
  }, [connections, filters, hostSearch, open]);

  const activeFieldValues = fieldValuesMap.get(activeField) ?? EMPTY_VALUES;

  const visibleValues = useMemo(() => {
    const query = valueSearch.trim().toLowerCase();
    const values = query
      ? activeFieldValues.filter((value) => value.toLowerCase().includes(query))
      : activeFieldValues;

    return values;
  }, [activeFieldValues, valueSearch]);

  const selectedFilterSet = useMemo(() => {
    return new Set(filters.map(getFilterKey));
  }, [filters]);

  const resetValueListScroll = useCallback(() => {
    if (valueListRef.current) valueListRef.current.scrollTop = 0;
  }, []);

  const isSelected = useCallback(
    (field: ConnectionFilterField, value: string) =>
      selectedFilterSet.has(getFilterKey({ field, value })),
    [selectedFilterSet],
  );

  const toggleFilter = useCallback(
    (field: ConnectionFilterField, value: string) => {
      const filter = { field, value };
      if (isSelected(field, value)) {
        onChange(
          filters.filter((item) => getFilterKey(item) !== getFilterKey(filter)),
        );
        return;
      }

      onChange([...filters, filter]);
    },
    [filters, isSelected, onChange],
  );

  const removeFilter = useCallback(
    (filter: ConnectionFilter) => {
      onChange(
        filters.filter((item) => getFilterKey(item) !== getFilterKey(filter)),
      );
    },
    [filters, onChange],
  );

  const handleValueSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    resetValueListScroll();
    setValueSearch(event.target.value);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key !== "Backspace" ||
      hostSearch.length > 0 ||
      filters.length === 0
    ) {
      return;
    }
    event.preventDefault();
    onChange(filters.slice(0, -1));
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onChange([]);
    onHostSearchChange("");
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ minWidth: 0, flex: 1, display: "flex", gap: 0.5 }}>
        <Tooltip title={t("pages.connections.filters.placeholder")}>
          <IconButton
            ref={filterButtonRef}
            size="small"
            color={open || filters.length > 0 ? "primary" : "default"}
            sx={[
              {
                flexShrink: 0,
                width: 32,
                height: 32,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              },
              ({ palette: { mode } }) => ({
                ...(mode === "light" && { backgroundColor: "#fff" }),
              }),
            ]}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(!open);
            }}>
            <FilterAltRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box
          sx={[
            {
              height: 32,
              width: "100%",
              minWidth: 0,
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              boxSizing: "border-box",
              cursor: "text",
              overflow: "hidden",
              "&:focus-within": {
                borderColor: "primary.main",
                boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
              },
            },
            ({ palette: { mode } }) => ({
              ...(mode === "light" && { backgroundColor: "#fff" }),
            }),
          ]}>
          <InputAdornment position="start" sx={{ mr: 0, flexShrink: 0 }}>
            <SearchRounded fontSize="small" color="action" />
          </InputAdornment>
          <Box
            sx={{
              minWidth: 0,
              flex: 1,
              display: "flex",
              alignItems: "center",
              flexWrap: "nowrap",
              gap: 0.5,
              height: 26,
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": {
                display: "none",
              },
            }}>
            {filters.map((filter) => (
              <Chip
                key={`${filter.field}\n${filter.value}`}
                size="small"
                label={`${fieldLabelMap.get(filter.field) ?? filter.field}: ${
                  filter.value
                }`}
                onDelete={() => removeFilter(filter)}
                sx={{
                  flexShrink: 0,
                  maxWidth: 160,
                  height: 20,
                  "& .MuiChip-label": {
                    px: 0.625,
                    fontSize: 11,
                  },
                  "& .MuiChip-deleteIcon": {
                    fontSize: 15,
                    mr: 0.125,
                  },
                }}
              />
            ))}
            <InputBase
              placeholder={
                filters.length === 0
                  ? t("pages.connections.filters.hostPlaceholder")
                  : undefined
              }
              value={hostSearch}
              onChange={(event) => onHostSearchChange(event.target.value)}
              onFocus={() => setOpen(false)}
              onKeyDown={handleInputKeyDown}
              sx={{
                minWidth: filters.length > 0 ? 64 : 120,
                flex: filters.length > 0 ? "0 1 120px" : 1,
                fontSize: 14,
                "& input": {
                  p: 0,
                  height: 22,
                },
              }}
            />
          </Box>
          {(filters.length > 0 || hostSearch.length > 0) && (
            <Tooltip title={t("common.actions.clear")}>
              <IconButton
                size="small"
                color="primary"
                sx={{ flexShrink: 0, p: 0.5 }}
                onClick={handleClear}>
                <CloseRounded fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Popper
          open={open}
          anchorEl={filterButtonRef.current}
          placement="bottom-start"
          sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
          <Paper elevation={6} sx={{ mt: 0.5 }}>
            <Box
              sx={(theme) => ({
                display: "grid",
                gridTemplateColumns: "152px minmax(0, 1fr)",
                width: "min(720px, calc(100vw - 48px))",
                height: 360,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                overflow: "hidden",
              })}>
              <List
                dense
                disablePadding
                sx={(theme) => ({
                  minHeight: 0,
                  maxHeight: 360,
                  overflowY: "auto",
                  borderRight: `1px solid ${theme.palette.divider}`,
                  bgcolor: theme.palette.action.hover,
                })}>
                {CONNECTION_FILTER_FIELDS.map(({ field }) => {
                  const selected = field === activeField;
                  const count = fieldValuesMap.get(field)?.length ?? 0;
                  return (
                    <ListItemButton
                      key={field}
                      selected={selected}
                      disabled={count === 0}
                      onClick={() => {
                        resetValueListScroll();
                        setValueSearch("");
                        setActiveField(field);
                      }}
                      sx={{
                        minHeight: 32,
                        px: 1.25,
                        py: 0.25,
                      }}>
                      <ListItemText
                        primary={fieldLabelMap.get(field) ?? field}
                        secondary={count}
                        slotProps={{
                          primary: {
                            noWrap: true,
                            variant: "caption",
                            sx: {
                              fontWeight: selected ? 700 : 500,
                            },
                          },
                          secondary: {
                            variant: "caption",
                          },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
              <Box
                sx={{
                  minWidth: 0,
                  minHeight: 0,
                  overflow: "hidden",
                }}>
                <Box
                  sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    minHeight: 32,
                    px: 1,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  })}>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {fieldLabelMap.get(activeField) ?? activeField}
                  </Typography>
                  <Box
                    sx={(theme) => ({
                      display: "flex",
                      alignItems: "center",
                      minWidth: 0,
                      flex: 1,
                      height: 24,
                      px: 0.75,
                      borderRadius: 0.75,
                      bgcolor: theme.palette.action.hover,
                    })}>
                    <SearchRounded
                      fontSize="inherit"
                      color="action"
                      sx={{ mr: 0.5 }}
                    />
                    <InputBase
                      value={valueSearch}
                      placeholder={t("common.search.filter")}
                      onChange={handleValueSearchChange}
                      sx={{
                        minWidth: 0,
                        flex: 1,
                        fontSize: 12,
                        "& input": {
                          p: 0,
                          height: 20,
                        },
                      }}
                    />
                    {valueSearch && (
                      <IconButton
                        size="small"
                        sx={{ p: 0.25 }}
                        onClick={() => {
                          resetValueListScroll();
                          setValueSearch("");
                        }}>
                        <CloseRounded fontSize="inherit" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
                <Box
                  ref={valueListRef}
                  role="listbox"
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.25,
                    p: 0.75,
                    height: 327,
                    overflowY: "auto",
                    boxSizing: "border-box",
                  }}>
                  {visibleValues.length > 0 ? (
                    visibleValues.map((value) => {
                      const selected = isSelected(activeField, value);
                      return (
                        <Box
                          key={value}
                          role="option"
                          aria-selected={selected}
                          tabIndex={0}
                          onClick={() => toggleFilter(activeField, value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") {
                              return;
                            }
                            event.preventDefault();
                            toggleFilter(activeField, value);
                          }}
                          sx={(theme) => ({
                            minWidth: 0,
                            width: "100%",
                            borderRadius: 0.75,
                            px: 1.25,
                            py: 0.5,
                            cursor: "pointer",
                            boxSizing: "border-box",
                            bgcolor: selected
                              ? theme.palette.primary.main
                              : theme.palette.background.paper,
                            color: selected
                              ? theme.palette.primary.contrastText
                              : theme.palette.text.primary,
                            "&:hover, &:focus-visible": {
                              outline: "none",
                              bgcolor: selected
                                ? theme.palette.primary.dark
                                : theme.palette.action.hover,
                            },
                          })}>
                          <Typography
                            component="span"
                            variant="caption"
                            title={value}
                            sx={{
                              display: "block",
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                            {value}
                          </Typography>
                        </Box>
                      );
                    })
                  ) : (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ px: 0.5, py: 0.75 }}>
                      {t("pages.connections.filters.noOptions")}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};
