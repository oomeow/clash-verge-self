import { PointerActivationConstraints } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, DragOverlay, PointerSensor } from "@dnd-kit/react";
import { Box, Button } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

// test icons
import apple from "@/assets/image/test/apple.svg?raw";
import github from "@/assets/image/test/github.svg?raw";
import google from "@/assets/image/test/google.svg?raw";
import youtube from "@/assets/image/test/youtube.svg?raw";
import { BasePage, SortableItem } from "@/components/base";
import { TestItem } from "@/components/test/test-item";
import { TestViewer, type TestViewerRef } from "@/components/test/test-viewer";
import { useVergeStore } from "@/stores";

const DEFAULT_TEST_LIST = [
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

type ISortableTestItem = IVergeTestItem & { id: string };

const TestPage = () => {
  const { t } = useTranslation();
  const testList = useVergeStore(
    useShallow((s) => s.verge.test_list ?? DEFAULT_TEST_LIST),
  );
  const patchVerge = useVergeStore((s) => s.patchVerge);

  const [sortableTestList, setSortableTestList] = useState<ISortableTestItem[]>(
    [],
  );

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

  useEffect(() => {
    if (!useVergeStore.getState().verge.test_list) {
      patchVerge({ test_list: testList });
    }
    const sortable = testList.map((item) => ({
      ...item,
      id: item.uid,
    }));
    setSortableTestList(sortable);
  }, [patchVerge, testList]);

  const viewerRef = useRef<TestViewerRef>(null);

  return (
    <BasePage
      full
      title={t("pages.test.title")}
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
      <Box sx={{ overflow: "hidden" }}>
        <DragDropProvider
          sensors={(defaults) => [
            ...defaults,
            PointerSensor.configure({
              activationConstraints: [
                new PointerActivationConstraints.Distance({ value: 5 }),
              ],
            }),
          ]}
          onDragEnd={async (event) => {
            const newTestList = move(sortableTestList, event);
            setSortableTestList(newTestList);
            await patchVerge({
              test_list: newTestList,
            });
          }}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 px-2.5">
            {sortableTestList.map((item, index) => (
              <SortableItem key={item.uid} id={item.uid} index={index}>
                <TestItem
                  id={item.uid}
                  itemData={item}
                  onEdit={() => viewerRef.current?.edit(item)}
                  onDelete={async (uid) => await onDeleteTestListItem(uid)}
                />
              </SortableItem>
            ))}
          </div>
          <DragOverlay>
            {(source) => {
              const draggingItem = sortableTestList.find(
                (x) => x.id === source.id,
              );
              if (!draggingItem) return null;
              return (
                <TestItem
                  id={draggingItem.uid}
                  itemData={draggingItem}
                  style={{
                    borderRadius: "8px",
                    boxShadow: "0px 0px 10px 5px rgba(0,0,0,0.2)",
                  }}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              );
            }}
          </DragOverlay>
        </DragDropProvider>
      </Box>
      <TestViewer
        ref={viewerRef}
        onChange={async (uid, value) => await onTestListItemChange(uid, value)}
      />
    </BasePage>
  );
};

export default TestPage;
