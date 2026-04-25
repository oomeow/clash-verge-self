import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import CancelIcon from "@mui/icons-material/Close";
import DragIndicatorRounded from "@mui/icons-material/DragIndicatorRounded";
import { Backdrop, Box, Checkbox, IconButton } from "@mui/material";
import { type CSSProperties } from "react";

import { ColumnOption } from "./connection-table.types";

const SortableColumnOption = ({
  option,
  onToggleVisible,
}: {
  option: ColumnOption;
  onToggleVisible: (columnId: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style: CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[rgba(0,0,0,0.04)]">
        <button
          type="button"
          className="cursor-grab text-[rgba(0,0,0,0.48)] active:cursor-grabbing"
          aria-label={`Drag ${option.label}`}
          {...attributes}
          {...listeners}>
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
  onDragEnd: (event: DragEndEvent) => void;
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

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

        <Box className="max-h-105 overflow-y-auto px-2 py-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}>
            <SortableContext
              items={columns.map((column) => column.id)}
              strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {columns.map((column) => (
                  <SortableColumnOption
                    key={column.id}
                    option={column}
                    onToggleVisible={onToggleVisible}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Box>
      </Box>
    </Backdrop>
  );
};
