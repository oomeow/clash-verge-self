import { isSortable } from "@dnd-kit/dom/sortable";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DragIndicatorRounded from "@mui/icons-material/DragIndicatorRounded";
import { Backdrop, Box, Checkbox, IconButton } from "@mui/material";
import { useRef, useState } from "react";

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
    <Box
      ref={setElement}
      data-show={isDragging || undefined}
      sx={(theme) => ({
        bgcolor: "background.paper",
        ...(isDragging && {
          boxShadow: theme.shadows[8],
        }),
      })}>
      <Box
        className="flex items-center gap-2 px-3 py-2"
        sx={{
          borderRadius: 1,
          "&:hover": {
            bgcolor: "action.hover",
          },
        }}>
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
          borderRadius: 1,
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
            <CloseRounded fontSize="small" />
          </IconButton>
        </Box>

        <Box
          sx={{
            maxHeight: "calc(min(560px, calc(100vh - 32px)) - 65px)",
            overflowY: "auto",
            px: 1,
            py: 1,
          }}>
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
