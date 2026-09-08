import { cn } from "@/utils";

interface TestDivProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  "aria-selected"?: boolean;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export const TestDiv = ({
  children,
  className,
  style,
  "aria-label": label,
  "aria-selected": selected,
  onContextMenu,
}: TestDivProps) => {
  const isDragging = label === "dragging";

  return (
    <div
      role="option"
      aria-label={label}
      aria-selected={selected}
      tabIndex={0}
      onContextMenu={onContextMenu}
      className={cn(
        "bg-background-paper relative box-border block w-full cursor-pointer rounded-xl p-2 text-left",
        "text-text-secondary dark:text-text-secondary/65 shadow-sm",
        selected ? "[&_h2]:text-primary" : "[&_h2]:text-text-primary",
        isDragging &&
          "border-primary/50 border border-solid shadow-[0_0_0_4px_var(--mui-palette-primary-main)]",
        className,
      )}
      style={style}>
      {children}
    </div>
  );
};
