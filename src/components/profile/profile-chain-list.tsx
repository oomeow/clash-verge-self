import { PointerActivationConstraints } from "@dnd-kit/dom";
import { isSortable } from "@dnd-kit/dom/sortable";
import { arrayMove } from "@dnd-kit/helpers";
import { DragDropProvider, PointerSensor } from "@dnd-kit/react";
import Add from "@mui/icons-material/Add";
import { Button } from "@mui/material";
import { isEqual } from "lodash-es";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SortableItem } from "@/components/base";
import { useProfilesStore } from "@/stores";

import ProfileMoreMini from "./profile-more-mini";
import { ProfileViewer, type ProfileViewerRef } from "./profile-viewer";

const EMPTY_CHAIN: IProfileItem[] = [];

type ISortableProfileItem = IProfileItem & {
  id: string;
};

const getEnabledUids = (items: IProfileItem[]) =>
  items.filter((item) => item.enable).map((item) => item.uid);

interface Props {
  profileUid: string;
  selectedUid: string | null;
  onActivate: (item: IProfileItem) => Promise<void>;
  onChainDeleted: (item: IProfileItem) => Promise<void>;
}

export const ProfileChainList = memo(function ProfileChainList(props: Props) {
  const { profileUid, selectedUid, onActivate, onChainDeleted } = props;
  const { t } = useTranslation();

  const viewerRef = useRef<ProfileViewerRef>(null);
  const currentProfile = useProfilesStore((s) => s.currentProfile);
  const chainItems = useProfilesStore(
    (s) => s.chainItemsByProfileUid[profileUid] ?? EMPTY_CHAIN,
  );
  const chainLogs = useProfilesStore((s) => s.chainLogs);
  const fetchProfileChains = useProfilesStore((s) => s.fetchProfileChains);
  const reorderProfile = useProfilesStore((s) => s.reorderProfile);
  const enhanceProfiles = useProfilesStore((s) => s.enhanceProfiles);

  const [sortableItems, setSortableItems] = useState<ISortableProfileItem[]>(
    () => chainItems.map((item) => ({ id: item.uid, ...item })),
  );
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    setSortableItems(chainItems.map((item) => ({ id: item.uid, ...item })));
  }, [chainItems]);

  // 打开面板时拉取一次链列表
  useEffect(() => {
    void fetchProfileChains(profileUid);
  }, [fetchProfileChains, profileUid]);

  const refresh = useCallback(async () => {
    await fetchProfileChains(profileUid);
  }, [fetchProfileChains, profileUid]);

  const handleActivate = useCallback(
    async (item: IProfileItem) => {
      await onActivate(item);
    },
    [onActivate],
  );

  const handleDelete = useCallback(
    async (item: IProfileItem) => {
      await onChainDeleted(item);
      await refresh();
    },
    [onChainDeleted, refresh],
  );

  const isRunningProfile = currentProfile?.uid === profileUid;

  return (
    <div className="px-1">
      <Button
        size="small"
        variant="contained"
        fullWidth
        startIcon={<Add />}
        onClick={() => viewerRef.current?.create(profileUid)}>
        {t("common.actions.add")}
      </Button>

      <ProfileViewer ref={viewerRef} onChange={refresh} />

      <div className="overflow-auto px-1">
        <DragDropProvider
          sensors={(defaults) => [
            ...defaults,
            PointerSensor.configure({
              // 行内主体为 <button>（可点击整行），默认 PointerSensor 会忽略
              // 落在交互元素上的拖拽起点，这里放开以支持整行拖拽排序
              preventActivation: () => false,
              activationConstraints: [
                new PointerActivationConstraints.Distance({ value: 5 }),
              ],
            }),
          ]}
          onDragOver={(e) => {
            if (reactivating) e.preventDefault();
          }}
          onDragEnd={async (event) => {
            const { operation, canceled } = event;
            const { source, target } = operation;
            if (canceled) return;

            if (target && isSortable(source)) {
              const newIndex = source.sortable.index;
              const oldIndex = source.sortable.initialIndex;
              if (newIndex === oldIndex) return;
              const activeId = sortableItems[oldIndex].uid;
              const overId = sortableItems[newIndex].uid;

              const newChainList = arrayMove(sortableItems, oldIndex, newIndex);
              const needToEnhance =
                !isEqual(
                  getEnabledUids(sortableItems),
                  getEnabledUids(newChainList),
                ) && isRunningProfile;

              await reorderProfile(activeId, overId);
              setSortableItems(newChainList);

              if (needToEnhance) {
                setReactivating(true);
                try {
                  await enhanceProfiles();
                } finally {
                  setReactivating(false);
                }
              }
              await refresh();
            }
          }}>
          {sortableItems.map((item, index) => (
            <SortableItem
              key={item.uid}
              id={item.uid}
              index={index}
              className="my-2">
              <ProfileMoreMini
                item={item}
                reactivating={reactivating && item.enable}
                selected={item.uid === selectedUid}
                logs={chainLogs[item.uid]}
                onToggleEnableCallback={refresh}
                onClick={handleActivate}
                onInfoChangeCallback={refresh}
                onDeleteCallback={handleDelete}
              />
            </SortableItem>
          ))}
        </DragDropProvider>
      </div>
    </div>
  );
});
