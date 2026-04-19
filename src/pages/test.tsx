import { BasePage, DraggableItem } from "@/components/base";
import { TestItem } from "@/components/test/test-item";
import { TestViewer, TestViewerRef } from "@/components/test/test-viewer";
import { useVergeStore } from "@/stores";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  MouseSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext } from "@dnd-kit/sortable";
import { Box, Button } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { nanoid } from "nanoid";
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
// test icons
import apple from "@/assets/image/test/apple.svg?raw";
import github from "@/assets/image/test/github.svg?raw";
import google from "@/assets/image/test/google.svg?raw";
import youtube from "@/assets/image/test/youtube.svg?raw";

const FlexDecorationItems = memo(function FlexDecorationItems() {
  return [...Array(20)].map((_, index) => (
    <i key={index} className="mx-1.25 my-0 flex h-0 w-45 grow"></i>
  ));
});

const TestPage = () => {
  const { t } = useTranslation();
  const verge = useVergeStore((s) => s.verge)!;
  const patchVerge = useVergeStore((s) => s.patchVerge);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  );

  // test list
  const testList = verge?.test_list ?? [
    {
      uid: nanoid(),
      name: "Apple",
      url: "https://www.apple.com",
      icon: apple,
    },
    {
      uid: nanoid(),
      name: "GitHub",
      url: "https://www.github.com",
      icon: github,
    },
    {
      uid: nanoid(),
      name: "Google",
      url: "https://www.google.com",
      icon: google,
    },
    {
      uid: nanoid(),
      name: "Youtube",
      url: "https://www.youtube.com",
      icon: youtube,
    },
  ];
  const [sortableTestList, setSortableTestList] = useState<IVergeTestItem[]>(
    [],
  );
  const [draggingTestItem, setDraggingTestItem] =
    useState<IVergeTestItem | null>(null);

  const [overItemWidth, setOverItemWidth] = useState(180);

  const onTestListItemChange = async (
    uid: string,
    patch?: Partial<IVergeTestItem>,
  ) => {
    if (patch) {
      const newList = testList.map((x) => {
        if (x.uid === uid) {
          return { ...x, ...patch };
        }
        return x;
      });
      await patchVerge({ test_list: newList });
    }
  };

  const onDeleteTestListItem = async (uid: string) => {
    const newList = testList.filter((x) => x.uid !== uid);
    await patchVerge({ test_list: newList });
  };

  const getIndex = (id: UniqueIdentifier | undefined) => {
    if (id) {
      return sortableTestList.findIndex((x) => x.uid === id.toString());
    } else {
      return -1;
    }
  };

  const draggingTestIndex = getIndex(draggingTestItem?.uid);

  const handleChainDragEnd = async (event: DragEndEvent) => {
    setDraggingTestItem(null);
    const { over } = event;
    if (over) {
      const overIndex = getIndex(over.id);
      if (draggingTestIndex !== overIndex) {
        const newTestList = arrayMove(
          sortableTestList,
          draggingTestIndex,
          overIndex,
        );
        setSortableTestList(newTestList);
        await patchVerge({ test_list: newTestList });
      }
    }
  };

  useEffect(() => {
    if (!verge) return;
    if (!verge?.test_list) {
      patchVerge({ test_list: testList });
    }
    setSortableTestList(verge.test_list ?? testList);
  }, [verge]);

  const viewerRef = useRef<TestViewerRef>(null);

  return (
    <BasePage
      full
      title={t("pages.test.title")}
      contentStyle={{ height: "100%", overflow: "auto" }}
      header={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => emit("verge://test-all")}>
            {t("pages.test.actions.testAll")}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => viewerRef.current?.create()}>
            {t("common.actions.new")}
          </Button>
        </Box>
      }>
      <Box sx={{ pt: "5px", px: "5px" }}>
        <DndContext
          sensors={sensors}
          // onDragStart={(event) => {}}
          onDragOver={(event) => {
            const { over } = event;
            if (over) {
              const itemWidth = event.over?.rect.width;
              if (itemWidth && itemWidth !== overItemWidth) {
                setOverItemWidth(itemWidth);
              }
              const item = sortableTestList.find(
                (item) => item.uid === event.active.id,
              )!;
              setDraggingTestItem(item);
            }
          }}
          onDragEnd={handleChainDragEnd}
          onDragCancel={() => setDraggingTestItem(null)}>
          <Box sx={{ width: "100%" }}>
            <SortableContext items={sortableTestList.map((item) => item.uid)}>
              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                {sortableTestList.map((item) => (
                  <DraggableItem
                    key={item.uid}
                    id={item.uid}
                    sx={{
                      display: "flex",
                      flexGrow: "1",
                      margin: "5px",
                      width: "180px",
                    }}>
                    <TestItem
                      id={item.uid}
                      isDragging={draggingTestItem?.uid === item.uid}
                      itemData={item}
                      onEdit={() => viewerRef.current?.edit(item)}
                      onDelete={async (uid) => await onDeleteTestListItem(uid)}
                    />
                  </DraggableItem>
                ))}
                <FlexDecorationItems />
              </Box>
            </SortableContext>
          </Box>
          {createPortal(
            <DragOverlay>
              {draggingTestItem ? (
                <TestItem
                  sx={{
                    width: overItemWidth,
                    borderRadius: "8px",
                    boxShadow: "0px 0px 10px 5px rgba(0,0,0,0.2)",
                  }}
                  id={draggingTestItem.uid}
                  itemData={draggingTestItem}
                  onEdit={() => viewerRef.current?.edit(draggingTestItem)}
                  onDelete={async (uid) => await onDeleteTestListItem(uid)}
                />
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      </Box>
      <TestViewer
        ref={viewerRef}
        onChange={async (uid, value) => await onTestListItemChange(uid, value)}
      />
    </BasePage>
  );
};

export default TestPage;
