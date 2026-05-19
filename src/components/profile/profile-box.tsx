import { Card } from "@mui/material";

import { cn } from "@/utils";

interface ProfileDivProps {
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-selected"?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export const ProfileDiv = ({
  children,
  className,
  "aria-label": label,
  "aria-selected": selected,
  onClick,
  onDoubleClick,
  onContextMenu,
}: ProfileDivProps) => {
  const isDragging = label === "dragging";

  return (
    <Card
      elevation={0}
      aria-label={label}
      aria-selected={selected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        "relative box-border block h-full w-full cursor-pointer overflow-hidden rounded-xl p-2 text-left shadow-sm",
        "text-text-secondary dark:text-text-secondary/65",
        selected &&
          "bg-primary/25 dark:bg-primary/35 border-primary w-full border-l-[3px]",

        isDragging && "shadow-[0_0_10px_5px_rgba(0,0,0,0.12)]",
        "[&_h2]:text-text-primary",
        className,
      )}>
      {children}
    </Card>
  );
};
