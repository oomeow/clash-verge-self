import { Typography } from "@mui/material";
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

        <div className={"min-h-0 flex-1 bg-white dark:bg-[#1e1f27]"}>
          <div
            className={cn(
              "bg-comment h-full min-h-0 w-full overflow-auto px-2 dark:bg-[#1e1f27]",
              { "p-0": full },
            )}
            style={contentStyle}>
            {children}
          </div>
        </div>
      </div>
    </BaseErrorBoundary>
  );
};
