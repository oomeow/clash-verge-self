import { ProfileItem } from "@/components/profile/profile-item";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  id: string;
  width?: number;
  selected: boolean;
  activating: boolean;
  itemData: IProfileItem;
  onSelect: (force: boolean) => void;
  onEdit: () => void;
  onReactivate: () => void;
}

export const DraggableProfileItem = (props: Props) => {
  const {
    attributes,
    setNodeRef,
    listeners,
    transform,
    isDragging,
    transition,
  } = useSortable({ id: props.id });

  return (
    <ProfileItem
      ref={setNodeRef}
      {...props}
      attributes={attributes}
      listeners={listeners}
      transform={transform}
      isDragging={isDragging}
      transition={transition}
    />
  );
};
