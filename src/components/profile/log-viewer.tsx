import { BaseDialog, BaseEmpty } from "@/components/base";
import { LogMessage } from "@/components/profile/profile-more";
import { useThemeModeStore } from "@/stores";
import { cn } from "@/utils";
import Close from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";
import { Fragment, useMemo, useState } from "react";

interface Props {
  open: boolean;
  logInfo: LogMessage[];
  onClose: () => void;
}

type SyntaxClasses = {
  key: string;
  string: string;
  number: string;
  boolean: string;
  nullish: string;
  summary: string;
  bracket: string;
  separator: string;
};

const LIGHT_LEVEL_CLASSES: Record<string, string> = {
  log: "bg-blue-50 text-blue-600",
  info: "bg-teal-50 text-teal-700",
  debug: "bg-violet-50 text-violet-600",
  warn: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-600",
};

const DARK_LEVEL_CLASSES: Record<string, string> = {
  log: "bg-blue-950 text-blue-300",
  info: "bg-teal-900 text-teal-300",
  debug: "bg-purple-950 text-violet-300",
  warn: "bg-yellow-900 text-yellow-300",
  error: "bg-red-900 text-red-300",
};

const LIGHT_SYNTAX_CLASSES: SyntaxClasses = {
  key: "text-violet-600",
  string: "text-green-700",
  number: "text-amber-700",
  boolean: "text-blue-600",
  nullish: "text-gray-500",
  summary: "text-cyan-600",
  bracket: "text-gray-500",
  separator: "text-gray-700",
};

const DARK_SYNTAX_CLASSES: SyntaxClasses = {
  key: "text-violet-300",
  string: "text-green-300",
  number: "text-amber-300",
  boolean: "text-blue-300",
  nullish: "text-gray-400",
  summary: "text-cyan-300",
  bracket: "text-gray-400",
  separator: "text-gray-200",
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isPrimitive = (value: unknown) => {
  return !isRecord(value) && !Array.isArray(value);
};

const parseLogValue = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }

    return value;
  }

  return value;
};

const stringifyPrimitive = (value: unknown) => {
  if (typeof value === "string") return JSON.stringify(value);

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value == null) {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getCollectionSummary = (value: unknown) => {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isRecord(value)) return `Object(${Object.keys(value).length})`;
  return "";
};

const getPreviewEntries = (value: unknown, limit = 3) => {
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : isRecord(value)
      ? Object.entries(value)
      : [];

  return {
    entries: entries.slice(0, limit),
    hiddenCount: Math.max(entries.length - limit, 0),
  };
};

const ValuePreview = ({
  value,
  syntaxClasses,
  showArrayValues = false,
  compactCollection = false,
}: {
  value: unknown;
  syntaxClasses: SyntaxClasses;
  showArrayValues?: boolean;
  compactCollection?: boolean;
}) => {
  if (Array.isArray(value)) {
    if (showArrayValues) {
      return <ArrayPreview value={value} syntaxClasses={syntaxClasses} />;
    }

    return (
      <span className={syntaxClasses.summary}>
        {compactCollection ? "Array" : `Array(${value.length})`}
      </span>
    );
  }

  if (isRecord(value)) {
    return (
      <span className={syntaxClasses.summary}>
        {compactCollection ? "Object" : `Object(${Object.keys(value).length})`}
      </span>
    );
  }

  const valueClass =
    typeof value === "string"
      ? syntaxClasses.string
      : typeof value === "number"
        ? syntaxClasses.number
        : typeof value === "boolean"
          ? syntaxClasses.boolean
          : value == null
            ? syntaxClasses.nullish
            : "";

  return <span className={valueClass}>{stringifyPrimitive(value)}</span>;
};

const ArrayPreview = ({
  value,
  syntaxClasses,
  limit = 6,
}: {
  value: unknown[];
  syntaxClasses: SyntaxClasses;
  limit?: number;
}) => {
  const { entries, hiddenCount } = getPreviewEntries(value, limit);

  const isPrimitiveOnly = value.every(isPrimitive);

  return (
    <span className={syntaxClasses.bracket}>
      {"["}
      {entries.map(([key, item], index) => (
        <Fragment key={key}>
          {index > 0 && <span className={syntaxClasses.separator}>, </span>}
          <ValuePreview
            value={item}
            syntaxClasses={syntaxClasses}
            compactCollection={!isPrimitiveOnly}
          />
        </Fragment>
      ))}
      {hiddenCount > 0 && (
        <>
          <span className={syntaxClasses.separator}>, </span>
          <span className={syntaxClasses.nullish}>...{hiddenCount} more</span>
        </>
      )}
      {"]"}
    </span>
  );
};

const CollectionPreview = ({
  value,
  syntaxClasses,
  arrayLimit = 6,
}: {
  value: unknown;
  syntaxClasses: SyntaxClasses;
  arrayLimit?: number;
}) => {
  const { entries, hiddenCount } = getPreviewEntries(value);

  if (entries.length === 0) return null;

  if (Array.isArray(value)) {
    return (
      <ArrayPreview
        value={value}
        syntaxClasses={syntaxClasses}
        limit={arrayLimit}
      />
    );
  }

  return (
    <span className={syntaxClasses.bracket}>
      {"{"}
      {entries.map(([key, item], index) => (
        <Fragment key={key}>
          {index > 0 && <span>, </span>}
          <span className={syntaxClasses.key}>{key}: </span>
          <ValuePreview
            value={item}
            syntaxClasses={syntaxClasses}
            showArrayValues
          />
        </Fragment>
      ))}
      {hiddenCount > 0 && (
        <>
          <span>, </span>
          <span className={syntaxClasses.nullish}>...{hiddenCount} more</span>
        </>
      )}
      {"}"}
    </span>
  );
};

const ExpandableValue = ({
  value,
  syntaxClasses,
  name,
  depth = 0,
  showCollectionPreview = false,
}: {
  value: unknown;
  syntaxClasses: SyntaxClasses;
  name?: string;
  depth?: number;
  showCollectionPreview?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const isArray = Array.isArray(value);
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : isRecord(value)
      ? Object.entries(value)
      : [];
  const canExpand = entries.length > 0;

  if (!canExpand) {
    return (
      <div className="min-h-4.5">
        <span className="min-w-0 leading-4.5">
          {name && <span className={syntaxClasses.key}>{name}: </span>}
          <ValuePreview value={value} syntaxClasses={syntaxClasses} />
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-h-4.5">
      <button
        type="button"
        aria-label={expanded ? "Collapse log value" : "Expand log value"}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "block w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left font-[inherit]",
          syntaxClasses.bracket,
        )}>
        <span
          aria-hidden
          className="absolute top-0 -left-3.5 inline-flex h-4.5 w-3.5 items-center justify-center">
          <span
            className={cn(
              "h-0 w-0 border-y-[3.5px] border-l-[7px] border-y-transparent border-l-current transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        </span>
        <span className="min-w-0 leading-4.5">
          {name && <span className={syntaxClasses.key}>{name}: </span>}
          {isArray ? (
            <ArrayPreview value={value} syntaxClasses={syntaxClasses} />
          ) : (
            <>
              {!showCollectionPreview && (
                <span className={syntaxClasses.summary}>
                  {getCollectionSummary(value)}
                </span>
              )}
              {showCollectionPreview && (
                <CollectionPreview
                  value={value}
                  syntaxClasses={syntaxClasses}
                  arrayLimit={6}
                />
              )}
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className={cn("pl-1.5", depth === 0 ? "ml-2.5" : "ml-3")}>
          {entries.map(([key, item]) => (
            <ExpandableValue
              key={key}
              name={key}
              value={item}
              syntaxClasses={syntaxClasses}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const LogContent = ({
  log,
  syntaxClasses,
}: {
  log: LogMessage;
  syntaxClasses: SyntaxClasses;
}) => {
  const data = useMemo(() => log.data.map(parseLogValue), [log.data]);

  return (
    <>
      {data.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span> </span>}
          <ExpandableValue
            value={item}
            syntaxClasses={syntaxClasses}
            showCollectionPreview
          />
        </Fragment>
      ))}
      {log.exception && <div>{log.exception}</div>}
    </>
  );
};

export const LogViewer = (props: Props) => {
  const { open, logInfo, onClose } = props;
  const themeMode = useThemeModeStore((s) => s.themeMode);

  const isDarkMode = themeMode === "dark";
  const levelClasses = isDarkMode ? DARK_LEVEL_CLASSES : LIGHT_LEVEL_CLASSES;
  const syntaxClasses = isDarkMode ? DARK_SYNTAX_CLASSES : LIGHT_SYNTAX_CLASSES;

  const title = (
    <div className="flex items-center justify-between">
      <span>Logs</span>
      <IconButton
        aria-label="close"
        size="small"
        color="inherit"
        onClick={onClose}>
        <Close fontSize="small" />
      </IconButton>
    </div>
  );

  return (
    <BaseDialog
      open={open}
      title={title}
      hideFooter
      onClose={onClose}
      contentStyle={{
        width: "min(900px, calc(100vw - 96px))",
        maxWidth: "none",
        height: "min(72vh, 680px)",
      }}>
      <div className={cn("h-full w-full font-mono text-xs leading-normal")}>
        {logInfo.length === 0 ? (
          <div className="h-full w-full">
            <BaseEmpty />
          </div>
        ) : (
          logInfo.map((log, index) => {
            const method = (log.exception ? "error" : log.method || "log")
              .toLowerCase()
              .trim();
            const levelClass = levelClasses[method] ?? levelClasses.log;

            return (
              <div
                key={`${index}-${method}`}
                className={cn(
                  "grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 border-b py-2",
                  isDarkMode ? "border-white/10" : "border-black/10",
                )}>
                <span
                  className={cn(
                    "inline-flex h-5.5 w-14.5 items-center justify-center self-start rounded text-[11px] font-bold uppercase",
                    levelClass,
                  )}>
                  {method}
                </span>

                <div
                  className={cn(
                    "m-0 min-w-0 font-[inherit] wrap-anywhere whitespace-pre-wrap",
                    log.exception &&
                      (isDarkMode ? "text-red-300" : "text-red-600"),
                  )}>
                  <LogContent log={log} syntaxClasses={syntaxClasses} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </BaseDialog>
  );
};
