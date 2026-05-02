import { isSortable } from "@dnd-kit/dom/sortable";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import CancelIcon from "@mui/icons-material/Close";
import DragIndicatorRounded from "@mui/icons-material/DragIndicatorRounded";
import { Backdrop, Box, Checkbox, IconButton } from "@mui/material";
import { useRef, useState } from "react";

import { cn } from "@/utils";

import { ColumnOption } from "./connection-table.types";

const SortableColumnOption = ({
  option,
  index,
  onToggleVisible,
}: {
  option: ColumnOption;
  index: number;
  onToggleVisible: (columnId: string) => void;
}) => {
  const [element, setElement] = useState<Element | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const { isDragging } = useSortable({
    id: option.id,
    index,
    element,
    handle: handleRef,
  });
  return (
    <div
      className={cn("bg-white", {
        "shadow-[0_0_10px_5px_rgba(0,0,0,0.2)]": isDragging,
      })}
      ref={setElement}
      data-show={isDragging || undefined}>
      <div className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[rgba(0,0,0,0.04)]">
        <button
          ref={handleRef}
          type="button"
          className="cursor-grab text-[rgba(0,0,0,0.48)] active:cursor-grabbing"
          aria-label={`Drag ${option.label}`}>
          <DragIndicatorRounded fontSize="small" />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
          onClick={() => onToggleVisible(option.id)}>
          <Checkbox checked={option.visible} size="small" tabIndex={-1} />
          <span className="truncate">{option.label}</span>
        </button>
      </div>
    </div>
  );
};

interface Props {
  open: boolean;
  title: string;
  description: string;
  columns: ColumnOption[];
  onClose: () => void;
  onToggleVisible: (columnId: string) => void;
  onDragEnd: (oldIndex: number, newIndex: number) => void;
}

export const ConnectionTableColumnSelector = ({
  open,
  title,
  description,
  columns,
  onClose,
  onToggleVisible,
  onDragEnd,
}: Props) => {
  return (
    <Backdrop
      open={open}
      onClick={onClose}
      sx={{ zIndex: 20, bgcolor: "rgba(0,0,0,0.24)" }}>
      <Box
        onClick={(event) => event.stopPropagation()}
        sx={(theme) => ({
          width: 320,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "min(560px, calc(100vh - 32px))",
          overflow: "hidden",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: "14px",
          bgcolor: theme.palette.background.paper,
          boxShadow: theme.shadows[16],
        })}>
        <Box
          className="flex items-center justify-between gap-3 px-4 py-3"
          sx={(theme) => ({
            borderBottom: `1px solid ${theme.palette.divider}`,
          })}>
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs opacity-60">{description}</div>
          </div>
          <IconButton size="small" onClick={onClose}>
            <CancelIcon fontSize="small" />
          </IconButton>
        </Box>

        <div className="max-h-105 overflow-y-auto px-2 py-2">
          <DragDropProvider
            onDragEnd={(event) => {
              const { operation, canceled } = event;
              const { source, target } = operation;
              if (canceled) return;

              if (target && isSortable(source)) {
                const newIndex = source.sortable.index;
                const oldIndex = source.sortable.initialIndex;
                onDragEnd(oldIndex, newIndex);
              }
            }}>
            <div className="space-y-1">
              {columns.map((column, index) => (
                <SortableColumnOption
                  key={column.id}
                  index={index}
                  option={column}
                  onToggleVisible={onToggleVisible}
                />
              ))}
            </div>
          </DragDropProvider>
        </div>
      </Box>
    </Backdrop>
  );
};
