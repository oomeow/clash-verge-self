import { IClosedConnectionItem } from "@/hooks/use-connection-data";

export type ConnectionRow = {
  id: string;
  type: string;
  host: string;
  ulSpeed: number;
  dlSpeed: number;
  chains: string;
  rule: string;
  process: string;
  source: string;
  remoteDestination: string;
  upload: number;
  download: number;
  time: string;
  closedTime: number;
  connectionData: IClosedConnectionItem;
};

export type ColumnMeta = {
  align?: "left" | "center" | "right";
};

export type ColumnOption = {
  id: string;
  label: string;
  visible: boolean;
};

export const DEFAULT_COLUMN_ORDER = [
  "type",
  "host",
  "ulSpeed",
  "dlSpeed",
  "chains",
  "rule",
  "process",
  "source",
  "remoteDestination",
  "upload",
  "download",
  "time",
] as const;

export type ConnectionColumnId = (typeof DEFAULT_COLUMN_ORDER)[number];
