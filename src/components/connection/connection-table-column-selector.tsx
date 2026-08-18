import { isSortable } from "@dnd-kit/dom/sortable";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DragIndicatorRounded from "@mui/icons-material/DragIndicatorRounded";
import { Backdrop, Box, Checkbox, IconButton } from "@mui/material";
import { useRef, useState } from "react";

import { cn } from "@/utils";

import type { ColumnOption } from "./connection-table.types";

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
    <Box
      ref={setElement}
      data-show={isDragging || undefined}
      className={cn("bg-background-paper", isDragging && "shadow-8")}>
      <Box className="hover:bg-action-hover flex items-center gap-2 rounded px-3 py-2">
        <button
          ref={handleRef}
          type="button"
          className="cursor-grab active:cursor-grabbing"
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
      </Box>
    </Box>
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
    <Backdrop open={open} onClick={onClose} className="z-20 bg-black/24">
      <Box
        onClick={(event) => event.stopPropagation()}
        className="border-divider bg-background-paper shadow-16 max-h-[min(560px,calc(100vh-32px))] w-[320px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border">
        <Box className="border-divider flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs opacity-60">{description}</div>
          </div>
          <IconButton size="small" onClick={onClose}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </Box>

        <Box className="max-h-[calc(min(560px,calc(100vh-32px))-65px)] overflow-y-auto px-1 py-1">
          <DragDropProvider
            onDragEnd={(event) => {
              const { operation, canceled } = event;
              const { source, target } = operation;
              if (canceled || !target || !isSortable(source)) return;

              onDragEnd(source.sortable.initialIndex, source.sortable.index);
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
        </Box>
      </Box>
    </Backdrop>
  );
};
