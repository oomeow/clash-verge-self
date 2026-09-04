import { useSortable } from "@dnd-kit/react/sortable";

interface DraggableItemProps {
  id: string;
  index: number;
  className?: string;
  children: React.ReactNode;
}

export const SortableItem = (props: DraggableItemProps) => {
  const { id, index, className, children } = props;
  const { ref } = useSortable({ id, index });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};
