import { Paper, Typography } from "@mui/material";
import React, { ReactNode } from "react";

import { cn } from "@/utils";

import { BaseErrorBoundary } from "./base-error-boundary";

interface Props {
  title?: React.ReactNode; // the page title
  header?: React.ReactNode; // something behind title
  contentStyle?: React.CSSProperties;
  children?: ReactNode;
  full?: boolean;
}

export const BasePage: React.FC<Props> = (props) => {
  const { title, header, contentStyle, full, children } = props;

  return (
    <BaseErrorBoundary>
      <div className="flex h-full min-h-0 w-full flex-col">
        <div
          className="flex h-12.5 shrink-0 items-center justify-between px-2"
          data-tauri-drag-region="true"
          style={{ userSelect: "none" }}>
          <Typography
            sx={{ fontSize: "20px", fontWeight: "700 " }}
            data-tauri-drag-region="true">
            {title}
          </Typography>

          {header}
        </div>

        <Paper className={"min-h-0 flex-1"} elevation={0}>
          <div
            className={cn(
              "bg-background-default h-full min-h-0 w-full",
              full ? "overflow-hidden p-0" : "overflow-auto px-2",
            )}
            style={contentStyle}>
            {children}
          </div>
        </Paper>
      </div>
    </BaseErrorBoundary>
  );
};
