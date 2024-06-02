import { ProfileItem } from "@/components/profile/profile-item";
import { ProfileMore } from "@/components/profile/profile-more";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  id: string;
  selected: boolean;
  itemData: IProfileItem;
  enableNum: number;
  logInfo?: [string, string][];
  reactivating: boolean;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onActivatedSave: () => void;
}

export const DraggableChainItem = (props: Props) => {
  const {
    attributes,
    setNodeRef,
    listeners,
    transform,
    isDragging,
    transition,
  } = useSortable({
    id: props.id,
    data: { activated: props.selected },
  });

  return (
    <ProfileMore
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
